import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, FileText, Film, RotateCcw, Sparkles, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import type { MatchEvent, VideoAiFinding, VideoAnalysisAiContext } from '../types';
import {
  createVideoAiFindings,
  listVideoAiFindings,
  updateVideoAiFinding,
  type VideoAiFindingOwner
} from '../services/video/videoAiFindingsService';
import { createVideoClipForOwner } from '../services/video/videoClipsService';
import {
  buildClipFromFinding,
  buildVideoUrlAtSecond,
  canConfirmFinding,
  formatAiAnalysisBlock,
  formatConfidence,
  reviewStatusAfterConfirm
} from '../utils/videoAiFindings';
import { formatVideoTimestamp } from '../utils/mediaUrls';
import {
  buildSegments,
  dedupeFindings,
  MAX_CONSECUTIVE_EMPTY_SEGMENTS,
  type SegmentedFinding
} from '../utils/videoAnalysisSegments';
import type { ClipCategoryOption } from './VideoClipsSection';

interface AiVideoAnalysisPanelProps {
  context: VideoAnalysisAiContext;
  /** Exactly one owner id; null/undefined when the analysis has not been created yet. */
  owner: VideoAiFindingOwner;
  ownerReady: boolean;
  emptyOwnerMessage: string;
  videoUrl: string | null | undefined;
  subject?: {
    teamName?: string;
    opponentName?: string;
    playerName?: string;
    competition?: string;
    date?: string;
  };
  taxonomy: ClipCategoryOption[];
  /** Existing Match Events, used only to LINK a clip to its event (never to duplicate it). */
  matchEvents?: MatchEvent[];
  onClipsCreated?: () => void;
  /** When provided, offers to insert the AI narrative into the analysis report draft. */
  onAddNarrativeToReport?: (block: string) => void;
}

const CONTEXT_LABELS: Record<VideoAnalysisAiContext, string> = {
  my_analysis: 'My Analysis',
  opponent_analysis: 'Opponent Analysis',
  scouting: 'Scouting'
};

export const AiVideoAnalysisPanel: React.FC<AiVideoAnalysisPanelProps> = ({
  context,
  owner,
  ownerReady,
  emptyOwnerMessage,
  videoUrl,
  subject,
  taxonomy,
  matchEvents,
  onClipsCreated,
  onAddNarrativeToReport
}) => {
  const [findings, setFindings] = useState<VideoAiFinding[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [busyFindingId, setBusyFindingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string>('');
  const [patterns, setPatterns] = useState<string[]>([]);
  const [conclusions, setConclusions] = useState<string[]>([]);
  const [videoUrlDraft, setVideoUrlDraft] = useState<string>(videoUrl ?? '');
  // Kit colours belong to this analysis run only: they change from match to match and are not stored.
  const [ourKitColour, setOurKitColour] = useState('');
  const [opponentKitColour, setOpponentKitColour] = useState('');
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [failedSegmentIndex, setFailedSegmentIndex] = useState<number | null>(null);
  // Findings collected across the whole sweep, so a resumed run can dedupe against what is stored.
  const sweptEntriesRef = useRef<SegmentedFinding[]>([]);

  const ownerKey = owner.matchAnalysisId || owner.opponentAnalysisId || owner.trainingAnalysisId || owner.scoutingReportId || '';

  useEffect(() => {
    setVideoUrlDraft(videoUrl ?? '');
  }, [videoUrl, ownerKey]);

  useEffect(() => {
    if (!ownerReady || !ownerKey) {
      setFindings([]);
      return;
    }

    void (async () => {
      try {
        setIsLoading(true);
        setFindings(await listVideoAiFindings(owner));
      } catch (loadError) {
        console.error('[AiVideoAnalysisPanel] Failed loading AI findings', loadError);
        setFindings([]);
      } finally {
        setIsLoading(false);
      }
    })();
    // owner is rebuilt on every render; ownerKey is the stable identity.
  }, [ownerKey, ownerReady]);

  const handleAnalyse = async (fromSegmentIndex = 0) => {
    setError(null);
    setFailedSegmentIndex(null);

    const analysedVideoUrl = videoUrlDraft.trim();
    if (!analysedVideoUrl) {
      setError('Attach a video to this analysis before running the AI.');
      return;
    }

    if (fromSegmentIndex === 0) {
      sweptEntriesRef.current = [];
      setSummary('');
      setPatterns([]);
      setConclusions([]);
    }

    const segments = buildSegments();
    setIsAnalysing(true);

    try {
      const { data: sessionData } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('You must be signed in to analyse video with AI.');

      const segmentSummaries: string[] = [];
      const segmentPatterns: string[] = [];
      const segmentConclusions: string[] = [];
      let consecutiveEmpty = 0;
      let stoppedSegmentIndex: number | null = null;
      let stoppedMessage = '';

      for (let segmentIndex = fromSegmentIndex; segmentIndex < segments.length; segmentIndex += 1) {
        const segment = segments[segmentIndex];
        setProgress({ current: segmentIndex + 1, total: segments.length });

        let data: any;
        try {
          const response = await fetch('/api/video/analyse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({
              context,
              videoUrl: analysedVideoUrl,
              taxonomy,
              subject,
              segment,
              segmentIndex,
              kits: {
                ourKitColour: ourKitColour.trim(),
                opponentKitColour: opponentKitColour.trim()
              }
            })
          });

          const rawText = await response.text();
          try {
            data = rawText ? JSON.parse(rawText) : {};
          } catch {
            throw new Error(`Invalid server response (HTTP ${response.status}).`);
          }

          if (!response.ok || !data.success) {
            throw new Error(data.error || `The AI analysis failed (HTTP ${response.status}).`);
          }

          // Defense in depth: nothing is stored unless the server confirms the video was analysed.
          if (data.videoAnalyzed !== true) {
            throw new Error('The AI did not confirm it analysed the video. No results are shown.');
          }
        } catch (segmentError: any) {
          // The first window must work; a later one usually just runs past the end of the video.
          if (segmentIndex === fromSegmentIndex && segmentIndex === 0) throw segmentError;
          stoppedSegmentIndex = segmentIndex;
          stoppedMessage = segmentError?.message || 'Unknown error';
          break;
        }

        if (typeof data.summary === 'string' && data.summary.trim()) segmentSummaries.push(data.summary.trim());
        if (Array.isArray(data.patterns)) segmentPatterns.push(...data.patterns);
        if (Array.isArray(data.conclusions)) segmentConclusions.push(...data.conclusions);

        for (const finding of Array.isArray(data.findings) ? data.findings : []) {
          sweptEntriesRef.current.push({
            segmentIndex,
            finding: {
              category: finding.category ?? null,
              title: String(finding.title ?? ''),
              observation: String(finding.observation ?? ''),
              suggestedTags: Array.isArray(finding.suggestedTags) ? finding.suggestedTags : [],
              confidence: typeof finding.confidence === 'number' ? finding.confidence : null,
              timestampSeconds: typeof finding.timestampSeconds === 'number' ? finding.timestampSeconds : 0,
              startTime: typeof finding.startTime === 'number' ? finding.startTime : 0,
              endTime: typeof finding.endTime === 'number' ? finding.endTime : 0
            }
          });
        }

        consecutiveEmpty = data.isEmpty === true ? consecutiveEmpty + 1 : 0;
        if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY_SEGMENTS) break;
      }

      setSummary((previous) => [previous, ...segmentSummaries].filter(Boolean).join('\n\n'));
      setPatterns((previous) => Array.from(new Set([...previous, ...segmentPatterns])));
      setConclusions((previous) => Array.from(new Set([...previous, ...segmentConclusions])));

      // Deduplicate across the overlaps, then store only what has not been stored yet.
      const kept = dedupeFindings(sweptEntriesRef.current);
      const pendingEntries = kept.filter((entry) => !entry.persisted);
      sweptEntriesRef.current = kept;

      if (pendingEntries.length > 0) {
        const created = await createVideoAiFindings(
          context,
          owner,
          pendingEntries.map((entry) => ({
            category: entry.finding.category,
            title: entry.finding.title,
            observation: entry.finding.observation,
            suggestedTags: entry.finding.suggestedTags,
            confidence: entry.finding.confidence,
            videoUrl: analysedVideoUrl,
            timestampSeconds: entry.finding.timestampSeconds,
            startTime: entry.finding.startTime,
            endTime: entry.finding.endTime
          }))
        );
        for (const entry of pendingEntries) entry.persisted = true;
        setFindings((prev) => [...prev, ...created].sort((a, b) => (a.timestampSeconds ?? 0) - (b.timestampSeconds ?? 0)));
      }

      if (stoppedSegmentIndex !== null) {
        setFailedSegmentIndex(stoppedSegmentIndex);
        setError(
          `Segment ${stoppedSegmentIndex + 1} could not be analysed (${stoppedMessage}). Everything found before it has been saved; retry that segment to continue.`
        );
      } else if (pendingEntries.length === 0 && sweptEntriesRef.current.length === 0) {
        setError('The AI analysed the video but did not identify any relevant situation.');
      }
    } catch (analyseError: any) {
      console.error('[AiVideoAnalysisPanel] Analysis failed', analyseError);
      setError(analyseError?.message || 'The video could not be analysed. Please retry.');
    } finally {
      setProgress(null);
      setIsAnalysing(false);
    }
  };

  const patchFinding = (findingId: string, patch: Partial<VideoAiFinding>) => {
    setFindings((prev) => prev.map((item) => (item.id === findingId ? { ...item, ...patch } : item)));
  };

  const handleConfirm = async (finding: VideoAiFinding, wasEdited: boolean): Promise<boolean> => {
    // A confirmed finding already has its clip; re-confirming must never duplicate it.
    if (!canConfirmFinding(finding)) return true;

    setError(null);
    setBusyFindingId(finding.id);

    try {
      await createVideoClipForOwner(owner, buildClipFromFinding(finding, videoUrlDraft.trim(), matchEvents ?? []));

      const updated = await updateVideoAiFinding(finding.id, {
        title: finding.title,
        observation: finding.observation,
        category: finding.category ?? null,
        reviewStatus: wasEdited ? 'edited' : 'confirmed'
      });
      patchFinding(finding.id, updated);
      onClipsCreated?.();
      return true;
    } catch (confirmError: any) {
      console.error('[AiVideoAnalysisPanel] Failed confirming finding', confirmError);
      setError(confirmError?.message || 'The finding could not be saved as a clip.');
      return false;
    } finally {
      setBusyFindingId(null);
    }
  };

  const handleReject = async (finding: VideoAiFinding) => {
    setBusyFindingId(finding.id);
    try {
      const updated = await updateVideoAiFinding(finding.id, { reviewStatus: 'rejected' });
      patchFinding(finding.id, updated);
    } catch (rejectError: any) {
      console.error('[AiVideoAnalysisPanel] Failed rejecting finding', rejectError);
      setError(rejectError?.message || 'The finding could not be rejected.');
    } finally {
      setBusyFindingId(null);
    }
  };

  const pendingFindings = findings.filter((finding) => finding.reviewStatus === 'pending');

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-700">
            <Sparkles className="h-3.5 w-3.5" />
            AI Analysis · {CONTEXT_LABELS[context]}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            The AI proposes situations, tags and clips. Nothing is validated until you confirm it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleAnalyse(0)}
          disabled={isAnalysing || !ownerReady}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#002142] to-sky-900 px-5 py-2.5 text-xs font-black text-white shadow-md transition hover:opacity-95 disabled:opacity-50"
        >
          <Sparkles className={`h-4 w-4 text-cyan-300 ${isAnalysing ? 'animate-spin' : ''}`} />
          {isAnalysing ? 'Analysing video...' : 'Analyse with AI'}
        </button>
      </div>

      {!ownerReady ? (
        <p className="text-xs text-slate-400">{emptyOwnerMessage}</p>
      ) : (
        <>
          <input
            type="url"
            value={videoUrlDraft}
            onChange={(event) => setVideoUrlDraft(event.target.value)}
            placeholder="YouTube video URL to analyse"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500"
          />

          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={ourKitColour}
              onChange={(event) => setOurKitColour(event.target.value)}
              placeholder="Our kit colour (optional)"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500"
            />
            <input
              value={opponentKitColour}
              onChange={(event) => setOpponentKitColour(event.target.value)}
              placeholder="Opponent kit colour (optional)"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500"
            />
          </div>

          {isAnalysing && (
            <p className="text-xs font-bold text-slate-500">
              {progress
                ? `Analysing segment ${progress.current} of ${progress.total}...`
                : 'Analysing video...'}
            </p>
          )}

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <div className="text-xs">
                <p className="font-bold">AI analysis error</p>
                <p className="mt-0.5">{error}</p>
                <button
                  type="button"
                  onClick={() => void handleAnalyse(failedSegmentIndex ?? 0)}
                  disabled={isAnalysing}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-2.5 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {failedSegmentIndex === null ? 'Retry' : `Retry segment ${failedSegmentIndex + 1}`}
                </button>
              </div>
            </div>
          )}

          {summary && (
            <div className="rounded-xl border border-cyan-200 bg-cyan-50/60 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-900">Summary</p>
              <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-800">{summary}</p>
              {patterns.length > 0 && (
                <>
                  <p className="mt-3 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-900">Patterns</p>
                  <ul className="mt-1 list-disc pl-4 text-xs text-slate-800">
                    {patterns.map((pattern, index) => <li key={index}>{pattern}</li>)}
                  </ul>
                </>
              )}
              {conclusions.length > 0 && (
                <>
                  <p className="mt-3 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-900">
                    Preliminary conclusions (not validated)
                  </p>
                  <ul className="mt-1 list-disc pl-4 text-xs text-slate-800">
                    {conclusions.map((conclusion, index) => <li key={index}>{conclusion}</li>)}
                  </ul>
                </>
              )}
              {onAddNarrativeToReport && (
                <button
                  type="button"
                  onClick={() =>
                    onAddNarrativeToReport(
                      formatAiAnalysisBlock(
                        { summary, patterns, conclusions },
                        new Date().toISOString().slice(0, 10)
                      )
                    )
                  }
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-cyan-300 bg-white px-3 py-2 text-xs font-bold text-cyan-800 hover:bg-cyan-50"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Add AI analysis to Match Report
                </button>
              )}
            </div>
          )}

          {isLoading ? (
            <p className="text-xs text-slate-400">Loading AI findings...</p>
          ) : findings.length === 0 ? (
            <p className="text-xs text-slate-400">No AI findings yet. Run "Analyse with AI" to generate proposals.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-700">
                  {findings.length} findings · {pendingFindings.length} pending review
                </p>
              </div>

              {findings.map((finding) => {
                const isPending = finding.reviewStatus === 'pending';
                const isBusy = busyFindingId === finding.id;

                return (
                  <div
                    key={finding.id}
                    className={`rounded-xl border p-3 ${
                      finding.reviewStatus === 'rejected'
                        ? 'border-slate-200 bg-slate-50 opacity-60'
                        : isPending
                          ? 'border-slate-200 bg-white'
                          : 'border-emerald-200 bg-emerald-50/50'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-slate-900 px-2 py-1 font-mono text-[11px] font-black text-cyan-300">
                        {formatVideoTimestamp(finding.timestampSeconds ?? finding.startTime ?? 0)}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                        Confidence {formatConfidence(finding.confidence)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          isPending
                            ? 'bg-amber-100 text-amber-800'
                            : finding.reviewStatus === 'rejected'
                              ? 'bg-slate-200 text-slate-600'
                              : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {finding.reviewStatus}
                      </span>
                      {finding.videoUrl && (
                        <a
                          href={buildVideoUrlAtSecond(finding.videoUrl, finding.startTime ?? finding.timestampSeconds)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-700"
                        >
                          <Film className="h-3.5 w-3.5" />
                          Open clip
                        </a>
                      )}
                    </div>

                    {isPending ? (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <input
                          value={finding.title}
                          onChange={(event) => patchFinding(finding.id, { title: event.target.value })}
                          placeholder="Clip title"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-sky-500"
                        />
                        <select
                          value={finding.category ?? ''}
                          onChange={(event) => patchFinding(finding.id, { category: event.target.value || null })}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-sky-500"
                        >
                          <option value="">No category</option>
                          {taxonomy.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        <textarea
                          value={finding.observation}
                          onChange={(event) => patchFinding(finding.id, { observation: event.target.value })}
                          placeholder="Observation"
                          className="sm:col-span-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none focus:border-sky-500"
                        />
                      </div>
                    ) : (
                      <div className="mt-2">
                        <p className="text-xs font-bold text-slate-800">{finding.title}</p>
                        <p className="mt-0.5 text-xs text-slate-600">{finding.observation}</p>
                      </div>
                    )}

                    {finding.suggestedTags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {finding.suggestedTags.map((tag, index) => (
                          <span key={index} className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {isPending && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleConfirm(finding, false)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Confirm &amp; create clip
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleConfirm(finding, true)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Save edits &amp; confirm
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleReject(finding)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <X className="h-3.5 w-3.5" />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
