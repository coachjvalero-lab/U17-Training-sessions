import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  MapPin,
  Trophy,
  Shield,
  Save,
  Trash2,
  AlertCircle,
  Video,
  Check
} from 'lucide-react';
import type { Match } from '../services/matches/types';
import { updateMatch, createMatch } from '../services/matches/matchService';

interface MatchEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match | null;
  teamName?: string;
  currentTeamId?: string;
  onSave: (savedMatch: Match) => void;
  onDelete?: (matchId: string) => void;
  existingOpponents?: Array<{ id: string; name: string; logoUrl?: string | null }>;
}

const COMMON_OPPONENTS = [
  'Al Nassr',
  'Al Hilal',
  'Al Ittihad',
  'Al Shabab',
  'Al Ahli',
  'Al Qadsiah',
  'Al Ettifaq',
  'Eastern Flames',
  'Al Riyadh',
  'Al Taraji'
];

const COMMON_COMPETITIONS = [
  'U17 Women League',
  'SAFF Women Premier League',
  'SAFF Women First Division',
  'SAFF Women Cup',
  'Friendly Match',
  'Torneo Preparatorio'
];

export const MatchEditModal: React.FC<MatchEditModalProps> = ({
  isOpen,
  onClose,
  match,
  teamName = 'AlUla FC',
  currentTeamId,
  onSave,
  onDelete,
  existingOpponents = []
}) => {
  const isEditing = Boolean(match);

  const [opponentName, setOpponentName] = useState('');
  const [isHome, setIsHome] = useState(true);
  const [competitionName, setCompetitionName] = useState('U17 Women League');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('18:30');
  const [venue, setVenue] = useState('');
  const [status, setStatus] = useState<Match['status']>('planned');
  const [ourScore, setOurScore] = useState<string>('');
  const [opponentScore, setOpponentScore] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (match) {
      setOpponentName(match.opponentName || match.opponentTeamId || '');
      setIsHome(match.isHome ?? true);
      setCompetitionName(match.competitionName || 'U17 Women League');
      setDate(match.date || new Date().toISOString().split('T')[0]);
      setTime(match.time || '18:30');
      setVenue(match.venue || match.location || '');
      setStatus(match.status || 'planned');
      setOurScore(match.ourScore !== null && match.ourScore !== undefined ? String(match.ourScore) : '');
      setOpponentScore(match.opponentScore !== null && match.opponentScore !== undefined ? String(match.opponentScore) : '');
      setVideoUrl(match.videoUrl || '');
    } else {
      setOpponentName('');
      setIsHome(true);
      setCompetitionName('U17 Women League');
      setDate(new Date().toISOString().split('T')[0]);
      setTime('18:30');
      setVenue('AlUla Stadium');
      setStatus('planned');
      setOurScore('');
      setOpponentScore('');
      setVideoUrl('');
    }
    setErrorMessage(null);
  }, [match, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!opponentName.trim()) {
      setErrorMessage('Por favor, indica el nombre del equipo rival.');
      return;
    }
    if (!date) {
      setErrorMessage('Por favor, indica la fecha del partido.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      const parsedOurScore = ourScore.trim() !== '' ? Number(ourScore) : null;
      const parsedOpponentScore = opponentScore.trim() !== '' ? Number(opponentScore) : null;

      let resultMatch: Match;

      if (isEditing && match) {
        resultMatch = await updateMatch(match.id, {
          opponentName: opponentName.trim(),
          isHome,
          competitionName: competitionName.trim() || 'U17 Women League',
          date,
          time: time.trim() || '18:30',
          venue: venue.trim() || null,
          location: venue.trim() || null,
          status,
          ourScore: parsedOurScore,
          opponentScore: parsedOpponentScore,
          videoUrl: videoUrl.trim() || null
        });
      } else {
        const teamIdToUse = currentTeamId || match?.teamId || 'alula-u17-women';
        resultMatch = await createMatch({
          teamId: teamIdToUse,
          opponentName: opponentName.trim(),
          isHome,
          competitionName: competitionName.trim() || 'U17 Women League',
          date,
          time: time.trim() || '18:30',
          venue: venue.trim() || null,
          location: venue.trim() || null,
          status,
          ourScore: parsedOurScore,
          opponentScore: parsedOpponentScore,
          videoUrl: videoUrl.trim() || null
        });
      }

      onSave(resultMatch);
      onClose();
    } catch (err: any) {
      console.error('[MatchEditModal] Save failed:', err);
      setErrorMessage(err?.message || 'Error al guardar los datos del partido.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!match || !onDelete) return;
    const confirmName = match.opponentName || 'este partido';
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el partido contra ${confirmName}? Esta acción borrará también sus eventos y alineaciones asociadas.`)) {
      return;
    }

    try {
      setIsDeleting(true);
      setErrorMessage(null);
      await onDelete(match.id);
      onClose();
    } catch (err: any) {
      console.error('[MatchEditModal] Delete failed:', err);
      setErrorMessage(err?.message || 'Error al eliminar el partido.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Combine unique suggested opponent names
  const suggestedOpponents = Array.from(
    new Set([
      ...existingOpponents.map((o) => o.name).filter(Boolean),
      ...COMMON_OPPONENTS
    ])
  ).slice(0, 8);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl animate-fadeIn">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#002142] px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300 border border-sky-400/30">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-white font-display">
                {isEditing ? 'Editar Datos del Partido' : 'Programar Nuevo Partido'}
              </h2>
              <p className="text-xs text-slate-300">
                {isEditing
                  ? 'Modifica los equipos, fecha, horario o resultado del encuentro.'
                  : 'Registra un nuevo partido en el calendario de la temporada.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-300 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto p-6 space-y-5">
          
          {errorMessage && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* Condition Selector: Local vs Visitante */}
          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-600">
              Condición de Nuestro Equipo ({teamName})
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsHome(true)}
                className={`flex items-center justify-center gap-2 rounded-2xl border p-3 text-xs font-black transition ${
                  isHome
                    ? 'border-sky-600 bg-sky-50 text-sky-950 shadow-sm ring-2 ring-sky-500/30'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Shield className="h-4 w-4 text-sky-600" />
                <span>LOCAL (En Casa)</span>
              </button>
              <button
                type="button"
                onClick={() => setIsHome(false)}
                className={`flex items-center justify-center gap-2 rounded-2xl border p-3 text-xs font-black transition ${
                  !isHome
                    ? 'border-sky-600 bg-sky-50 text-sky-950 shadow-sm ring-2 ring-sky-500/30'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <MapPin className="h-4 w-4 text-sky-600" />
                <span>VISITANTE (Fuera)</span>
              </button>
            </div>
          </div>

          {/* Opponent Team Name */}
          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-700">
              Equipo Rival <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={opponentName}
              onChange={(e) => setOpponentName(e.target.value)}
              placeholder="Ej: Al Nassr, Al Hilal, Al Ittihad..."
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-sky-600 focus:bg-white focus:ring-2 focus:ring-sky-500/20"
            />
            {/* Quick suggestion chips */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400 mr-1">Sugerencias:</span>
              {suggestedOpponents.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setOpponentName(sug)}
                  className="rounded-lg border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 hover:bg-sky-100 hover:border-sky-300 hover:text-sky-900 transition"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          {/* Competition */}
          <div>
            <label className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-700">
              Competición / Torneo
            </label>
            <input
              type="text"
              value={competitionName}
              onChange={(e) => setCompetitionName(e.target.value)}
              placeholder="Ej: U17 Women League, SAFF Women Cup..."
              list="competitions-list"
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-sky-600 focus:bg-white"
            />
            <datalist id="competitions-list">
              {COMMON_COMPETITIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          {/* Date & Time Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-700">
                <Calendar className="h-3.5 w-3.5 text-sky-600" />
                <span>Fecha del Partido <span className="text-rose-500">*</span></span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-sky-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-700">
                <Clock className="h-3.5 w-3.5 text-sky-600" />
                <span>Horario / Kick-off</span>
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-sky-600 focus:bg-white"
              />
            </div>
          </div>

          {/* Venue / Location */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-700">
              <MapPin className="h-3.5 w-3.5 text-sky-600" />
              <span>Estadio / Campo / Instalación</span>
            </label>
            <input
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="Ej: AlUla Stadium - Campo Principal"
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-sky-600 focus:bg-white"
            />
          </div>

          {/* Match Status & Score Section */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-700">
                  Estado del Encuentro
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Match['status'])}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-sky-600"
                >
                  <option value="planned">📅 Programado / Pendiente (Planned)</option>
                  <option value="played">✅ Finalizado / Jugado (Played)</option>
                  <option value="cancelled">❌ Cancelado (Cancelled)</option>
                  <option value="postponed">⏳ Aplazado (Postponed)</option>
                </select>
              </div>

              {/* Scores */}
              <div className="flex items-center gap-2">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 text-center">
                    {isHome ? 'Goles Local' : 'Goles AlUla'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={ourScore}
                    onChange={(e) => setOurScore(e.target.value)}
                    placeholder="-"
                    className="w-16 rounded-xl border border-slate-300 bg-white p-2 text-center text-sm font-black text-slate-900 outline-none focus:border-sky-600"
                  />
                </div>
                <span className="text-slate-400 font-bold mt-4">:</span>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 text-center">
                    {isHome ? 'Goles Rival' : 'Goles Visit.'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={opponentScore}
                    onChange={(e) => setOpponentScore(e.target.value)}
                    placeholder="-"
                    className="w-16 rounded-xl border border-slate-300 bg-white p-2 text-center text-sm font-black text-slate-900 outline-none focus:border-sky-600"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Video URL */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-700">
              <Video className="h-3.5 w-3.5 text-sky-600" />
              <span>Enlace de Vídeo de Análisis (YouTube, Vimeo o Veo)</span>
            </label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-sky-600 focus:bg-white"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            {isEditing && onDelete ? (
              <button
                type="button"
                disabled={isSaving || isDeleting}
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-black text-rose-700 hover:bg-rose-100 transition disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                <span>{isDeleting ? 'Eliminando...' : 'Eliminar Partido'}</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving || isDeleting}
                className="rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving || isDeleting}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#002142] px-6 py-2.5 text-xs font-black text-white hover:bg-[#09355e] transition shadow-md disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>{isEditing ? 'Guardar Cambios' : 'Crear Partido'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};
