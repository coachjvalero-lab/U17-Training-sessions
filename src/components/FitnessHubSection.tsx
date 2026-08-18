import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Calendar, Edit3, FileText, FolderOpen, Layers, Plus, Search, Trash2 } from 'lucide-react';
import { getEmptySession } from '../defaultSession';
import type { CloudTrainingSession, FitnessSession, PlayerAttendance, PlayerGroup, SharedSessionHeader, SquadPlayer, TrainingSession } from '../types';
import { ModuleSessionEditor } from './ModuleSessionEditor';
import { ExercisesLibrary } from './ExercisesLibrary';
import { deleteFitnessSession, saveFitnessSession, subscribeToFitnessSessions } from '../services/fitness/fitnessSessionsService';
import { readWorkspaceRestoreState, writeWorkspaceRestoreState } from '../utils/workspaceRestore';

const WELLNESS_SHEET_ID = import.meta.env.VITE_WELLNESS_SHEET_ID || '178oyGRKhSNlsdl2zV5oIu_uXE9Qdtq1xUkFpUXbSQDw';
const WELLNESS_SHEET_NAME = 'Wellness';
const WELLNESS_SHEET_JSON_URL = `https://docs.google.com/spreadsheets/d/${WELLNESS_SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(WELLNESS_SHEET_NAME)}`;
const WELLNESS_VISIT_TOKEN_KEY = 'u17_fitness_wellness_visit_token';

type WellnessRow = {
  rowId: string;
  week: string;
  md: string;
  timestamp: string;
  playerName: string;
  sleepQuality: string;
  sleepTime: string;
  fatigue: string;
  muscleSoreness: string;
  stress: string;
  sumScore: string;
  pain: string;
  painIntensity: string;
  menstrualCycle: string;
  dayOfPeriod: string;
  symptoms: string;
  otherSymptom: string;
  cyclePhase: string;
  status: string;
  additionalInformation: string;
  dateKey: string;
};

type WellnessPlayerResolution = {
  playerName: string;
  playerId: string | null;
  status: 'matched' | 'unresolved' | 'ambiguous';
  resolvedLabel?: string;
  options?: Array<{ playerId: string; label: string }>;
};

type WellnessSnapshot = {
  rows: WellnessRow[];
  availableDates: string[];
  resolutions: WellnessPlayerResolution[];
};

type WellnessLoadState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  message?: string;
  source?: 'fresh' | 'cached';
};

const wellnessRequestCache = new Map<number, Promise<WellnessSnapshot>>();
const wellnessResultCache = new Map<number, WellnessSnapshot>();

function normalizeWellnessText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseWellnessCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function parseWellnessCsv(csvText: string): string[][] {
  return csvText
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(parseWellnessCsvLine);
}

function readWellnessVisitToken(): number {
  try {
    const raw = sessionStorage.getItem(WELLNESS_VISIT_TOKEN_KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch (error) {
    return 0;
  }
}

function writeWellnessVisitToken(value: number): void {
  try {
    sessionStorage.setItem(WELLNESS_VISIT_TOKEN_KEY, String(value));
  } catch (error) {}
}

function formatSheetValue(value: string | undefined): string {
  const trimmed = (value || '').trim();
  return trimmed ? trimmed : '—';
}

function parseGoogleDateValue(value: string | null | undefined): string {
  const raw = (value || '').trim();
  if (!raw) return 'Unknown Date';

  const googleDateMatch = raw.match(/^Date\((\d{4}),(\d+),(\d+)(?:,\d+,\d+,\d+)?\)$/);
  if (googleDateMatch) {
    const year = Number(googleDateMatch[1]);
    const monthZeroBased = Number(googleDateMatch[2]);
    const day = Number(googleDateMatch[3]);
    const localDate = new Date(year, monthZeroBased, day);
    return `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
  }

  const slashDateMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+\d{1,2}:\d{2}:\d{2})?$/);
  if (slashDateMatch) {
    const month = Number(slashDateMatch[1]);
    const day = Number(slashDateMatch[2]);
    const year = Number(slashDateMatch[3]);
    const localDate = new Date(year, month - 1, day);
    return `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw || 'Unknown Date';

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

function parseTimestampDateKey(value: string): string {
  return parseGoogleDateValue(value);
}

function resolveHeaderIndex(headers: string[], candidates: string[]): number {
  const normalizedHeaders = headers.map((header) => normalizeWellnessText(header));
  const normalizedCandidates = candidates.map((candidate) => normalizeWellnessText(candidate));
  return normalizedHeaders.findIndex((header) => normalizedCandidates.some((candidate) => header.includes(candidate)));
}

function parseGoogleSheetCell(cell: unknown): string {
  if (!cell || typeof cell !== 'object') return '';

  const record = cell as Record<string, unknown>;
  const value = record.f ?? record.v;

  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

export function parseWellnessSheetData(jsonText: string): string[][] {
  const wrapperStart = jsonText.indexOf('google.visualization.Query.setResponse(');
  const payload = wrapperStart >= 0
    ? jsonText.slice(wrapperStart + 'google.visualization.Query.setResponse('.length).trim()
    : jsonText;

  const wrapperEnd = payload.lastIndexOf(');');
  const normalizedPayload = wrapperEnd >= 0 ? payload.slice(0, wrapperEnd).trim() : payload.trim();
  const data = JSON.parse(normalizedPayload);
  const columns = Array.isArray(data?.table?.cols) ? data.table.cols.map((column: Record<string, unknown>) => String(column.label ?? '')) : [];
  const rows = Array.isArray(data?.table?.rows) ? data.table.rows.map((row: Record<string, unknown>) => (Array.isArray(row.c) ? row.c.map(parseGoogleSheetCell) : [])) : [];
  return [columns, ...rows];
}

function resolveWellnessPlayerName(playerName: string, squadPlayers: SquadPlayer[]): WellnessPlayerResolution {
  const normalizedName = normalizeWellnessText(playerName);
  const candidates = squadPlayers.flatMap((player) => {
    const primaryLabel = `${player.firstName} ${player.lastName}`.trim();
    const labels = [player.firstName, primaryLabel];
    if (player.position === 'GK') {
      labels.push(`${player.firstName} (GK)`);
    }
    return labels.map((label) => ({
      playerId: player.id,
      label,
      normalized: normalizeWellnessText(label)
    }));
  });

  const exactMatches = candidates.filter((candidate) => candidate.normalized === normalizedName);
  const uniqueMatches = exactMatches.filter((candidate, index, list) => list.findIndex((item) => item.playerId === candidate.playerId) === index);

  if (uniqueMatches.length === 1) {
    return {
      playerName,
      playerId: uniqueMatches[0].playerId,
      status: 'matched',
      resolvedLabel: uniqueMatches[0].label
    };
  }

  if (uniqueMatches.length > 1) {
    return {
      playerName,
      playerId: null,
      status: 'ambiguous',
      options: uniqueMatches.map((candidate) => ({ playerId: candidate.playerId, label: candidate.label }))
    };
  }

  const partialMatches = candidates.filter((candidate) => candidate.normalized.includes(normalizedName) || normalizedName.includes(candidate.normalized));
  const partialUniqueMatches = partialMatches.filter((candidate, index, list) => list.findIndex((item) => item.playerId === candidate.playerId) === index);

  if (partialUniqueMatches.length === 1) {
    return {
      playerName,
      playerId: partialUniqueMatches[0].playerId,
      status: 'matched',
      resolvedLabel: partialUniqueMatches[0].label
    };
  }

  return {
    playerName,
    playerId: null,
    status: 'unresolved'
  };
}

async function loadWellnessSnapshot(
  squadPlayers: SquadPlayer[],
  visitToken: number,
  signal?: AbortSignal
): Promise<WellnessSnapshot> {
  const cached = wellnessResultCache.get(visitToken);
  if (cached) return cached;

  const inFlight = wellnessRequestCache.get(visitToken);
  if (inFlight) return inFlight;

  const request = (async () => {
    const response = await fetch(WELLNESS_SHEET_JSON_URL, { signal });
    if (!response.ok) {
      throw new Error(`Wellness sheet request failed (${response.status})`);
    }

    const jsonText = await response.text();
    const rows = parseWellnessSheetData(jsonText);
    if (rows.length < 2) {
      return { rows: [], availableDates: [], resolutions: [] } satisfies WellnessSnapshot;
    }

    const headers = rows[0];
    const timestampIndex = resolveHeaderIndex(headers, ['Timestamp']);
    const dateIndex = resolveHeaderIndex(headers, ['Date']);
    const playerIndex = resolveHeaderIndex(headers, ['Player']);
    const sleepQualityIndex = resolveHeaderIndex(headers, ['Sleep quality', 'Sleep Quality']);
    const sleepTimeIndex = resolveHeaderIndex(headers, ['Sleep time', 'Sleep Time']);
    const fatigueIndex = resolveHeaderIndex(headers, ['Fatigue']);
    const sorenessIndex = resolveHeaderIndex(headers, ['Muscle soreness', 'Muscle Soreness']);
    const stressIndex = resolveHeaderIndex(headers, ['Stress']);
    const readinessIndex = resolveHeaderIndex(headers, ['Readiness']);
    const painIndex = resolveHeaderIndex(headers, ['Pain location', 'Pain Location']);
    const intensityIndex = resolveHeaderIndex(headers, ['Pain intensity', 'Pain Intensity']);
    const menstrualIndex = resolveHeaderIndex(headers, ['Menstrual cycle', 'Menstrual Cycle']);
    const dayOfPeriodIndex = resolveHeaderIndex(headers, ['Period day', 'Day of period', 'Day of period']);
    const symptomsIndex = resolveHeaderIndex(headers, ['Symptoms']);
    const otherSymptomIndex = resolveHeaderIndex(headers, ['Other symptom', 'Other Symptom']);
    const cyclePhaseIndex = resolveHeaderIndex(headers, ['Cycle phase', 'Cycle Phase']);
    const infoIndex = resolveHeaderIndex(headers, ['Additional information', 'Additional Information']);
    const statusIndex = resolveHeaderIndex(headers, ['Status']);

    const wellnessRows = rows.slice(1)
      .map((cells, index) => {
        const timestamp = formatSheetValue(cells[timestampIndex]);
        const dateValue = formatSheetValue(cells[dateIndex]);
        const playerName = formatSheetValue(cells[playerIndex]);
        if (playerName === '—' && timestamp === '—' && dateValue === '—') return null;

        const resolvedTimestamp = timestamp === '—' ? dateValue : timestamp;
        const dateKey = parseTimestampDateKey(dateValue !== '—' ? dateValue : resolvedTimestamp);
        const sumScoreValue = formatSheetValue(cells[readinessIndex]);

        return {
          rowId: `${dateValue}-${playerName}-${index}`,
          week: '',
          md: '',
          timestamp: resolvedTimestamp,
          playerName,
          sleepQuality: formatSheetValue(cells[sleepQualityIndex]),
          sleepTime: formatSheetValue(cells[sleepTimeIndex]),
          fatigue: formatSheetValue(cells[fatigueIndex]),
          muscleSoreness: formatSheetValue(cells[sorenessIndex]),
          stress: formatSheetValue(cells[stressIndex]),
          sumScore: sumScoreValue === '—' ? '' : sumScoreValue,
          pain: formatSheetValue(cells[painIndex]),
          painIntensity: formatSheetValue(cells[intensityIndex]),
          menstrualCycle: formatSheetValue(cells[menstrualIndex]),
          dayOfPeriod: formatSheetValue(cells[dayOfPeriodIndex]),
          symptoms: formatSheetValue(cells[symptomsIndex]),
          otherSymptom: formatSheetValue(cells[otherSymptomIndex]),
          cyclePhase: formatSheetValue(cells[cyclePhaseIndex]),
          status: formatSheetValue(cells[statusIndex]),
          additionalInformation: formatSheetValue(cells[infoIndex]),
          dateKey
        } satisfies WellnessRow;
      })
      .filter((row): row is WellnessRow => Boolean(row));

    const playerNames = Array.from(new Set(wellnessRows.map((row) => row.playerName)));
    const resolutions = playerNames.map((playerName) => resolveWellnessPlayerName(playerName, squadPlayers));
    const availableDates = Array.from(new Set(wellnessRows.map((row) => row.dateKey))).sort((a, b) => b.localeCompare(a));

    const snapshot = { rows: wellnessRows, availableDates, resolutions } satisfies WellnessSnapshot;
    wellnessResultCache.set(visitToken, snapshot);
    return snapshot;
  })();

  wellnessRequestCache.set(visitToken, request);
  try {
    return await request;
  } finally {
    wellnessRequestCache.delete(visitToken);
  }
}

interface FitnessHubSectionProps {
  currentLogo: string;
  squadPlayers: SquadPlayer[];
  excludedPlayers: string[];
  onExcludePlayer: (name: string) => void;
  onIncludePlayer: (name: string) => void;
  onUpdateLogo: (newLogo: string) => void;
}

function defaultFitnessBlock(id: string, title: string) {
  return { id, title, exercises: [] };
}

function toTrainingSession(fitness: FitnessSession): TrainingSession {
  const empty = getEmptySession();
  return {
    ...empty,
    id: fitness.sessionUid,
    teamName: fitness.teamName,
    date: fitness.date,
    time: fitness.time,
    sessionNumber: fitness.sessionNumber,
    microcycleDay: fitness.microcycleDay,
    mainObjective: fitness.mainObjective,
    materialsNeeded: fitness.materialsNeeded,
    observations: fitness.observations,
    squadRoster: fitness.squadRoster,
    attendance: fitness.attendance,
    fitnessWarmUp: fitness.fitnessWarmUp || defaultFitnessBlock('warmup-block-fitness', 'Warm Up'),
    fitnessMainPart: fitness.fitnessMainPart || defaultFitnessBlock('main-block-fitness', 'Main Part'),
    fitnessCoolDown: fitness.fitnessCoolDown || defaultFitnessBlock('cooldown-block-fitness', 'Cool Down'),
    fitnessPlayerGroups: fitness.fitnessPlayerGroups || []
  };
}

function toFitnessSession(recordId: string, session: TrainingSession, previous?: FitnessSession): FitnessSession {
  const now = Date.now();
  return {
    id: recordId,
    sessionUid: session.id,
    legacySessionId: previous?.legacySessionId || session.id,
    teamName: session.teamName,
    date: session.date,
    time: session.time,
    sessionNumber: session.sessionNumber,
    microcycleDay: session.microcycleDay,
    mainObjective: session.mainObjective,
    materialsNeeded: session.materialsNeeded,
    observations: session.observations,
    squadRoster: session.squadRoster || [],
    attendance: session.attendance || [],
    fitnessWarmUp: session.fitnessWarmUp || defaultFitnessBlock('warmup-block-fitness', 'Warm Up'),
    fitnessMainPart: session.fitnessMainPart || defaultFitnessBlock('main-block-fitness', 'Main Part'),
    fitnessCoolDown: session.fitnessCoolDown || defaultFitnessBlock('cooldown-block-fitness', 'Cool Down'),
    fitnessPlayerGroups: session.fitnessPlayerGroups || [],
    createdAt: previous?.createdAt || now,
    updatedAt: now
  };
}

function createEmptyFitnessSession(
  squadRoster: string[],
  attendance: PlayerAttendance[],
  sessionNumber: string
): FitnessSession {
  const uid = `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const today = new Date().toISOString().split('T')[0];
  const now = Date.now();

  return {
    id: `fit-${uid}`,
    sessionUid: uid,
    legacySessionId: uid,
    teamName: 'U17 Women Al Ula',
    date: today,
    time: '18:30 - 20:00',
    sessionNumber,
    microcycleDay: 'MD-3',
    mainObjective: '',
    materialsNeeded: '',
    observations: '',
    squadRoster,
    attendance,
    fitnessWarmUp: defaultFitnessBlock('warmup-block-fitness', 'Warm Up'),
    fitnessMainPart: defaultFitnessBlock('main-block-fitness', 'Main Part'),
    fitnessCoolDown: defaultFitnessBlock('cooldown-block-fitness', 'Cool Down'),
    fitnessPlayerGroups: [],
    createdAt: now,
    updatedAt: now
  };
}

function parseSessionNumberValue(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export const FitnessHubSection: React.FC<FitnessHubSectionProps> = ({
  currentLogo,
  squadPlayers,
  excludedPlayers,
  onExcludePlayer,
  onIncludePlayer,
  onUpdateLogo
}) => {
  const contextStorageKey = 'u17_fitness_hub_context';
  const restoredContext = readWorkspaceRestoreState(contextStorageKey, {
    fitnessSubTab: 'sessions' as const,
    sessionSubNav: 'cards' as const,
    searchTerm: ''
  });
  const initialFitnessSubTab =
    restoredContext.fitnessSubTab === 'sessions' ||
    restoredContext.fitnessSubTab === 'monitoring' ||
    restoredContext.fitnessSubTab === 'library'
      ? restoredContext.fitnessSubTab
      : restoredContext.fitnessSubTab === 'wellness'
        ? 'monitoring'
        : 'sessions';

  const [fitnessSubTab, setFitnessSubTab] = useState<'sessions' | 'monitoring' | 'library'>(initialFitnessSubTab);
  const [sessionSubNav, setSessionSubNav] = useState<'cards' | 'editor'>(restoredContext.sessionSubNav);
  const [monitoringTab, setMonitoringTab] = useState<'wellness' | 'trainingLoad' | 'testing'>('wellness');
  const [searchTerm, setSearchTerm] = useState(restoredContext.searchTerm);
  const [fitnessSessions, setFitnessSessions] = useState<FitnessSession[]>([]);
  const [selectedFitnessId, setSelectedFitnessId] = useState<string>('');
  const [editorSession, setEditorSession] = useState<TrainingSession>(() => getEmptySession());
  const [expandedExercises, setExpandedExercises] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveValidationError, setSaveValidationError] = useState<string | null>(null);
  const [isCreateSessionModalOpen, setIsCreateSessionModalOpen] = useState(false);
  const [newSessionNumberInput, setNewSessionNumberInput] = useState('');
  const [createSessionValidationError, setCreateSessionValidationError] = useState<string | null>(null);
  const [wellnessVisitToken, setWellnessVisitToken] = useState(() => readWellnessVisitToken());
  const [wellnessSnapshot, setWellnessSnapshot] = useState<WellnessSnapshot | null>(null);
  const [wellnessLoadState, setWellnessLoadState] = useState<WellnessLoadState>({ status: 'idle' });
  const [selectedWellnessDate, setSelectedWellnessDate] = useState('');
  const [selectedWellnessRowId, setSelectedWellnessRowId] = useState('');

  const isWellnessVisible = fitnessSubTab === 'monitoring' && monitoringTab === 'wellness';

  useEffect(() => {
    writeWorkspaceRestoreState(contextStorageKey, { fitnessSubTab, sessionSubNav, searchTerm, monitoringTab });
  }, [fitnessSubTab, sessionSubNav, searchTerm, monitoringTab]);

  const enterWellnessView = () => {
    setFitnessSubTab('monitoring');
    setMonitoringTab('wellness');
    setWellnessVisitToken((previous) => {
      const next = previous + 1;
      writeWellnessVisitToken(next);
      return next;
    });
  };

  useEffect(() => {
    if (!isWellnessVisible) return;
    if (wellnessVisitToken > 0) return;
    const next = 1;
    writeWellnessVisitToken(next);
    setWellnessVisitToken(next);
  }, [isWellnessVisible, wellnessVisitToken]);

  useEffect(() => {
    if (!isWellnessVisible || wellnessVisitToken <= 0) return;

    const controller = new AbortController();
    let active = true;

    setWellnessLoadState((previous) => ({
      status: 'loading',
      message: previous.status === 'ready' && wellnessSnapshot
        ? 'Refreshing previously loaded Wellness data...'
        : 'Loading Wellness data...',
      source: previous.status === 'ready' && wellnessSnapshot ? 'cached' : 'fresh'
    }));

    void loadWellnessSnapshot(squadPlayers, wellnessVisitToken, controller.signal)
      .then((snapshot) => {
        if (!active) return;
        setWellnessSnapshot(snapshot);
        setWellnessLoadState({ status: 'ready', source: 'fresh' });
      })
      .catch((error) => {
        if (!active || controller.signal.aborted) return;
        console.warn('Failed loading Wellness data:', error);
        setWellnessLoadState({ status: 'error', message: 'Wellness data is temporarily unavailable.' });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [isWellnessVisible, squadPlayers, wellnessSnapshot, wellnessVisitToken]);

  const wellnessRowsForDate = useMemo(() => {
    if (!wellnessSnapshot) return [];
    const rows = selectedWellnessDate
      ? wellnessSnapshot.rows.filter((row) => row.dateKey === selectedWellnessDate)
      : wellnessSnapshot.rows;
    return rows.slice().sort((left, right) => left.playerName.localeCompare(right.playerName));
  }, [selectedWellnessDate, wellnessSnapshot]);

  const selectedWellnessRow = useMemo(() => {
    if (!wellnessRowsForDate.length) return null;
    return wellnessRowsForDate.find((row) => row.rowId === selectedWellnessRowId) || wellnessRowsForDate[0];
  }, [selectedWellnessRowId, wellnessRowsForDate]);

  const selectedWellnessStatusClass = useMemo(() => {
    const status = selectedWellnessRow?.status?.toUpperCase();
    if (status === 'GREEN') return 'bg-emerald-100 text-emerald-900 border border-emerald-300';
    if (status === 'AMBER') return 'bg-amber-100 text-amber-900 border border-amber-300';
    if (status === 'RED') return 'bg-rose-100 text-rose-900 border border-rose-300';
    return 'bg-slate-100 text-slate-700 border border-slate-200';
  }, [selectedWellnessRow]);

  useEffect(() => {
    if (!wellnessSnapshot) return;
    if (wellnessSnapshot.availableDates.length === 0) {
      setSelectedWellnessDate('');
      return;
    }
    if (!selectedWellnessDate || !wellnessSnapshot.availableDates.includes(selectedWellnessDate)) {
      setSelectedWellnessDate(wellnessSnapshot.availableDates[0]);
    }
  }, [selectedWellnessDate, wellnessSnapshot]);

  useEffect(() => {
    if (!wellnessRowsForDate.length) {
      setSelectedWellnessRowId('');
      return;
    }
    if (!selectedWellnessRowId || !wellnessRowsForDate.some((row) => row.rowId === selectedWellnessRowId)) {
      setSelectedWellnessRowId(wellnessRowsForDate[0].rowId);
    }
  }, [selectedWellnessRowId, wellnessRowsForDate]);

  const wellnessDiagnostics = useMemo(() => {
    const resolutions = wellnessSnapshot?.resolutions || [];
    const matched = resolutions.filter((resolution) => resolution.status === 'matched');
    const unresolved = resolutions.filter((resolution) => resolution.status === 'unresolved');
    const ambiguous = resolutions.filter((resolution) => resolution.status === 'ambiguous');
    return { matched, unresolved, ambiguous };
  }, [wellnessSnapshot]);

  useEffect(() => {
    const unsubscribe = subscribeToFitnessSessions((items) => {
      setFitnessSessions(items);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (fitnessSessions.length === 0) return;
    if (!selectedFitnessId || !fitnessSessions.some((item) => item.id === selectedFitnessId)) {
      const first = fitnessSessions[0];
      setSelectedFitnessId(first.id);
      setEditorSession(toTrainingSession(first));
    }
  }, [fitnessSessions, selectedFitnessId]);

  const selectedFitness = useMemo(
    () => fitnessSessions.find((item) => item.id === selectedFitnessId) || null,
    [fitnessSessions, selectedFitnessId]
  );

  const filteredCards = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return fitnessSessions
      .filter((item) => {
        if (!term) return true;
        return (
          item.sessionNumber.toLowerCase().includes(term) ||
          item.mainObjective.toLowerCase().includes(term) ||
          item.date.toLowerCase().includes(term)
        );
      })
      .sort((left, right) => {
        const leftNumber = parseSessionNumberValue(left.sessionNumber);
        const rightNumber = parseSessionNumberValue(right.sessionNumber);
        const leftHasNumber = leftNumber !== null;
        const rightHasNumber = rightNumber !== null;

        if (leftHasNumber && rightHasNumber) {
          if (leftNumber !== rightNumber) {
            return leftNumber - rightNumber;
          }
          if (left.updatedAt !== right.updatedAt) {
            return right.updatedAt - left.updatedAt;
          }
          return left.id.localeCompare(right.id);
        }

        if (leftHasNumber && !rightHasNumber) return -1;
        if (!leftHasNumber && rightHasNumber) return 1;

        if (left.updatedAt !== right.updatedAt) {
          return right.updatedAt - left.updatedAt;
        }
        return left.id.localeCompare(right.id);
      });
  }, [fitnessSessions, searchTerm]);

  const planningRoster = editorSession.squadRoster || [];
  const sharedHeader: SharedSessionHeader = {
    id: editorSession.id,
    sessionNumber: editorSession.sessionNumber,
    date: editorSession.date,
    time: editorSession.time,
    teamName: editorSession.teamName,
    microcycleDay: editorSession.microcycleDay,
    attendance: editorSession.attendance || [],
    squadRoster: planningRoster,
    updatedAt: selectedFitness?.updatedAt || 0
  };

  const cloudLikeFitnessSessions: CloudTrainingSession[] = fitnessSessions.map((item) => {
    const ts = toTrainingSession(item);
    return {
      ...ts,
      updatedAt: item.updatedAt,
      footballUpdatedAt: 0,
      fitnessUpdatedAt: item.updatedAt,
      gkUpdatedAt: 0
    };
  });

  const handleUpdateHeader = (fields: Partial<TrainingSession>) => {
    setEditorSession((prev) => ({ ...prev, ...fields }));
  };

  const handleUpdateAttendance = (attendance: PlayerAttendance[]) => {
    setEditorSession((prev) => ({ ...prev, attendance }));
  };

  const handleUpdateRoster = (squadRoster: string[]) => {
    setEditorSession((prev) => ({ ...prev, squadRoster }));
  };

  const handleUpdateGroups = (groups: PlayerGroup[]) => {
    setEditorSession((prev) => ({ ...prev, fitnessPlayerGroups: groups }));
  };

  const handleUpdateExercises = (blockKey: 'warmUp' | 'mainPart' | 'coolDown', exercises: any[]) => {
    const field = blockKey === 'warmUp' ? 'fitnessWarmUp' : blockKey === 'mainPart' ? 'fitnessMainPart' : 'fitnessCoolDown';
    setEditorSession((prev) => ({
      ...prev,
      [field]: {
        ...(prev[field] as any),
        exercises
      }
    }));
  };

  const toggleExpand = (id: string) => {
    setExpandedExercises((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateNew = () => {
    setCreateSessionValidationError(null);
    setNewSessionNumberInput('');
    setIsCreateSessionModalOpen(true);
  };

  const handleCancelCreateSession = () => {
    setIsCreateSessionModalOpen(false);
    setCreateSessionValidationError(null);
    setNewSessionNumberInput('');
  };

  const handleConfirmCreateSession = async () => {
    const normalizedSessionNumber = newSessionNumberInput.trim();
    if (!/^\d+$/.test(normalizedSessionNumber)) {
      setCreateSessionValidationError('Please enter a valid session number.');
      return;
    }

    setIsCreateSessionModalOpen(false);
    setCreateSessionValidationError(null);
    setNewSessionNumberInput('');

    const roster = squadPlayers
      .map((player) => (player.position === 'GK' ? `${player.firstName} (GK)` : `${player.firstName} ${player.lastName}`.trim()));
    const attendance: PlayerAttendance[] = roster.map((playerName) => ({ playerName, status: 'Attending' }));
    const fresh = createEmptyFitnessSession(roster, attendance, normalizedSessionNumber);
    setSaveValidationError(null);
    setEditorSession(toTrainingSession(fresh));
    setSessionSubNav('editor');
    try {
      setIsSaving(true);
      await saveFitnessSession(fresh);
      setSelectedFitnessId(fresh.id);
    } catch (error) {
      const err = error as { message?: unknown };
      const message = typeof err?.message === 'string' ? err.message : 'Fitness session save failed.';
      setSaveValidationError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!selectedFitness && !editorSession.id) {
      setSaveValidationError('Open or create a Fitness session before saving.');
      return;
    }

    if (!selectedFitness && editorSession.id.startsWith('empty-session-')) {
      setSaveValidationError('Cannot save draft placeholder session. Create a New Fitness Session first.');
      return;
    }

    try {
      setSaveValidationError(null);
      setIsSaving(true);
      const recordId = selectedFitness?.id || `fit-${editorSession.id}`;
      const payload = toFitnessSession(recordId, editorSession, selectedFitness || undefined);
      await saveFitnessSession(payload);
      setSelectedFitnessId(payload.id);
    } catch (error) {
      const err = error as { message?: unknown };
      const message = typeof err?.message === 'string' ? err.message : 'Fitness session save failed.';
      setSaveValidationError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item: FitnessSession) => {
    if (!confirm(`Delete Fitness Session #${item.sessionNumber}?`)) return;
    await deleteFitnessSession(item.id);
    if (selectedFitnessId === item.id) {
      const remaining = fitnessSessions.filter((session) => session.id !== item.id);
      if (remaining.length > 0) {
        setSelectedFitnessId(remaining[0].id);
        setEditorSession(toTrainingSession(remaining[0]));
      } else {
        setSelectedFitnessId('');
        setEditorSession(getEmptySession());
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#002142] p-5 sm:p-6 rounded-3xl shadow-xl border border-slate-800 text-white space-y-5 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <span className="p-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl">
                <Layers className="w-5 h-5" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center space-x-2">
                  <span>Fitness Management Hub</span>
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Fitness Department
                  </span>
                </h1>
                <p className="text-xs text-slate-300 font-medium">
                  Independent fitness sessions, wellness and testing structure, and module-scoped exercise library.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-xs font-mono shrink-0">
            <span className="bg-slate-800/80 border border-slate-700/80 px-3 py-1.5 rounded-xl text-slate-300 font-bold flex items-center space-x-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>{fitnessSessions.length} Session{fitnessSessions.length !== 1 ? 's' : ''}</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => setFitnessSubTab('sessions')}
            className={`group text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative overflow-hidden cursor-pointer ${
              fitnessSubTab === 'sessions'
                ? 'bg-[#0f5981] border-[#5ea4c5] shadow-lg ring-2 ring-[#5ea4c5]/40 scale-[1.01]'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className={`absolute top-0 inset-x-0 h-1 transition-colors ${fitnessSubTab === 'sessions' ? 'bg-emerald-500' : 'bg-slate-800 group-hover:bg-emerald-600'}`} />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">DAILY FITNESS WORK</span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${fitnessSubTab === 'sessions' ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black' : 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'}`}>
                  Core Engine
                </span>
              </div>
              <div className="flex items-start space-x-3">
                <div className={`p-3 rounded-xl border shrink-0 transition-transform ${fitnessSubTab === 'sessions' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 scale-105' : 'bg-slate-800 text-slate-300 border-slate-700 group-hover:text-emerald-400'}`}>
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white group-hover:text-emerald-300 transition-colors">Sessions</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1 line-clamp-2">
                    Manage fitness sessions, editor fields, attendance, and the fitness-specific warm-up, main part, and cool-down content.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="text-[11px] font-mono text-slate-400">{cloudLikeFitnessSessions.length} Session{cloudLikeFitnessSessions.length !== 1 ? 's' : ''} Saved</span>
              <div className="flex items-center space-x-1 text-emerald-400 font-bold group-hover:translate-x-1 transition-transform">
                <span>Open Module</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={enterWellnessView}
            className={`group text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative overflow-hidden cursor-pointer ${
              fitnessSubTab === 'monitoring'
                ? 'bg-[#0f5981] border-[#5ea4c5] shadow-lg ring-2 ring-[#5ea4c5]/40 scale-[1.01]'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className={`absolute top-0 inset-x-0 h-1 transition-colors ${fitnessSubTab === 'monitoring' ? 'bg-emerald-500' : 'bg-slate-800 group-hover:bg-emerald-600'}`} />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PLAYER MONITORING</span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${fitnessSubTab === 'monitoring' ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black' : 'bg-indigo-950/60 text-indigo-400 border-indigo-800/60'}`}>
                  Structure only
                </span>
              </div>
              <div className="flex items-start space-x-3">
                <div className={`p-3 rounded-xl border shrink-0 transition-transform ${fitnessSubTab === 'monitoring' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 scale-105' : 'bg-slate-800 text-slate-300 border-slate-700 group-hover:text-emerald-400'}`}>
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white group-hover:text-emerald-300 transition-colors">Player Monitoring</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1 line-clamp-2">
                    Visual container for wellness, training load, and testing navigation only.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="text-[11px] font-mono text-slate-400">Monitoring Shell</span>
              <div className="flex items-center space-x-1 text-emerald-400 font-bold group-hover:translate-x-1 transition-transform">
                <span>Open Module</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setFitnessSubTab('library')}
            className={`group text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between relative overflow-hidden cursor-pointer ${
              fitnessSubTab === 'library'
                ? 'bg-slate-900 border-emerald-500 shadow-lg ring-2 ring-emerald-500/30 scale-[1.01]'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
            }`}
          >
            <div className={`absolute top-0 inset-x-0 h-1 transition-colors ${fitnessSubTab === 'library' ? 'bg-emerald-500' : 'bg-slate-800 group-hover:bg-emerald-600'}`} />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">DRILLS & EXERCISES</span>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${fitnessSubTab === 'library' ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black' : 'bg-purple-950/60 text-purple-400 border-purple-800/60'}`}>
                  Library Hub
                </span>
              </div>
              <div className="flex items-start space-x-3">
                <div className={`p-3 rounded-xl border shrink-0 transition-transform ${fitnessSubTab === 'library' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 scale-105' : 'bg-slate-800 text-slate-300 border-slate-700 group-hover:text-emerald-400'}`}>
                  <BookOpen className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white group-hover:text-emerald-300 transition-colors">Exercise Library</h3>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1 line-clamp-2">
                    Fitness-owned exercise library, independent from Football and GK, with coach-managed additions only.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="text-[11px] font-mono text-slate-400">Library Repository</span>
              <div className="flex items-center space-x-1 text-emerald-400 font-bold group-hover:translate-x-1 transition-transform">
                <span>Open Library</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </button>
        </div>
      </div>

      {fitnessSubTab === 'sessions' ? (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-2.5 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 print:hidden">
            <div className="flex items-center space-x-2">
              <button type="button" onClick={() => setSessionSubNav('cards')} className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-2 cursor-pointer ${sessionSubNav === 'cards' ? 'bg-[#002142] text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Session Library</span>
              </button>
              <button type="button" onClick={() => setSessionSubNav('editor')} className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-2 cursor-pointer ${sessionSubNav === 'editor' ? 'bg-[#002142] text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span>Session Editor</span>
              </button>
            </div>
              <button type="button" onClick={handleCreateNew} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 py-2 rounded-xl shadow-sm transition-all flex items-center justify-center space-x-2 cursor-pointer">
              <Plus className="w-4 h-4" />
              <span>New Fitness Session</span>
            </button>
          </div>

            {isCreateSessionModalOpen ? (
              <div className="fixed inset-0 z-[120] bg-slate-950/70 px-4 py-8 flex items-center justify-center">
                <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900/95 p-6 shadow-2xl">
                  <h3 className="text-lg font-black text-white">New Fitness Session</h3>
                  <div className="mt-4 space-y-2">
                    <label htmlFor="new-fitness-session-number" className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                      Session Number
                    </label>
                    <input
                      id="new-fitness-session-number"
                      type="text"
                      value={newSessionNumberInput}
                      onChange={(e) => {
                        setNewSessionNumberInput(e.target.value);
                        if (createSessionValidationError) {
                          setCreateSessionValidationError(null);
                        }
                      }}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-semibold text-white outline-none ring-0"
                      placeholder="e.g. 001, 010, 25"
                    />
                    {createSessionValidationError ? (
                      <p className="text-xs font-semibold text-rose-300">{createSessionValidationError}</p>
                    ) : null}
                  </div>

                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleCancelCreateSession}
                      className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleConfirmCreateSession()}
                      className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-500"
                    >
                      Create Session
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {saveValidationError ? (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold px-4 py-3 rounded-xl print:hidden">
              {saveValidationError}
            </div>
          ) : null}

          {sessionSubNav === 'cards' ? (
            <div className="space-y-5">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search fitness sessions..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#002142]/10 focus:border-[#0f5981] transition-all"
                  />
                </div>

                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {filteredCards.length} Matching Session{filteredCards.length !== 1 ? 's' : ''}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredCards.map((item) => (
                  <div key={item.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black uppercase text-slate-400">Fitness Session</span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">#{item.sessionNumber}</span>
                    </div>
                    <h3 className="text-sm font-extrabold text-slate-900">{item.mainObjective || 'Fitness session'}</h3>
                    <p className="text-xs text-slate-500 mt-1">{item.date} • {item.time}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFitnessId(item.id);
                          setEditorSession(toTrainingSession(item));
                          setSessionSubNav('editor');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#002142] text-white text-xs font-bold"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Open</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ModuleSessionEditor
              moduleId="fitness"
              session={editorSession}
              sharedHeader={sharedHeader}
              planningRoster={planningRoster}
              currentLogo={currentLogo}
              squadPlayers={squadPlayers}
              isSaving={isSaving}
              expandedExercises={expandedExercises}
              excludedPlayers={excludedPlayers}
              onUpdateHeader={handleUpdateHeader}
              onSave={handleSave}
              onUpdateAttendance={handleUpdateAttendance}
              onUpdateRoster={handleUpdateRoster}
              onUpdateGroups={handleUpdateGroups}
              onUpdateExercises={handleUpdateExercises}
              onToggleExpand={toggleExpand}
              onExcludePlayer={onExcludePlayer}
              onIncludePlayer={onIncludePlayer}
              onUpdateLogo={onUpdateLogo}
            />
          )}
        </div>
      ) : fitnessSubTab === 'monitoring' ? (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
              <div>
                <h2 className="text-sm font-display font-black text-slate-900 uppercase tracking-wider">Player Monitoring</h2>
                <p className="text-[10px] text-slate-400 font-bold">
                  Visual-only navigation shell. Wellness is the only active subsection for now.
                </p>
              </div>
              <span className="text-[10px] font-extrabold text-[#8a7549] bg-[#ede9e6] px-2.5 py-1 rounded-lg border border-[#a79078]/30">Structure Only</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { key: 'wellness' as const, label: 'Wellness' },
                { key: 'trainingLoad' as const, label: 'Training Load' },
                { key: 'testing' as const, label: 'Testing' }
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setMonitoringTab(item.key);
                    if (item.key === 'wellness') {
                      enterWellnessView();
                    }
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${monitoringTab === item.key ? 'bg-[#002142] text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {monitoringTab === 'wellness' ? (
              <div className="mt-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Wellness</div>
                    <h3 className="text-lg font-black text-slate-900 mt-1">Current Wellness Sheet</h3>
                    <p className="text-xs font-semibold text-slate-500 mt-1">Read-only data loaded on entry from the Google Sheet.</p>
                  </div>

                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                    <span>Available date</span>
                    <select
                      value={selectedWellnessDate}
                      onChange={(event) => setSelectedWellnessDate(event.target.value)}
                      className="min-w-44 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#002142]/10"
                    >
                      {wellnessSnapshot?.availableDates.map((date) => (
                        <option key={date} value={date}>{date}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="w-full">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Matched players</div>
                        <div className="mt-2 text-2xl font-black text-slate-900">{wellnessDiagnostics.matched.length}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Unresolved</div>
                        <div className="mt-2 text-2xl font-black text-slate-900">{wellnessDiagnostics.unresolved.length}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Ambiguous</div>
                        <div className="mt-2 text-2xl font-black text-slate-900">{wellnessDiagnostics.ambiguous.length}</div>
                      </div>
                    </div>

                    {wellnessLoadState.status === 'loading' && wellnessLoadState.source === 'cached' && wellnessSnapshot ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">
                        Refreshing Wellness data. Showing the most recently loaded records for now.
                      </div>
                    ) : null}

                    {wellnessLoadState.status === 'error' && !wellnessSnapshot ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-900">
                        Wellness data is temporarily unavailable.
                      </div>
                    ) : null}

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Wellness status</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold text-slate-700">
                          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-800"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />GREEN — Good</span>
                          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-800"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />AMBER — Attention</span>
                          <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-rose-800"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" />RED — Requires attention</span>
                        </div>
                      </div>

                      <div className="w-full rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[1280px] table-fixed border-collapse text-left text-[11px] leading-snug text-slate-700">
                            <colgroup>
                              <col className="w-[9%]" />
                              <col className="w-[5%]" />
                              <col className="w-[5%]" />
                              <col className="w-[5%]" />
                              <col className="w-[7%]" />
                              <col className="w-[5%]" />
                              <col className="w-[6%]" />
                              <col className="w-[9%]" />
                              <col className="w-[6%]" />
                              <col className="w-[8%]" />
                              <col className="w-[5%]" />
                              <col className="w-[7%]" />
                              <col className="w-[7%]" />
                              <col className="w-[7%]" />
                              <col className="w-[8%]" />
                              <col className="w-[6%]" />
                            </colgroup>
                            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                              <tr>
                                <th className="px-3 py-3">Player</th>
                                <th className="px-3 py-3">Sleep Quality</th>
                                <th className="px-3 py-3">Sleep Time</th>
                                <th className="px-3 py-3">Fatigue</th>
                                <th className="px-3 py-3">Muscle Soreness</th>
                                <th className="px-3 py-3">Stress</th>
                                <th className="px-3 py-3">Wellness Score</th>
                                <th className="px-3 py-3">Pain Location</th>
                                <th className="px-3 py-3">Pain Intensity</th>
                                <th className="px-3 py-3">Menstrual Cycle</th>
                                <th className="px-3 py-3">Period Day</th>
                                <th className="px-3 py-3">Symptoms</th>
                                <th className="px-3 py-3">Other Symptom</th>
                                <th className="px-3 py-3">Cycle Phase</th>
                                <th className="px-3 py-3">Additional Information</th>
                                <th className="px-3 py-3">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {wellnessRowsForDate.map((row) => {
                                const isSelected = selectedWellnessRow?.rowId === row.rowId;
                                const status = (row.status || '').toUpperCase();
                                const playerNumber = (() => {
                                  const found = squadPlayers.find((player) => {
                                    const nameA = `${player.firstName} ${player.lastName}`.trim();
                                    const nameB = `${player.lastName} ${player.firstName}`.trim();
                                    return nameA === row.playerName || nameB === row.playerName;
                                  });
                                  return found?.number ?? null;
                                })();

                                const statusTone = status === 'GREEN'
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                                  : status === 'AMBER'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                    : status === 'RED'
                                      ? 'bg-rose-100 text-rose-900 border border-rose-200'
                                      : 'bg-slate-100 text-slate-700 border border-slate-200';

                                const scoreTone = row.sumScore && Number(row.sumScore) >= 18
                                  ? 'text-emerald-700'
                                  : row.sumScore && Number(row.sumScore) >= 12
                                    ? 'text-amber-700'
                                    : row.sumScore && Number(row.sumScore) > 0
                                      ? 'text-rose-700'
                                      : 'text-slate-500';

                                return (
                                  <tr
                                    key={row.rowId}
                                    onClick={() => setSelectedWellnessRowId(row.rowId)}
                                    className={`cursor-pointer border-t border-slate-200 transition-colors ${isSelected ? 'bg-[#002142]/5' : 'hover:bg-slate-50'}`}
                                  >
                                    <td className="break-words px-3 py-3 align-top">
                                      <div className="font-black text-slate-900">{row.playerName}</div>
                                      {playerNumber !== null && playerNumber !== undefined ? (
                                        <div className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">#{String(playerNumber)}</div>
                                      ) : null}
                                    </td>
                                    <td className="px-3 py-3 align-top">{row.sleepQuality || '—'}</td>
                                    <td className="px-3 py-3 align-top">{row.sleepTime || '—'}</td>
                                    <td className="px-3 py-3 align-top">{row.fatigue || '—'}</td>
                                    <td className="px-3 py-3 align-top">{row.muscleSoreness || '—'}</td>
                                    <td className="px-3 py-3 align-top">{row.stress || '—'}</td>
                                    <td className={`px-3 py-3 align-top font-black ${scoreTone}`}>{row.sumScore || '—'}</td>
                                    <td className="break-words px-3 py-3 align-top">{row.pain || '—'}</td>
                                    <td className="px-3 py-3 align-top">{row.painIntensity || '—'}</td>
                                    <td className="break-words px-3 py-3 align-top">{row.menstrualCycle || '—'}</td>
                                    <td className="px-3 py-3 align-top">{row.dayOfPeriod || '—'}</td>
                                    <td className="break-words px-3 py-3 align-top">{row.symptoms || '—'}</td>
                                    <td className="break-words px-3 py-3 align-top">{row.otherSymptom || '—'}</td>
                                    <td className="break-words px-3 py-3 align-top">{row.cyclePhase || '—'}</td>
                                    <td className="break-words px-3 py-3 align-top">{row.additionalInformation || '—'}</td>
                                    <td className="px-3 py-3 align-top">
                                      <span className={`inline-flex rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.18em] ${statusTone}`}>
                                        {status || '—'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {wellnessRowsForDate.length === 0 ? (
                          <div className="rounded-b-2xl border-t border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-semibold text-slate-500">
                            No Wellness responses for the selected date.
                          </div>
                        ) : null}
                      </div>

                      {selectedWellnessRow ? (
                        <div className="w-full rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                              {(() => {
                                const selectedPlayerNumber = (() => {
                                  const found = squadPlayers.find((player) => {
                                    const nameA = `${player.firstName} ${player.lastName}`.trim();
                                    const nameB = `${player.lastName} ${player.firstName}`.trim();
                                    return nameA === selectedWellnessRow.playerName || nameB === selectedWellnessRow.playerName;
                                  });
                                  return found?.number ?? null;
                                })();

                                return (
                                  <>
                                    {selectedPlayerNumber !== null && selectedPlayerNumber !== undefined ? (
                                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">#{String(selectedPlayerNumber)}</div>
                                    ) : null}
                                    <h4 className="mt-1 text-2xl font-black uppercase tracking-tight text-slate-900">{selectedWellnessRow.playerName}</h4>
                                  </>
                                );
                              })()}
                            </div>

                            <div className="flex items-center gap-3 md:justify-end">
                              <span className={`inline-flex rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] ${selectedWellnessStatusClass}`}>
                                {String(selectedWellnessRow.status || '—').toUpperCase()}
                              </span>
                              <div className="text-right">
                                <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">Wellness Score</div>
                                <div className={`text-3xl font-black ${selectedWellnessRow.sumScore && Number(selectedWellnessRow.sumScore) >= 18 ? 'text-emerald-700' : selectedWellnessRow.sumScore && Number(selectedWellnessRow.sumScore) >= 12 ? 'text-amber-700' : selectedWellnessRow.sumScore && Number(selectedWellnessRow.sumScore) > 0 ? 'text-rose-700' : 'text-slate-500'}`}>
                                  {selectedWellnessRow.sumScore || '—'}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 grid gap-4 md:grid-cols-2">
                            <div className="rounded-2xl bg-slate-50 p-4">
                              <div className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Wellness</div>
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl bg-white p-3">
                                  <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Sleep quality</div>
                                  <div className="mt-1 text-base font-bold text-slate-800">{selectedWellnessRow.sleepQuality || '—'}</div>
                                </div>
                                <div className="rounded-2xl bg-white p-3">
                                  <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Sleep time</div>
                                  <div className="mt-1 text-base font-bold text-slate-800">{selectedWellnessRow.sleepTime || '—'}</div>
                                </div>
                                <div className="rounded-2xl bg-white p-3">
                                  <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Fatigue</div>
                                  <div className="mt-1 text-base font-bold text-slate-800">{selectedWellnessRow.fatigue || '—'}</div>
                                </div>
                                <div className="rounded-2xl bg-white p-3">
                                  <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Muscle soreness</div>
                                  <div className="mt-1 text-base font-bold text-slate-800">{selectedWellnessRow.muscleSoreness || '—'}</div>
                                </div>
                                <div className="rounded-2xl bg-white p-3">
                                  <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Stress</div>
                                  <div className="mt-1 text-base font-bold text-slate-800">{selectedWellnessRow.stress || '—'}</div>
                                </div>
                                <div className="rounded-2xl bg-white p-3">
                                  <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Wellness Score / Readiness</div>
                                  <div className="mt-1 text-base font-bold text-slate-800">{selectedWellnessRow.sumScore || '—'}</div>
                                </div>
                              </div>
                            </div>

                            <div className="rounded-2xl bg-slate-50 p-4">
                              <div className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Pain</div>
                              <div className="space-y-3">
                                <div className="rounded-2xl bg-white p-3">
                                  <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Pain location</div>
                                  <div className="mt-1 text-sm font-bold text-slate-800">{selectedWellnessRow.pain || '—'}</div>
                                </div>
                                <div className="rounded-2xl bg-white p-3">
                                  <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Pain intensity</div>
                                  <div className="mt-1 text-sm font-bold text-slate-800">{selectedWellnessRow.painIntensity || '—'}</div>
                                </div>
                              </div>
                            </div>

                            <div className="rounded-2xl bg-slate-50 p-4">
                              <div className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Menstrual / recovery</div>
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl bg-white p-3">
                                  <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Menstrual cycle</div>
                                  <div className="mt-1 text-sm font-bold text-slate-800">{selectedWellnessRow.menstrualCycle || '—'}</div>
                                </div>
                                <div className="rounded-2xl bg-white p-3">
                                  <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Period day</div>
                                  <div className="mt-1 text-sm font-bold text-slate-800">{selectedWellnessRow.dayOfPeriod || '—'}</div>
                                </div>
                                <div className="rounded-2xl bg-white p-3 sm:col-span-2">
                                  <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Cycle phase</div>
                                  <div className="mt-1 text-sm font-bold text-slate-800">{selectedWellnessRow.cyclePhase || '—'}</div>
                                </div>
                              </div>
                            </div>

                            <div className="rounded-2xl bg-slate-50 p-4">
                              <div className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Symptoms</div>
                              <div className="space-y-3">
                                <div className="rounded-2xl bg-white p-3">
                                  <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Symptoms</div>
                                  <div className="mt-1 text-sm font-bold text-slate-800">{selectedWellnessRow.symptoms || '—'}</div>
                                </div>
                                <div className="rounded-2xl bg-white p-3">
                                  <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Other symptom</div>
                                  <div className="mt-1 text-sm font-bold text-slate-800">{selectedWellnessRow.otherSymptom || '—'}</div>
                                </div>
                              </div>
                            </div>

                            <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2">
                              <div className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Additional information</div>
                              <div className="rounded-2xl bg-white p-3 text-sm font-medium text-slate-700">
                                {selectedWellnessRow.additionalInformation || '—'}
                              </div>
                            </div>

                            <div className="rounded-2xl bg-slate-50 p-4 md:col-span-2">
                              <div className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Record</div>
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl bg-white p-3">
                                  <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Date</div>
                                  <div className="mt-1 text-sm font-bold text-slate-800">{selectedWellnessRow.dateKey || '—'}</div>
                                </div>
                                <div className="rounded-2xl bg-white p-3">
                                  <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Timestamp</div>
                                  <div className="mt-1 text-sm font-bold text-slate-800">{selectedWellnessRow.timestamp || '—'}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Matching diagnostics</div>
                        <div className="mt-2 space-y-1.5 text-xs font-semibold text-slate-700">
                          <div>Matched: {wellnessDiagnostics.matched.length}</div>
                          <div>Unresolved: {wellnessDiagnostics.unresolved.length}</div>
                          <div>Ambiguous: {wellnessDiagnostics.ambiguous.length}</div>
                        </div>
                        {wellnessDiagnostics.unresolved.length > 0 ? (
                          <div className="mt-3 text-xs text-slate-600">
                            <div className="font-black uppercase tracking-wider text-slate-400">Unresolved players</div>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {wellnessDiagnostics.unresolved.map((item) => (
                                <span key={item.playerName} className="rounded-full bg-white px-2 py-1 border border-slate-200">
                                  {item.playerName}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">{monitoringTab === 'trainingLoad' ? 'Training Load' : 'Testing'}</div>
                <p className="mt-2 text-xs font-semibold text-slate-700 leading-relaxed">
                  Navigation placeholder only. Functional screens for this area will be added later.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <ExercisesLibrary
          currentSession={editorSession}
          cloudSessions={cloudLikeFitnessSessions}
          onAddExerciseToSession={(blockKey, exercise) => {
            handleUpdateExercises(blockKey, [
              ...(((blockKey === 'warmUp' ? editorSession.fitnessWarmUp : blockKey === 'mainPart' ? editorSession.fitnessMainPart : editorSession.fitnessCoolDown)?.exercises) || []),
              exercise
            ]);
          }}
          activeSection="fitness"
        />
      )}
    </div>
  );
};
