import React, { useEffect, useMemo, useState } from 'react';
import { 
  Users, 
  Check, 
  X, 
  Calendar, 
  MapPin, 
  Clock, 
  Sparkles, 
  Copy, 
  Printer, 
  Search, 
  Shield, 
  ArrowRight, 
  AlertTriangle,
  RotateCcw,
  Trophy,
  HeartPulse
} from 'lucide-react';
import { Match, MatchLineupEntry, Injury } from '../types';
import { subscribeToSquadPlayers, type CloudSquadPlayer } from '../services/squad/squadService';
import { subscribeToInjuries } from '../services/physio/injuriesService';
import { confirmSquadCall } from '../services/matches/matchService';
import { 
  getMatchLineup, 
  upsertMatchLineupEntry, 
  removeMatchLineupEntry, 
  batchUpsertMatchLineupEntries 
} from '../services/matches/matchLineupService';
import { PlayerPitchAvatar } from './PlayerPitchAvatar';
import { TeamCrest } from './TeamCrest';
import { getPositionCategory } from '../utils/formations';
import { hasSquadCallChangedSinceConfirmation } from '../utils/matchLineup';

interface MatchCallUpSectionProps {
  matches: Match[];
  selectedTeamId?: string | null;
  currentLogo?: string | null;
  onNavigateToTactics?: (matchId: string) => void;
  onCallupSummaryChange?: (summary: { matchId: string; count: number }) => void;
  onMatchUpdated?: (match: Match) => void;
}

export const MatchCallUpSection: React.FC<MatchCallUpSectionProps> = ({
  matches,
  selectedTeamId,
  currentLogo,
  onNavigateToTactics,
  onCallupSummaryChange,
  onMatchUpdated
}) => {
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');
  const [squadPlayers, setSquadPlayers] = useState<CloudSquadPlayer[]>([]);
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [lineupEntries, setLineupEntries] = useState<MatchLineupEntry[]>([]);
  const [loadedLineupMatchId, setLoadedLineupMatchId] = useState<string | null>(null);
  const [isLoadingLineup, setIsLoadingLineup] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState<'ALL' | 'GK' | 'DEF' | 'MID' | 'FWD'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CALLED' | 'UNCALLED'>('ALL');
  const [isCopied, setIsCopied] = useState(false);
  const [meetingTime, setMeetingTime] = useState('16:45');
  const [meetingLocation, setMeetingLocation] = useState('Al Ula Sports Complex - Home Dressing Room');
  const [callupNotes, setCallupNotes] = useState('Official Kit 1 (Green/Yellow). Bring shin guards and mixed-stud boots.');
  const [targetQuota, setTargetQuota] = useState<18 | 20>(18);

  // Set default selected match to the next upcoming match or the first one
  useEffect(() => {
    if (matches.length > 0 && !selectedMatchId) {
      const today = new Date().toISOString().slice(0, 10);
      const nextUpcoming = matches.find((m) => m.status === 'planned' && m.date >= today);
      setSelectedMatchId(nextUpcoming ? nextUpcoming.id : matches[0].id);
    }
  }, [matches, selectedMatchId]);

  // Subscribe to real Squad Players
  useEffect(() => {
    const unsub = subscribeToSquadPlayers(
      (players) => setSquadPlayers(players),
      (err) => console.warn('[MatchCallUpSection] Squad subscription error:', err)
    );
    return () => unsub();
  }, []);

  // Subscribe to Injuries for Physio health warnings
  useEffect(() => {
    if (!selectedTeamId) return;
    const unsub = subscribeToInjuries(
      selectedTeamId,
      (injList) => setInjuries(injList),
      (err) => console.warn('[MatchCallUpSection] Injuries subscription error:', err)
    );
    return () => unsub();
  }, [selectedTeamId]);

  // Load lineup entries whenever the selected match changes
  useEffect(() => {
    if (!selectedMatchId) {
      setLineupEntries([]);
      return;
    }

    let active = true;
    setIsLoadingLineup(true);
    setLoadedLineupMatchId(null);
    setLineupEntries([]);
    void (async () => {
      try {
        const entries = await getMatchLineup(selectedMatchId);
        if (active) {
          setLineupEntries(entries);
          setLoadedLineupMatchId(selectedMatchId);
        }
      } catch (e) {
        console.error('[MatchCallUpSection] Failed loading match lineup:', e);
        if (active) {
          setLineupEntries([]);
          setLoadedLineupMatchId(selectedMatchId);
        }
      } finally {
        if (active) setIsLoadingLineup(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [selectedMatchId]);

  useEffect(() => {
    if (!selectedMatchId || isLoadingLineup || loadedLineupMatchId !== selectedMatchId) return;
    onCallupSummaryChange?.({ matchId: selectedMatchId, count: lineupEntries.length });
  }, [isLoadingLineup, lineupEntries.length, loadedLineupMatchId, onCallupSummaryChange, selectedMatchId]);

  const currentMatch = useMemo(() => {
    return matches.find((m) => m.id === selectedMatchId) || null;
  }, [matches, selectedMatchId]);

  // Map players to their injury status
  const injuryMap = useMemo(() => {
    const map = new Map<string, Injury>();
    injuries.forEach((inj) => {
      if (inj.currentStatus && inj.currentStatus !== 'closed') {
        map.set(inj.playerId, inj);
      }
    });
    return map;
  }, [injuries]);

  const calledPlayerIds = useMemo(() => new Set(lineupEntries.map((e) => e.playerId)), [lineupEntries]);
  const calledPlayerIdList = useMemo(() => lineupEntries.map((entry) => entry.playerId).sort(), [lineupEntries]);

  const isSquadCallConfirmed = Boolean(currentMatch?.squadCallConfirmedAt);
  const hasPendingConfirmationChanges = isSquadCallConfirmed && hasSquadCallChangedSinceConfirmation(
    currentMatch?.squadCallConfirmedPlayerIds,
    calledPlayerIdList
  );
  const squadCallStatusLabel = hasPendingConfirmationChanges
    ? 'Changes Pending'
    : isSquadCallConfirmed
      ? 'Squad Confirmed'
      : 'Pending confirmation';

  // Positional breakdown of called-up squad
  const positionalCounts = useMemo(() => {
    let gk = 0;
    let def = 0;
    let mid = 0;
    let fwd = 0;

    lineupEntries.forEach((entry) => {
      const player = squadPlayers.find((p) => p.id === entry.playerId);
      const pos = entry.position || player?.position;
      const cat = getPositionCategory(pos);
      if (cat === 'GK') gk++;
      else if (cat === 'DEF') def++;
      else if (cat === 'MID') mid++;
      else if (cat === 'FWD') fwd++;
    });

    return { gk, def, mid, fwd, total: lineupEntries.length };
  }, [lineupEntries, squadPlayers]);

  // Handle setting a player's call-up status (Called Up vs Not Called Up)
  const handleSetCallupStatus = async (player: CloudSquadPlayer, isCalled: boolean) => {
    if (!selectedMatchId) return;

    const existing = lineupEntries.find((e) => e.playerId === player.id);

    try {
      if (!isCalled) {
        if (existing) {
          setLineupEntries((prev) => prev.filter((e) => e.id !== existing.id));
          await removeMatchLineupEntry(existing.id);
        }
      } else {
        const entryPayload: Partial<MatchLineupEntry> & Pick<MatchLineupEntry, 'matchId' | 'playerId'> = {
          id: existing?.id,
          matchId: selectedMatchId,
          playerId: player.id,
          starter: existing?.starter ?? false,
          position: existing?.position || player.position || 'UTIL',
          shirtNumber: player.number ? Number(player.number) : (existing?.shirtNumber ?? null),
          pitchX: existing?.pitchX ?? null,
          pitchY: existing?.pitchY ?? null,
          captain: existing?.captain ?? false,
          notes: existing?.notes ?? null
        };

        const saved = await upsertMatchLineupEntry(entryPayload);
        setLineupEntries((prev) => {
          const filtered = prev.filter((e) => e.playerId !== player.id);
          return [...filtered, saved];
        });
      }
    } catch (err) {
      console.error('[MatchCallUpSection] Error updating callup status:', err);
      const fresh = await getMatchLineup(selectedMatchId);
      setLineupEntries(fresh);
    }
  };

  // Smart Auto-Callup: Pick optimal squad of 18 or 20 players
  const handleAutoCallup = async () => {
    if (!selectedMatchId || squadPlayers.length === 0) return;

    // Filter out injured players
    const available = squadPlayers.filter((p) => {
      const inj = injuryMap.get(p.id);
      return !inj;
    });

    const gks = available.filter((p) => getPositionCategory(p.position) === 'GK');
    const defs = available.filter((p) => getPositionCategory(p.position) === 'DEF');
    const mids = available.filter((p) => getPositionCategory(p.position) === 'MID');
    const fwds = available.filter((p) => getPositionCategory(p.position) === 'FWD');

    const selectedList: CloudSquadPlayer[] = [];

    // Target distributions:
    // 18 quota: 2 GK, 6 DEF, 6 MID, 4 FWD
    // 20 quota: 2-3 GK, 7 DEF, 7 MID, 4 FWD
    const numGk = Math.min(gks.length, 2);
    selectedList.push(...gks.slice(0, numGk));

    const numDef = Math.min(defs.length, targetQuota === 18 ? 6 : 7);
    selectedList.push(...defs.slice(0, numDef));

    const numMid = Math.min(mids.length, targetQuota === 18 ? 6 : 7);
    selectedList.push(...mids.slice(0, numMid));

    const numFwd = Math.min(fwds.length, 4);
    selectedList.push(...fwds.slice(0, numFwd));

    // Fill remaining spots from whatever available
    const alreadySelected = new Set(selectedList.map((p) => p.id));
    const leftovers = available.filter((p) => !alreadySelected.has(p.id));
    
    while (selectedList.length < targetQuota && leftovers.length > 0) {
      selectedList.push(leftovers.shift()!);
    }

    const batchPayload: Array<Partial<MatchLineupEntry> & Pick<MatchLineupEntry, 'matchId' | 'playerId'>> = [];

    selectedList.forEach((player) => {
      const existing = lineupEntries.find((e) => e.playerId === player.id);

      batchPayload.push({
        id: existing?.id,
        matchId: selectedMatchId,
        playerId: player.id,
        starter: existing?.starter ?? false,
        position: existing?.position || player.position || 'UTIL',
        pitchX: existing?.pitchX ?? null,
        pitchY: existing?.pitchY ?? null,
        shirtNumber: player.number ? Number(player.number) : null,
        captain: existing?.captain ?? false,
        notes: existing?.notes ?? null
      });
    });

    try {
      await batchUpsertMatchLineupEntries(batchPayload);
      const fresh = await getMatchLineup(selectedMatchId);
      setLineupEntries(fresh);
    } catch (e) {
      console.error('[MatchCallUpSection] Error auto-generating callup:', e);
    }
  };

  // Clear all call-up entries for the match
  const handleClearCallup = async () => {
    if (!selectedMatchId || lineupEntries.length === 0) return;
    if (!confirm('Are you sure you want to clear the matchday call-up list for this match?')) return;

    try {
      for (const entry of lineupEntries) {
        await removeMatchLineupEntry(entry.id);
      }
      setLineupEntries([]);
    } catch (e) {
      console.error('[MatchCallUpSection] Error clearing callup:', e);
    }
  };

  const handleConfirmSquad = async () => {
    if (!selectedMatchId || lineupEntries.length === 0) return;
    try {
      const updatedMatch = await confirmSquadCall(selectedMatchId, calledPlayerIdList);
      onMatchUpdated?.(updatedMatch);
    } catch (error) {
      console.error('[MatchCallUpSection] Error confirming squad call:', error);
      alert(error instanceof Error ? error.message : 'Unable to confirm squad call.');
    }
  };

  // Copy formatted call-up to clipboard for WhatsApp / Team Messaging in English
  const handleCopyCallupText = () => {
    if (!currentMatch) return;

    const opp = currentMatch.opponentName || currentMatch.opponentTeamId;
    const dateStr = currentMatch.date;
    const timeStr = currentMatch.time || '18:30';
    const venueStr = currentMatch.venue || 'Al Ula Sports Complex';

    let text = `📢 *OFFICIAL MATCH CALL-UP - AL ULA FC U17*\n`;
    text += `⚽ *Match:* Al Ula FC vs ${opp}\n`;
    text += `🏆 *Competition:* ${currentMatch.competitionName}\n`;
    text += `📅 *Date:* ${dateStr} | ⏰ *Kick-off:* ${timeStr}\n`;
    text += `📍 *Venue:* ${venueStr}\n`;
    text += `🕒 *Meeting:* ${meetingTime} at ${meetingLocation}\n\n`;

    text += `📋 *CALLED-UP SQUAD (${lineupEntries.length} Players):*\n`;
    lineupEntries.forEach((entry, i) => {
      const p = squadPlayers.find((sp) => sp.id === entry.playerId);
      const name = p ? `${p.firstName} ${p.lastName}` : 'Player';
      const num = entry.shirtNumber ?? p?.number ?? '-';
      text += `${i + 1}. #${num} ${name} (${entry.position || p?.position || '–'})\n`;
    });

    if (callupNotes.trim()) {
      text += `\n📝 *Instructions & Notes:* ${callupNotes}\n`;
    }

    navigator.clipboard.writeText(text).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    });
  };

  // Print Matchday Callup Sheet
  const handlePrint = () => {
    window.print();
  };

  // Filter squad list
  const filteredSquad = useMemo(() => {
    return squadPlayers.filter((player) => {
      const isCalled = calledPlayerIds.has(player.id);

      // Status filter (ALL, CALLED, UNCALLED)
      if (statusFilter === 'CALLED' && !isCalled) return false;
      if (statusFilter === 'UNCALLED' && isCalled) return false;

      // Position filter
      if (positionFilter !== 'ALL' && getPositionCategory(player.position) !== positionFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const fullName = `${player.firstName} ${player.lastName}`.toLowerCase();
        const num = String(player.number || '');
        const pos = (player.position || '').toLowerCase();
        if (!fullName.includes(q) && !num.includes(q) && !pos.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [squadPlayers, calledPlayerIds, statusFilter, positionFilter, searchQuery]);

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Printable Sheet (hidden on screen, formatted for official printing) */}
      <div className="hidden print:block print:p-8 bg-white text-black font-sans">
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4 mb-6">
          <div className="flex items-center gap-4">
            <TeamCrest name="Al Ula FC" logoUrl={currentLogo} isAlula className="h-16 w-16" />
            <div>
              <h1 className="text-2xl font-black uppercase tracking-wide">AL ULA FC - OFFICIAL MATCH CALL-UP SHEET</h1>
              <p className="text-sm font-bold text-slate-700">{currentMatch?.competitionName} • Official Season</p>
            </div>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold">Date: {currentMatch?.date}</p>
            <p className="font-bold">Kick-off: {currentMatch?.time || '18:30'}</p>
            <p className="text-slate-600">Meeting: {meetingTime}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6 text-xs border border-slate-300 rounded-lg p-3 bg-slate-50">
          <div>
            <p><strong>Match:</strong> Al Ula FC vs {currentMatch?.opponentName || currentMatch?.opponentTeamId}</p>
            <p><strong>Venue / Stadium:</strong> {currentMatch?.venue || 'Al Ula Sports Complex'}</p>
          </div>
          <div>
            <p><strong>Meeting Point:</strong> {meetingLocation}</p>
            <p><strong>Total Called-Up:</strong> {lineupEntries.length} players</p>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-sm font-black uppercase border-b-2 border-emerald-700 pb-1 mb-3 text-emerald-900">
            Called-Up Squad ({lineupEntries.length} Players)
          </h2>
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="py-1 w-10">#</th>
                <th className="py-1">Player Name</th>
                <th className="py-1 text-center">Position</th>
                <th className="py-1 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {lineupEntries.map((entry, idx) => {
                const p = squadPlayers.find((sp) => sp.id === entry.playerId);
                return (
                  <tr key={entry.id} className="border-b border-slate-100">
                    <td className="py-1.5 font-bold font-mono">{entry.shirtNumber ?? p?.number ?? idx + 1}</td>
                    <td className="py-1.5 font-semibold">{p ? `${p.firstName} ${p.lastName}` : 'Player'}</td>
                    <td className="py-1.5 text-center font-mono text-slate-600">{entry.position || p?.position || '–'}</td>
                    <td className="py-1.5 text-right font-bold text-emerald-700">Called Up</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {callupNotes && (
          <div className="border-t border-slate-300 pt-3 text-xs">
            <p className="font-bold text-slate-700">Technical Staff Notes & Instructions:</p>
            <p className="text-slate-600 italic">{callupNotes}</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-8 mt-12 pt-6 border-t border-slate-300 text-center text-xs">
          <div>
            <div className="border-b border-slate-400 mb-2 h-12" />
            <p className="font-bold">Head Coach Signature</p>
          </div>
          <div>
            <div className="border-b border-slate-400 mb-2 h-12" />
            <p className="font-bold">Team Delegate Signature</p>
          </div>
          <div>
            <div className="border-b border-slate-400 mb-2 h-12" />
            <p className="font-bold">Team Captain Signature</p>
          </div>
        </div>
      </div>

      {/* Screen View (hidden when printing) */}
      <div className="print:hidden space-y-6">
        {/* Header & Match Selector Card */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800">
                  Squad Call-Up Manager
                </span>
                <span className="text-xs font-bold text-slate-500">
                  Official Match Roster
                </span>
              </div>
              <h2 className="mt-1 text-xl font-black text-[#002142] font-display">
                Matchday Call-Up & Official Squad
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Select players called up for the match, manage squad quotas, and export the official call-up sheet for players and technical staff.
              </p>
            </div>

            {/* Match Selector Dropdown */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Select Match:
                </label>
                <select
                  value={selectedMatchId}
                  onChange={(e) => setSelectedMatchId(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black text-slate-800 shadow-2xs focus:border-emerald-500 focus:bg-white focus:outline-none cursor-pointer"
                >
                  {matches.map((m) => {
                    const opp = m.opponentName || m.opponentTeamId;
                    const dateFormatted = m.date;
                    return (
                      <option key={m.id} value={m.id}>
                        {m.isHome ? 'Vs.' : '@'} {opp} ({dateFormatted}) - {m.competitionName}
                      </option>
                    );
                  })}
                </select>
              </div>

              {onNavigateToTactics && selectedMatchId && (
                <button
                  type="button"
                  onClick={() => onNavigateToTactics(selectedMatchId)}
                  className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[#002142] hover:bg-[#09355e] px-4 py-2.5 text-xs font-black text-white shadow-sm transition-all cursor-pointer"
                  title="Open tactical board for this match"
                >
                  <Shield className="h-4 w-4 text-emerald-400" />
                  <span>Go to Tactical Board</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Current Match Highlight Strip */}
          {currentMatch && (
            <div className="mt-5 rounded-2xl bg-gradient-to-r from-slate-900 to-[#002142] p-4 text-white shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/20 border border-amber-400/30 text-amber-400">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase text-amber-400">
                        {currentMatch.competitionName}
                      </span>
                      <span className="text-[10px] text-slate-300 font-bold">
                        {currentMatch.isHome ? '• Home Match' : '• Away Match'}
                      </span>
                    </div>
                    <p className="text-sm font-black font-display">
                      Al Ula FC vs. {currentMatch.opponentName || currentMatch.opponentTeamId}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-emerald-400" />
                    <span>{currentMatch.date}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-emerald-400" />
                    <span>{currentMatch.time || '18:30'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-emerald-400" />
                    <span>{currentMatch.venue || 'Al Ula Sports Complex'}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-sky-200">Squad Call</p>
                  <p className="mt-1 text-sm font-black text-white">{lineupEntries.length} Players</p>
                  <p className={`mt-0.5 text-xs font-bold ${hasPendingConfirmationChanges ? 'text-amber-200' : isSquadCallConfirmed ? 'text-emerald-200' : 'text-slate-300'}`}>
                    {hasPendingConfirmationChanges ? '⚠ Changes Pending' : isSquadCallConfirmed ? '✓ Squad Confirmed' : 'Pending confirmation'}
                  </p>
                </div>
                {(!isSquadCallConfirmed || hasPendingConfirmationChanges) && (
                  <button
                    type="button"
                    onClick={() => void handleConfirmSquad()}
                    disabled={lineupEntries.length === 0}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-slate-950 shadow-sm hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    Confirm Squad
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quota Stats & Positional Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Total Counter Card */}
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Total Call-Up
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-2xl font-black text-[#002142] font-display">
                  {lineupEntries.length}
                </span>
                <span className="text-xs font-bold text-slate-400">/ {targetQuota} target</span>
              </div>
            </div>
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
              lineupEntries.length === targetQuota
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                : lineupEntries.length > targetQuota
                ? 'bg-amber-50 text-amber-600 border-amber-200'
                : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}>
              <Users className="h-6 w-6" />
            </div>
          </div>

          {/* Call-up Status Summary */}
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Call-Up Status
              </span>
              <div className="flex flex-col gap-1 mt-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-emerald-100 px-2 py-0.5 text-xs font-black text-emerald-800">
                    {lineupEntries.length} Called Up
                  </span>
                  <span className={`rounded-lg px-2 py-0.5 text-xs font-black ${hasPendingConfirmationChanges ? 'bg-amber-100 text-amber-800' : isSquadCallConfirmed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                    {squadCallStatusLabel}
                  </span>
                  <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                    {Math.max(0, squadPlayers.length - lineupEntries.length)} Not Called
                  </span>
                </div>
              </div>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Shield className="h-6 w-6" />
            </div>
          </div>

          {/* Positional Balance Card */}
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm col-span-1 md:col-span-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Positional Balance
            </span>
            <div className="grid grid-cols-4 gap-2 mt-1.5 text-center">
              <div className="rounded-xl bg-slate-50 p-1.5 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Goalkeepers</span>
                <p className="text-sm font-black text-slate-800">{positionalCounts.gk}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-1.5 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Defenders</span>
                <p className="text-sm font-black text-slate-800">{positionalCounts.def}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-1.5 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Midfielders</span>
                <p className="text-sm font-black text-slate-800">{positionalCounts.mid}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-1.5 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Forwards</span>
                <p className="text-sm font-black text-slate-800">{positionalCounts.fwd}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls & Utilities Bar */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
          {/* Left Actions: Auto Callup & Target Quota */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-2xl bg-slate-100 p-1 text-xs font-bold text-slate-600">
              <span className="px-2 text-[10px] uppercase font-black text-slate-400">Quota:</span>
              <button
                type="button"
                onClick={() => setTargetQuota(18)}
                className={`rounded-xl px-2.5 py-1 transition-all cursor-pointer ${
                  targetQuota === 18 ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                18 Players
              </button>
              <button
                type="button"
                onClick={() => setTargetQuota(20)}
                className={`rounded-xl px-2.5 py-1 transition-all cursor-pointer ${
                  targetQuota === 20 ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                20 Players
              </button>
            </div>

            <button
              type="button"
              onClick={handleAutoCallup}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-black text-white shadow-xs transition-colors cursor-pointer"
              title="Automatically select balanced squad (excluding injured players)"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Auto Call-Up ({targetQuota})</span>
            </button>

            {lineupEntries.length > 0 && (
              <button
                type="button"
                onClick={handleClearCallup}
                className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-colors cursor-pointer"
                title="Clear all called-up players"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Clear List</span>
              </button>
            )}
          </div>

          {/* Right Actions: Export, WhatsApp Copy, Print */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyCallupText}
              className={`inline-flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-black transition-all shadow-xs cursor-pointer ${
                isCopied
                  ? 'bg-emerald-700 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-white'
              }`}
              title="Copy formatted squad call-up text for WhatsApp or team messaging"
            >
              {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{isCopied ? 'Copied to Clipboard!' : 'Copy for WhatsApp'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
              title="Print or export as PDF official match call-up sheet"
            >
              <Printer className="h-3.5 w-3.5 text-slate-500" />
              <span>Print Official Sheet</span>
            </button>
          </div>
        </div>

        {/* Meeting & Logistics Details */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-black text-[#002142] font-display">
                Meeting Details & Match Logistics
              </h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400">
              Included in the WhatsApp message and printed call-up sheet
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                Meeting / Arrival Time:
              </label>
              <input
                type="text"
                value={meetingTime}
                onChange={(e) => setMeetingTime(e.target.value)}
                placeholder="16:45"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                Meeting Location / Dressing Room:
              </label>
              <input
                type="text"
                value={meetingLocation}
                onChange={(e) => setMeetingLocation(e.target.value)}
                placeholder="Al Ula Sports Complex - Home Dressing Room"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                Kit / Staff Instructions:
              </label>
              <input
                type="text"
                value={callupNotes}
                onChange={(e) => setCallupNotes(e.target.value)}
                placeholder="Official Kit 1 (Green/Yellow). Bring shin guards."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Squad Selection Grid & Status Filter */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-[#002142] font-display">
                Squad Roster & Player Selection ({squadPlayers.length})
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Assign each player's status for this match: Called Up or Not Called Up.
              </p>
            </div>

            {/* Filter Tabs: ALL, CALLED UP, NOT CALLED UP */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-2xl bg-slate-100 p-1 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={`rounded-xl px-3 py-1.5 transition-all cursor-pointer ${
                    statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All ({squadPlayers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('CALLED')}
                  className={`rounded-xl px-3 py-1.5 transition-all cursor-pointer ${
                    statusFilter === 'CALLED' ? 'bg-emerald-600 text-white shadow-2xs font-black' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Called Up ({lineupEntries.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('UNCALLED')}
                  className={`rounded-xl px-3 py-1.5 transition-all cursor-pointer ${
                    statusFilter === 'UNCALLED' ? 'bg-white text-slate-900 shadow-2xs font-black' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Not Called Up ({Math.max(0, squadPlayers.length - lineupEntries.length)})
                </button>
              </div>
            </div>
          </div>

          {/* Position & Search Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              {(['ALL', 'GK', 'DEF', 'MID', 'FWD'] as const).map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => setPositionFilter(pos)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer ${
                    positionFilter === pos
                      ? 'bg-[#002142] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {pos === 'ALL' ? 'All Positions' : pos === 'GK' ? 'Goalkeepers' : pos === 'DEF' ? 'Defenders' : pos === 'MID' ? 'Midfielders' : 'Forwards'}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, number, position..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Players Roster Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredSquad.map((player) => {
              const entry = lineupEntries.find((e) => e.playerId === player.id);
              const isCalled = Boolean(entry);
              const injury = injuryMap.get(player.id);
              const isInjured = Boolean(injury);

              return (
                <div
                  key={player.id}
                  className={`rounded-2xl border p-3.5 transition-all flex flex-col justify-between gap-3.5 ${
                    isCalled
                      ? 'bg-emerald-50/70 border-emerald-300 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <PlayerPitchAvatar
                        photoUrl={player.photoUrl}
                        shirtNumber={player.number}
                        fallbackNumber="–"
                        sizeClassName="h-10 w-10"
                        className="shrink-0 bg-slate-100 text-sm font-black text-slate-700 border border-slate-200 shadow-2xs"
                        alt={`${player.firstName} ${player.lastName}`}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black text-slate-900">
                          {player.firstName} {player.lastName}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold">
                          <span>#{player.number ?? '–'}</span>
                          <span>•</span>
                          <span>{player.position || 'Player'}</span>
                          {entry?.shirtNumber && entry.shirtNumber !== player.number && (
                            <span className="text-emerald-700 font-black">(Squad #{entry.shirtNumber})</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status indicator badge */}
                    <div>
                      {isCalled ? (
                        <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-black uppercase text-white shadow-2xs">
                          Called Up
                        </span>
                      ) : isInjured ? (
                        <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                          <HeartPulse className="h-3 w-3 text-rose-600" />
                          Injured
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-500">
                          Not Called Up
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Injury Warning if applicable */}
                  {isInjured && injury && (
                    <div className="flex items-center gap-1.5 rounded-xl bg-rose-50 border border-rose-200 p-2 text-[10px] font-bold text-rose-800">
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                      <span className="truncate">Medical Alert: {injury.clinicalDiagnosis || injury.finalDiagnosis || injury.location || 'In recovery'}</span>
                    </div>
                  )}

                  {/* 2-Option Selector: Called Up vs Not Called Up */}
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-[11px] font-black">
                    <button
                      type="button"
                      onClick={() => handleSetCallupStatus(player, true)}
                      className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 transition-all cursor-pointer ${
                        isCalled
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Called Up</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetCallupStatus(player, false)}
                      className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 transition-all cursor-pointer ${
                        !isCalled
                          ? 'bg-white text-slate-800 shadow-2xs font-bold'
                          : 'text-slate-400 hover:bg-slate-200 hover:text-slate-800'
                      }`}
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Not Called Up</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredSquad.length === 0 && (
            <div className="py-12 text-center text-xs text-slate-400">
              No players found matching the selected filters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
