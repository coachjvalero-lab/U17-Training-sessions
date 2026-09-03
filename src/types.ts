export type GameMoment = 
  | 'Attack' 
  | 'Defense' 
  | 'Transition A-D' 
  | 'Transition D-A' 
  | 'Set Pieces' 
  | 'Match' 
  | 'Other' 
  | '-'
  | 'Shot stop'
  | 'Depth control'
  | '1 vs 1'
  | 'Feet distribution'
  | 'Cross defending';

export type ExerciseModule = 'football' | 'fitness' | 'gk';

export type AbsenceReason = 'Vacation' | 'Study' | 'Injury' | 'Permission' | 'Unknown';

export interface AttendanceStats {
  attended: number;
  total: number;
  percentage: number;
  ranking: number;
  updatedAt: number;
}

export interface MalikaHistoryEntry {
  assignmentId?: string;
  sessionId: string;
  exerciseId: string;
  date: number;
  challenge: string;
  points: number;
}

export interface SquadPlayer {
  id: string;
  firstName: string;
  lastName: string;
  number?: string | number;
  position: 'GK' | 'CB' | 'LB' | 'RB' | 'CM' | 'CAM' | 'CDM' | 'RW' | 'LW' | 'ST' | 'UTIL';
  status: 'Active' | 'Injured' | 'Recovering' | 'Absent';
  notes?: string;
  joinedDate?: string;
  photoUrl?: string;
  age?: number;
  nationality?: string;
  preferredFoot?: 'Right' | 'Left' | 'Both';
  heightCm?: number;
  weightKg?: number;
  attendanceStats?: AttendanceStats;
  malikaPoints?: number;
  malikaHistory?: MalikaHistoryEntry[];
}

export type PhysioContext = 'training' | 'match' | 'external' | 'unknown';
export type ClinicalInjuryStatus = 'open' | 'under_treatment' | 'rehab' | 'return_to_training' | 'return_to_play' | 'closed';
export type AffectedSide = 'right' | 'left' | 'bilateral' | 'not_applicable' | 'unknown';
export type InjuryType = 'bone' | 'joint_non_bone' | 'ligament' | 'tendon' | 'muscle' | 'skin' | 'pain_non_specific' | 'other';

export interface Injury {
  id: string;
  teamId: string;
  playerId: string;
  injuryDate: string;
  context: PhysioContext;
  trainingSessionId?: string | null;
  matchId?: string | null;
  location: string;
  affectedSide: AffectedSide;
  injuryType: InjuryType;
  clinicalDiagnosis?: string | null;
  medicalDiagnosis?: string | null;
  imagingDiagnosis?: string | null;
  finalDiagnosis?: string | null;
  diagnosisStatus: 'not_established' | 'clinical' | 'medical' | 'imaging' | 'final';
  injuryGrade?: string | null;
  previousSimilarInjury: boolean;
  occurrenceType: 'first_occurrence' | 'recurrent';
  previousInjuryId?: string | null;
  previousInjuryDate?: string | null;
  sameLocation?: boolean | null;
  sameDiagnosis?: boolean | null;
  playingSurface?: string | null;
  contactType?: 'contact' | 'non_contact' | null;
  contactWith: 'opponent' | 'teammate' | 'other' | 'not_applicable';
  activities: string[];
  painScore?: number | null;
  onset?: 'sudden' | 'gradual' | null;
  popSensation: boolean;
  swelling: boolean;
  instability: boolean;
  lossOfStrength: boolean;
  reducedRangeOfMotion: boolean;
  otherSymptoms?: string | null;
  trainingDurationMinutes?: number | null;
  trainingMinute?: number | null;
  trainingPhase?: 'warm_up' | 'main_part' | 'end_of_training' | null;
  playerContinued?: boolean | null;
  continuedWithLimitations?: boolean | null;
  leftTraining?: boolean | null;
  playingTimeMinutes?: number | null;
  matchMinute?: number | null;
  matchPhase?: 'warm_up' | 'first_half' | 'half_time' | 'second_half' | null;
  leftMatch?: boolean | null;
  currentStatus: ClinicalInjuryStatus;
  estimatedReturnDate?: string | null;
  actualReturnDate?: string | null;
  closedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface InjuryFollowUp {
  id: string;
  injuryId: string;
  followUpDate: string;
  treatmentPhase: string;
  treatmentPerformed: string;
  responseToTreatment?: string | null;
  injuryProgression?: string | null;
  status: ClinicalInjuryStatus;
  nextReviewDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PhysioComplaint {
  id: string;
  teamId: string;
  playerId: string;
  occurrenceDate: string;
  context: PhysioContext;
  trainingSessionId?: string | null;
  matchId?: string | null;
  complaintType: 'pain' | 'fatigue' | 'muscle_soreness' | 'cramp' | 'stiffness' | 'feeling_of_weakness' | 'feeling_of_instability' | 'dizziness' | 'feeling_unwell' | 'other';
  location: string;
  affectedSide: AffectedSide;
  leftActivity: boolean;
  durationBand: 'less_than_24h' | '1_to_3_days' | '4_to_7_days' | 'more_than_7_days';
  outcome: 'resolved' | 'ongoing' | 'became_injury';
  resultingInjuryId?: string | null;
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PhysioPlayerContext {
  playerId: string;
  playerName: string;
  shirtNumber?: string | null;
  position: string;
  currentStatus: SquadPlayer['status'];
}

export interface PhysioTrainingContext {
  sessionId: string;
  sessionDate: string;
  sessionTime: string;
  sessionNumber: string;
  durationMinutes?: number | null;
}

export interface PhysioMatchContext {
  matchId: string;
  matchDate: string;
  opponentName: string;
  matchStatus: MatchStatus;
}

export interface VideoAnalysis {
  id: string;
  title: string;
  matchOrSessionDate: string;
  opponentOrTopic: string;
  videoUrl: string;
  gameMoment: GameMoment;
  tags: string[];
  keyTimestamps: { time: string; note: string }[];
  summary: string;
  createdAt: string;
}

export type PortalSection = 
  | 'hub' 
  | 'football' 
  | 'fitness' 
  | 'gk' 
  | 'squad' 
  | 'attendance' 
  | 'physio' 
  | 'video' 
  | 'exercises' 
  | 'planning'
  | 'meetings';

export interface PlayerAttendance {
  playerName: string;
  status: 'Attending' | 'Absent' | 'Gym' | 'First Team' | 'National Team Call';
  absenceReason?: AbsenceReason;
  notes?: string;
}

export interface Exercise {
  id: string;
  module?: ExerciseModule;
  name: string;
  gameMoment: GameMoment;
  subMoment: string;
  gameMoment2?: GameMoment;
  subMoment2?: string;
  description: string;
  duration: string; // e.g., "15 min"
  series?: number | string; // Number of sets/series e.g. 3
  workTime?: number | string; // Work duration per series in min e.g. 4
  restTime?: number | string; // Rest duration between series in min e.g. 1
  dimensions: string; // e.g., "40x30m"
  coachRoles: string; // e.g., "Coach A: Referee, Coach B: Feedback"
  image?: string; // base64 image or placeholder
  playerGroups?: string; // Player groups assignment for this exercise
  hideGraphics?: boolean; // Hide tactical diagram graphics box
  isFitness?: boolean; // Indicates exercise belongs to Fitness tab
  malikaChallenge?: {
    enabled: boolean;
    title: string;
    defaultPoints: number;
  };
}

export interface FitnessSession {
  id: string;
  sessionUid: string;
  legacySessionId?: string;
  teamName: string;
  date: string;
  time: string;
  sessionNumber: string;
  microcycleDay: string;
  mainObjective: string;
  materialsNeeded: string;
  observations?: string;
  squadRoster: string[];
  attendance: PlayerAttendance[];
  fitnessWarmUp: TrainingBlock;
  fitnessMainPart: TrainingBlock;
  fitnessCoolDown: TrainingBlock;
  fitnessPlayerGroups: PlayerGroup[];
  createdAt: number;
  updatedAt: number;
}

export interface GkSession {
  id: string;
  sessionUid: string;
  legacySessionId?: string;
  teamName: string;
  date: string;
  time: string;
  sessionNumber: string;
  microcycleDay: string;
  mainObjective: string;
  materialsNeeded: string;
  observations?: string;
  squadRoster: string[];
  attendance: PlayerAttendance[];
  gkWarmUp: TrainingBlock;
  gkMainPart: TrainingBlock;
  gkCoolDown: TrainingBlock;
  gkPlayerGroups: PlayerGroup[];
  createdAt: number;
  updatedAt: number;
}

export interface TrainingBlock {
  id: string;
  title: string;
  exercises: Exercise[];
}

export interface PlayerGroup {
  id: string;
  groupNumber: number;
  bibColor: string; // HEX color or color class e.g. #2563eb
  players: string; // comma separated or text list
  name?: string; // e.g., "Peto Azul", "Grupo A"
}

export type MatchStatus = 'planned' | 'played';
export type TeamSide = 'our_team' | 'opponent';
export type MatchEventType =
  | 'goal'
  | 'opponent_goal'
  | 'corner'
  | 'opponent_corner'
  | 'assist'
  | 'yellow_card'
  | 'red_card'
  | 'substitution_in'
  | 'substitution_out'
  | 'own_goal'
  | 'injury'
  | 'other';

export type OpponentAnalysisTag =
  | 'short'
  | 'long'
  | 'mixed'
  | 'high'
  | 'medium'
  | 'low'
  | 'direct'
  | 'possession'
  | 'immediate_pressure'
  | 'retreat';

export type MatchCategory = 'official' | 'friendly' | 'preseason' | 'other';

export interface Match {
  id: string;
  teamId: string;
  opponentTeamId: string;
  opponentName?: string; // Human-readable opponent name from auth_teams
  opponentLogoUrl?: string | null;
  fixtureId?: string | null;
  competitionName: string;
  matchCategory: MatchCategory;
  date: string;
  time: string;
  venue?: string | null;
  location?: string | null;
  isHome: boolean;
  status: MatchStatus;
  ourScore?: number | null;
  opponentScore?: number | null;
  videoUrl?: string | null;
  squadCallConfirmedAt?: string | null;
  squadCallConfirmedPlayerIds?: string[] | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface OpponentAnalysis {
  id: string;
  opponentTeamId: string;
  tags: OpponentAnalysisTag[];
  slidesUrl?: string | null;
  videoUrl?: string | null;
  summary: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MatchAnalysis {
  id: string;
  matchId: string;
  summary: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface VideoClip {
  id: string;
  videoUrl: string;
  startTime: number;
  endTime?: number | null;
  title: string;
  notes?: string | null;
  createdAt?: string;
  matchAnalysisId?: string | null;
  opponentMatchNotesId?: string | null;
  trainingAnalysisId?: string | null;
  scoutingReportId?: string | null;
}

export interface MatchLineupEntry {
  id: string;
  matchId: string;
  playerId: string;
  position: string;
  starter: boolean;
  shirtNumber?: number | null;
  captain: boolean;
  minuteSubbedIn?: number | null;
  minuteSubbedOut?: number | null;
  notes?: string | null;
  pitchX?: number | null;
  pitchY?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MatchEvent {
  id: string;
  matchId: string;
  playerId?: string | null;
  teamSide: TeamSide;
  eventType: MatchEventType;
  minute: number;
  videoTimestampSeconds: number;
  relatedPlayerId?: string | null;
  description: string;
  createdAt?: string;
}

export interface PlayerMatchStatistics {
  id: string;
  matchId: string;
  playerId: string;
  minutesPlayed: number;
  starts: boolean;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlayerMatchStatisticsSummary {
  playerId: string;
  playerName: string;
  apps: number;
  starts: number;
  minutes: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
}

export type MatchPlanPhase = 'attack' | 'defence' | 'transitions';

export interface MatchPlanEntry {
  id: string;
  matchId: string;
  phase: MatchPlanPhase;
  notes: string;
  videoUrl?: string | null;
  image1Url?: string | null;
  image2Url?: string | null;
  pdfUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MatchSetPieces {
  id: string;
  matchId: string;
  attackingNotes: string;
  attackingVideoUrl?: string | null;
  attackingImage1Url?: string | null;
  attackingImage2Url?: string | null;
  defensiveNotes: string;
  defensiveVideoUrl?: string | null;
  defensiveImage1Url?: string | null;
  defensiveImage2Url?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type SetPiecePlayType =
  | 'corner'
  | 'defensive_corner'
  | 'attacking_free_kick'
  | 'defensive_free_kick'
  | 'throw_in'
  | 'kick_off'
  | 'other';

export const SET_PIECE_PLAY_TYPES: Array<{ value: SetPiecePlayType; label: string }> = [
  { value: 'corner', label: 'Corner' },
  { value: 'defensive_corner', label: 'Defensive Corner' },
  { value: 'attacking_free_kick', label: 'Attacking Free Kick' },
  { value: 'defensive_free_kick', label: 'Defensive Free Kick' },
  { value: 'throw_in', label: 'Throw-in' },
  { value: 'kick_off', label: 'Kick-off' },
  { value: 'other', label: 'Other' }
];

export type SetPieceMarkerKind = 'player' | 'opponent' | 'ball';

export interface SetPieceMarker {
  id: string;
  kind: SetPieceMarkerKind;
  x: number;
  y: number;
  label?: string;
}

export interface SetPieceArrow {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  style: 'run' | 'pass';
}

export interface SetPieceZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

export interface SetPieceText {
  id: string;
  x: number;
  y: number;
  content: string;
}

export interface SetPieceDiagram {
  markers: SetPieceMarker[];
  arrows: SetPieceArrow[];
  zones: SetPieceZone[];
  texts: SetPieceText[];
}

export const EMPTY_SET_PIECE_DIAGRAM: SetPieceDiagram = { markers: [], arrows: [], zones: [], texts: [] };

export interface SetPiecePlay {
  id: string;
  matchId: string;
  title: string;
  type: SetPiecePlayType;
  diagram: SetPieceDiagram;
  description: string;
  coachingPoints: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TrainingSession {
  id: string;
  teamName: string;
  date: string;
  time: string;
  sessionNumber: string;
  microcycleDay: string; // e.g., "MD-3" or "Tuesday"
  mainObjective: string;
  teamLogo?: string; // base64
  squadRoster?: string[]; // Custom list of squad players
  warmUp: TrainingBlock;
  mainPart: TrainingBlock;
  coolDown: TrainingBlock;
  playerGroups: PlayerGroup[];
  materialsNeeded: string; // comma separated or bullet list
  observations?: string; // Private coach notes (screen only, hidden on PDF print)
  fitnessWarmUp?: TrainingBlock;
  fitnessMainPart?: TrainingBlock;
  fitnessCoolDown?: TrainingBlock;
  fitnessPlayerGroups?: PlayerGroup[];
  gkWarmUp?: TrainingBlock;
  gkMainPart?: TrainingBlock;
  gkCoolDown?: TrainingBlock;
  gkPlayerGroups?: PlayerGroup[];
  attendance?: PlayerAttendance[];
}

export interface CloudTrainingSession extends TrainingSession {
  updatedAt: number;
  footballUpdatedAt?: number;
  fitnessUpdatedAt?: number;
  gkUpdatedAt?: number;
}

export type MicrocycleStatus = 'draft' | 'active' | 'archived';

export type MicrocycleLoadValue =
  | 'Very Low'
  | 'Low / Moderate-Low'
  | 'Moderate-High'
  | 'Very High'
  | 'Match'
  | string;

export type MicrocycleAvailabilityCategory =
  | 'absent'
  | 'injured'
  | 'a_team'
  | 'u15'
  | 'national_team_u20'
  | 'national_team_u17';

export interface MicrocycleDayConcept {
  id: string;
  microcycleDayId: string;
  sortOrder: number;
  concept: string;
  objective: string;
}

export interface MicrocycleDay {
  id: string;
  microcycleId: string;
  dayOrder: number;
  dayDate: string;
  dayLabel: string;
  trainingSession: string;
  sessionType: string;
  mdLabel: string;
  duration: string;
  load: MicrocycleLoadValue;
  stage: string;
  before: string;
  preTrainingSession: string;
  warmUp: string;
  pitch: string;
  objectivesText: string;
  postTrainingSession: string;
  after: string;
  notes: string;
  sessionId?: string;
  concepts: MicrocycleDayConcept[];
}

export interface MicrocyclePlayerAvailability {
  id: string;
  microcycleId: string;
  category: MicrocycleAvailabilityCategory;
  playerId?: string;
  playerNameSnapshot: string;
  notes: string;
}

export interface Microcycle {
  id: string;
  teamId: string;
  teamName: string;
  name: string;
  weekNumber?: number;
  startDate: string;
  endDate: string;
  status: MicrocycleStatus;
  teamTotal?: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
  days: MicrocycleDay[];
  availability: MicrocyclePlayerAvailability[];
}

export interface MicrocycleSearchFilters {
  date: string;
  weekNumber: string;
  concept: string;
  sessionType: string;
  load: string;
}

export interface SessionCardDocument {
  id: string;
  sessionNumber: string;
  title: string;
  description: string;
  category: string;
  duration: string;
  intensity: string;
  date: string;
  createdAt: number;
  updatedAt: number;
  role: 'football' | 'fitness' | 'gk';
}

export interface SharedSessionHeader {
  id: string;
  sessionNumber: string;
  date: string;
  time: string;
  teamName: string;
  microcycleDay: string;
  attendance: PlayerAttendance[];
  squadRoster: string[];
  updatedAt?: number;
}

// ---------------------------------------------------------------------------
// Meetings Module
// ---------------------------------------------------------------------------

export type MeetingType =
  | 'staff_meeting'
  | 'coaching_meeting'
  | 'player_meeting'
  | 'performance_meeting'
  | 'medical_physio_meeting'
  | 'recruitment_meeting'
  | 'other';

export type ActionItemStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface MeetingAttendee {
  id: string;
  meetingId: string;
  userId: string;              // UUID FK to user_profiles
  displayName?: string;        // snapshot of user name at time of meeting
  userEmail?: string;          // for display (derived from JOIN)
}

export interface MeetingActionItem {
  id: string;
  meetingId: string;
  description: string;
  assignedToUserId?: string;   // UUID FK to user_profiles (nullable)
  assignedToDisplayName?: string;  // for display (derived from JOIN)
  assignedToEmail?: string;        // for display (derived from JOIN)
  dueDate?: string;               // ISO date
  status: ActionItemStatus;
  completedAt?: string;           // ISO timestamp
  createdAt: string;
  updatedAt: string;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;              // ISO date
  startTime?: string;        // HH:MM
  endTime?: string;          // HH:MM
  location?: string;
  meetingType: MeetingType;
  organizerUserId?: string;  // UUID FK to user_profiles
  organizerDisplayName?: string;  // for display
  organizerEmail?: string;        // for display
  topic: string;
  agenda: string;
  summary: string;
  keyPoints: string[];
  decisions: string[];
  attendees: MeetingAttendee[];
  actionItems: MeetingActionItem[];
  createdAt: string;
  updatedAt: string;
  createdByUserId?: string;  // UUID FK to user_profiles
  createdByDisplayName?: string;
  createdByEmail?: string;
  updatedByUserId?: string;  // UUID FK to user_profiles
  updatedByDisplayName?: string;
  updatedByEmail?: string;
}
