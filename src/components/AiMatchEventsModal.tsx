import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Video,
  Check,
  Plus,
  Play,
  RotateCcw,
  AlertCircle,
  HelpCircle,
  Flag,
  Flame,
  User,
  Clock,
  ChevronRight
} from 'lucide-react';
import type { Match, MatchEvent, MatchEventType, SquadPlayer, TeamSide } from '../types';

interface AiGeneratedEvent {
  minute: number;
  videoTimestampSeconds: number;
  eventType: MatchEventType;
  teamSide: TeamSide;
  playerId?: string | null;
  playerName?: string;
  relatedPlayerId?: string | null;
  relatedPlayerName?: string;
  description: string;
  selected?: boolean;
}

interface AiMatchEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match;
  squadPlayers: SquadPlayer[];
  onApplyEvents: (
    events: Array<Omit<MatchEvent, 'id' | 'createdAt'>>,
    replaceExisting: boolean
  ) => Promise<void>;
  existingEventsCount: number;
}

function formatVideoTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

type MatchEventInput = Omit<MatchEvent, 'id' | 'createdAt'>;

const ALLOWED_EVENT_TYPES: MatchEventType[] = [
  'goal',
  'opponent_goal',
  'corner',
  'opponent_corner',
  'assist',
  'yellow_card',
  'red_card',
  'substitution_in',
  'substitution_out',
  'own_goal',
  'injury',
  'other'
];

const substitutionKey = (event: MatchEventInput): string =>
  `${event.eventType}|${event.minute}|${event.playerId}|${event.relatedPlayerId}`;

/**
 * The minutes-played logic pairs each substitution_out with its mirrored substitution_in,
 * so complete the missing counterpart when the AI only returns one side.
 */
function withMirroredSubstitutions(inputs: MatchEventInput[]): MatchEventInput[] {
  const existingKeys = new Set(inputs.map(substitutionKey));
  const mirrored: MatchEventInput[] = [];

  for (const event of inputs) {
    if (event.eventType !== 'substitution_in' && event.eventType !== 'substitution_out') continue;
    if (event.teamSide !== 'our_team' || !event.playerId || !event.relatedPlayerId) continue;

    const counterpart: MatchEventInput = {
      ...event,
      eventType: event.eventType === 'substitution_out' ? 'substitution_in' : 'substitution_out',
      playerId: event.relatedPlayerId,
      relatedPlayerId: event.playerId
    };
    const key = substitutionKey(counterpart);
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);
    mirrored.push(counterpart);
  }

  return [...inputs, ...mirrored];
}

export const AiMatchEventsModal: React.FC<AiMatchEventsModalProps> = ({
  isOpen,
  onClose,
  match,
  squadPlayers,
  onApplyEvents,
  existingEventsCount
}) => {
  const [videoUrl, setVideoUrl] = useState(match.videoUrl || '');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiWarning, setAiWarning] = useState<string | null>(null);
  const [generatedEvents, setGeneratedEvents] = useState<AiGeneratedEvent[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(false);

  if (!isOpen) return null;

  const opponentName = match.opponentName || 'Rival';
  const homeName = match.isHome ? 'Al-Ula FC' : opponentName;
  const awayName = match.isHome ? opponentName : 'Al-Ula FC';

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setAiWarning(null);

    try {
      const response = await fetch('/api/match/generate-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: match.id,
          videoUrl: videoUrl.trim(),
          additionalNotes: additionalNotes.trim(),
          matchContext: {
            homeTeam: homeName,
            awayTeam: awayName,
            isHome: match.isHome,
            competition: match.competitionName,
            date: match.date,
            squad: squadPlayers.map((p) => ({
              id: p.id,
              name: `${p.firstName} ${p.lastName}`.trim(),
              shirtNumber: p.number,
              position: p.position
            }))
          }
        })
      });

      const rawText = await response.text();
      let data: any = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch (parseErr) {
        throw new Error(`Respuesta no válida del servidor (HTTP ${response.status}).`);
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || `Error del servidor al generar eventos (HTTP ${response.status}).`);
      }

      setAiSummary(data.summary || '');
      setAiWarning(data.isFallback ? (data.fallbackReason || 'La IA no está disponible: se muestra una plantilla táctica base editable.') : null);

      const knownPlayerIds = new Set(squadPlayers.map((p) => p.id));
      const playerIdByName = new Map(
        squadPlayers.map((p) => [`${p.firstName} ${p.lastName}`.trim().toLowerCase(), p.id])
      );
      // player_id / related_player_id are foreign keys to squad_players, so drop unknown ids.
      const resolvePlayerId = (id: unknown, name: unknown): string | null => {
        if (typeof id === 'string' && knownPlayerIds.has(id)) return id;
        if (typeof name === 'string') {
          return playerIdByName.get(name.trim().toLowerCase()) ?? null;
        }
        return null;
      };

      const initialEvents: AiGeneratedEvent[] = (data.events || []).map((e: any) => ({
        minute: typeof e.minute === 'number' ? e.minute : 0,
        videoTimestampSeconds: typeof e.videoTimestampSeconds === 'number' ? e.videoTimestampSeconds : (Number(e.minute) || 0) * 60,
        eventType: (ALLOWED_EVENT_TYPES.includes(e.eventType) ? e.eventType : 'other') as MatchEventType,
        teamSide: (e.teamSide === 'opponent' ? 'opponent' : 'our_team') as TeamSide,
        playerId: resolvePlayerId(e.playerId, e.playerName),
        playerName: e.playerName || '',
        relatedPlayerId: resolvePlayerId(e.relatedPlayerId, e.relatedPlayerName),
        relatedPlayerName: e.relatedPlayerName || '',
        description: e.description || '',
        selected: true
      }));

      // Sort chronologically by timestamp
      initialEvents.sort((a, b) => a.videoTimestampSeconds - b.videoTimestampSeconds);
      setGeneratedEvents(initialEvents);
    } catch (err: any) {
      console.error('[AiMatchEventsModal] Generation failed:', err);
      setError(err?.message || 'No se pudieron generar los eventos con IA. Puedes reintentar o usar la plantilla base sugerida.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateFallbackTemplate = () => {
    setError(null);
    setAiWarning(null);
    setAiSummary('Plantilla base sugerida con distribución táctica de eventos estándar (Goles, Córners y Sustituciones).');
    
    const p1 = squadPlayers[0];
    const p2 = squadPlayers[1] || squadPlayers[0];
    const p3 = squadPlayers[2] || squadPlayers[0];

    const fallbackList: AiGeneratedEvent[] = [
      {
        minute: 12,
        videoTimestampSeconds: 720,
        eventType: 'corner',
        teamSide: 'our_team',
        playerId: p1 ? p1.id : null,
        playerName: p1 ? `${p1.firstName} ${p1.lastName}` : 'Nuestra jugadora',
        relatedPlayerId: null,
        relatedPlayerName: '',
        description: 'Córner a favor botado desde el sector derecho al primer palo.',
        selected: true
      },
      {
        minute: 28,
        videoTimestampSeconds: 1680,
        eventType: 'goal',
        teamSide: 'our_team',
        playerId: p2 ? p2.id : null,
        playerName: p2 ? `${p2.firstName} ${p2.lastName}` : 'Nuestra jugadora',
        relatedPlayerId: p1 ? p1.id : null,
        relatedPlayerName: p1 ? `${p1.firstName} ${p1.lastName}` : '',
        description: 'Gol tras remate dentro del área culminando una jugada elaborada.',
        selected: true
      },
      {
        minute: 41,
        videoTimestampSeconds: 2460,
        eventType: 'opponent_corner',
        teamSide: 'opponent',
        playerId: null,
        playerName: opponentName,
        relatedPlayerId: null,
        relatedPlayerName: '',
        description: 'Córner rival botado al segundo palo defendido por nuestra zaga.',
        selected: true
      },
      {
        minute: 55,
        videoTimestampSeconds: 3300,
        eventType: 'substitution_in',
        teamSide: 'our_team',
        playerId: p3 ? p3.id : null,
        playerName: p3 ? `${p3.firstName} ${p3.lastName}` : 'Nuestra jugadora',
        relatedPlayerId: p1 ? p1.id : null,
        relatedPlayerName: p1 ? `${p1.firstName} ${p1.lastName}` : '',
        description: 'Sustitución táctica para refrescar el centro del campo.',
        selected: true
      },
      {
        minute: 68,
        videoTimestampSeconds: 4080,
        eventType: 'opponent_goal',
        teamSide: 'opponent',
        playerId: null,
        playerName: opponentName,
        relatedPlayerId: null,
        relatedPlayerName: '',
        description: 'Gol del equipo rival en transición ofensiva rápida.',
        selected: true
      },
      {
        minute: 82,
        videoTimestampSeconds: 4920,
        eventType: 'goal',
        teamSide: 'our_team',
        playerId: p1 ? p1.id : null,
        playerName: p1 ? `${p1.firstName} ${p1.lastName}` : 'Nuestra jugadora',
        relatedPlayerId: p3 ? p3.id : null,
        relatedPlayerName: p3 ? `${p3.firstName} ${p3.lastName}` : '',
        description: 'Gol decisivo en los minutos finales tras disparo ajustado.',
        selected: true
      }
    ];

    setGeneratedEvents(fallbackList);
  };

  const toggleEventSelected = (index: number) => {
    setGeneratedEvents((prev) =>
      prev.map((item, i) => (i === index ? { ...item, selected: !item.selected } : item))
    );
  };

  const toggleAllSelected = () => {
    const allSelected = generatedEvents.every((e) => e.selected);
    setGeneratedEvents((prev) => prev.map((e) => ({ ...e, selected: !allSelected })));
  };

  const updateEventField = (index: number, field: keyof AiGeneratedEvent, value: any) => {
    setGeneratedEvents((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        if (field === 'eventType') {
          if (value === 'opponent_goal' || value === 'opponent_corner') {
            updated.teamSide = 'opponent';
          } else if (value === 'goal' || value === 'corner') {
            updated.teamSide = 'our_team';
          }
        }
        return updated;
      })
    );
  };

  const handleApply = async () => {
    const selectedList = generatedEvents.filter((e) => e.selected);
    if (selectedList.length === 0) {
      setError('Por favor selecciona al menos un evento para importar.');
      return;
    }

    setIsApplying(true);
    setError(null);

    try {
      const inputs: MatchEventInput[] = selectedList.map((e) => ({
        matchId: match.id,
        playerId: e.playerId || null,
        teamSide: e.teamSide,
        eventType: e.eventType,
        minute: e.minute,
        videoTimestampSeconds: e.videoTimestampSeconds,
        relatedPlayerId: e.relatedPlayerId || null,
        description: e.description
      }));

      await onApplyEvents(withMirroredSubstitutions(inputs), replaceExisting);
      onClose();
    } catch (err: any) {
      console.error('[AiMatchEventsModal] Apply failed:', err);
      setError(err?.message || 'Error al guardar los eventos en el partido.');
    } finally {
      setIsApplying(false);
    }
  };

  const selectedCount = generatedEvents.filter((e) => e.selected).length;

  const getEventBadge = (type: MatchEventType, team: TeamSide) => {
    switch (type) {
      case 'goal':
        return <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">⚽ Gol</span>;
      case 'opponent_goal':
        return <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-800">🥅 Gol Rival</span>;
      case 'corner':
        return <span className="inline-flex items-center gap-1 rounded bg-sky-100 px-2 py-0.5 text-[10px] font-black text-sky-800">🚩 Córner</span>;
      case 'opponent_corner':
        return <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">🚩 Córner Rival</span>;
      case 'assist':
        return <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-800">👟 Asistencia</span>;
      case 'yellow_card':
        return <span className="inline-flex items-center gap-1 rounded bg-yellow-100 px-2 py-0.5 text-[10px] font-black text-yellow-800">🟨 Tarjeta Amarilla</span>;
      case 'red_card':
        return <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-800">🟥 Tarjeta Roja</span>;
      case 'substitution_in':
      case 'substitution_out':
        return <span className="inline-flex items-center gap-1 rounded bg-purple-100 px-2 py-0.5 text-[10px] font-black text-purple-800">🔄 Cambio</span>;
      case 'injury':
        return <span className="inline-flex items-center gap-1 rounded bg-orange-100 px-2 py-0.5 text-[10px] font-black text-orange-800">🩹 Lesión</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-800">📌 Evento</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#002142] px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-400 to-sky-200 text-[#002142] shadow-md">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">
                  IA Video Analytics
                </span>
                <span className="rounded-full bg-cyan-400/20 px-2 py-0.5 text-[9px] font-bold text-cyan-200">
                  Gemini 3.7
                </span>
              </div>
              <h2 className="text-lg font-black text-white">
                Generador de Eventos del Partido
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
              <div className="text-xs">
                <p className="font-bold">Error en la operación</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Fixture Context Card */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div className="text-xs font-bold text-slate-700">
                <span className="font-black text-slate-900">{homeName}</span> vs{' '}
                <span className="font-black text-slate-900">{awayName}</span>
              </div>
              <div className="text-[11px] font-medium text-slate-500">
                {match.competitionName} · {match.date}
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">
                  <Video className="h-3.5 w-3.5 text-sky-700" />
                  Enlace de vídeo del partido (YouTube / Veo / Grabación)
                </span>
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... o URL de vídeo"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-900 shadow-sm focus:border-sky-600 focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">
                  <Sparkles className="h-3.5 w-3.5 text-cyan-600" />
                  Notas tácticas adicionales / Capítulos / Minutero
                </span>
                <input
                  type="text"
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  placeholder="Ej: Detectar goles, córners y cambios del 1º y 2º tiempo..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-900 shadow-sm focus:border-sky-600 focus:outline-none"
                />
              </label>
            </div>

            {/* Quick preset tags */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Sugerencias:
              </span>
              <button
                type="button"
                onClick={() => setAdditionalNotes('Goles a favor, goles del rival, saques de esquina de ambos equipos y tarjetas.')}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 hover:border-sky-600 hover:text-sky-700"
              >
                ⚽ Goles + Córners + Tarjetas
              </button>
              <button
                type="button"
                onClick={() => setAdditionalNotes('Eventos detallados con córners a favor y en contra, faltas clave y sustituciones.')}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 hover:border-sky-600 hover:text-sky-700"
              >
                🚩 Córners y Balón Parado
              </button>
              <button
                type="button"
                onClick={() => setAdditionalNotes('Cronología completa de 90 minutos con todos los goles y ocasiones.')}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-600 hover:border-sky-600 hover:text-sky-700"
              >
                ⏱️ Partido Completo
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleGenerateFallbackTemplate}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-100"
              >
                📋 Cargar Plantilla Base de Eventos
              </button>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#002142] to-sky-900 px-5 py-2.5 text-xs font-black text-white shadow-md transition hover:opacity-95 disabled:opacity-50"
              >
                <Sparkles className={`h-4 w-4 text-cyan-300 ${isGenerating ? 'animate-spin' : ''}`} />
                {isGenerating ? 'Analizando con IA...' : 'Generar Cronología con IA'}
              </button>
            </div>
          </div>

          {/* Generated Events Section */}
          {generatedEvents.length > 0 && (
            <div className="space-y-4">
              {aiWarning && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-[11px] font-semibold text-amber-900">
                  ⚠️ Eventos de plantilla base (no analizados por IA): {aiWarning}
                </div>
              )}
              {aiSummary && (
                <div className="rounded-xl border border-cyan-200 bg-cyan-50/60 p-4">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-900">
                    <Sparkles className="h-3.5 w-3.5 text-cyan-600" />
                    Resumen táctico generado por IA
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-800">
                    {aiSummary}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Eventos Detectados ({generatedEvents.length})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Revisa, edita o selecciona los eventos antes de importarlos al partido.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleAllSelected}
                  className="text-xs font-bold text-sky-700 hover:underline"
                >
                  {generatedEvents.every((e) => e.selected) ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
              </div>

              {/* Events List */}
              <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                {generatedEvents.map((event, index) => (
                  <div
                    key={index}
                    className={`flex flex-col gap-3 p-3 transition sm:flex-row sm:items-center ${
                      event.selected ? 'bg-white' : 'bg-slate-50 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={event.selected}
                        onChange={() => toggleEventSelected(index)}
                        className="h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
                      />

                      {/* Timestamp & Minute */}
                      <div className="flex flex-col items-center justify-center rounded-lg bg-slate-900 px-2.5 py-1 font-mono text-white">
                        <span className="text-[11px] font-black text-cyan-300">
                          {formatVideoTimestamp(event.videoTimestampSeconds)}
                        </span>
                        <span className="text-[9px] font-bold text-slate-400">
                          {event.minute}'
                        </span>
                      </div>
                    </div>

                    {/* Event Type & Team */}
                    <div className="w-36 shrink-0">
                      <select
                        value={event.eventType}
                        onChange={(e) => updateEventField(index, 'eventType', e.target.value)}
                        className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-bold text-slate-800"
                      >
                        <option value="goal">⚽ Gol (A favor)</option>
                        <option value="opponent_goal">🥅 Gol Rival</option>
                        <option value="corner">🚩 Córner (A favor)</option>
                        <option value="opponent_corner">🚩 Córner Rival</option>
                        <option value="assist">👟 Asistencia</option>
                        <option value="yellow_card">🟨 Tarjeta Amarilla</option>
                        <option value="red_card">🟥 Tarjeta Roja</option>
                        <option value="substitution_in">🔄 Sustitución</option>
                        <option value="injury">🩹 Lesión</option>
                        <option value="other">📌 Otro</option>
                      </select>
                    </div>

                    {/* Player assignment */}
                    <div className="w-48 shrink-0">
                      {event.eventType === 'opponent_goal' || event.eventType === 'opponent_corner' ? (
                        <div className="rounded-md border border-slate-200 bg-slate-100 px-2 py-1.5 text-xs font-semibold text-slate-500 italic">
                          Equipo rival
                        </div>
                      ) : (
                        <select
                          value={event.playerId || ''}
                          onChange={(e) => updateEventField(index, 'playerId', e.target.value || null)}
                          className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-800"
                        >
                          <option value="">Jugadora / Equipo</option>
                          {squadPlayers.map((player) => (
                            <option key={player.id} value={player.id}>
                              #{player.number ?? '-'} {player.firstName} {player.lastName}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Description */}
                    <div className="min-w-0 flex-1">
                      <input
                        type="text"
                        value={event.description}
                        onChange={(e) => updateEventField(index, 'description', e.target.value)}
                        placeholder="Descripción de la jugada..."
                        className="w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-600 focus:bg-white"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {generatedEvents.length > 0 && (
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                Reemplazar los {existingEventsCount} eventos actuales del partido
              </label>
            )}
          </div>

          <div className="flex items-center gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>

            {generatedEvents.length > 0 && (
              <button
                type="button"
                onClick={handleApply}
                disabled={isApplying || selectedCount === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-black text-white shadow-md hover:bg-emerald-700 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                {isApplying
                  ? 'Guardando eventos...'
                  : `Importar ${selectedCount} eventos al partido`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
