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

export interface PhysioRecord {
  id: string;
  playerId: string;
  playerName: string;
  injuryDate: string;
  injuryType: string;
  severity: 'Mild' | 'Moderate' | 'Severe';
  status: 'Active Treatment' | 'Rehab / Field Work' | 'Cleared for Training' | 'Closed';
  treatmentNotes: string;
  estimatedReturnDate?: string;
  physioName?: string;
  updatedAt: string;
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
  status: 'Attending' | 'Absent' | 'Gym';
  absenceReason?: AbsenceReason;
  notes?: string;
}

export interface Exercise {
  id: string;
  module?: ExerciseModule;
  name: string;
  gameMoment: GameMoment;
  subMoment: string;
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

export interface Match {
  id: string;
  teamId: string;
  opponentTeamId: string;
  fixtureId?: string | null;
  competitionName: string;
  date: string;
  time: string;
  venue?: string | null;
  location?: string | null;
  isHome: boolean;
  status: MatchStatus;
  ourScore?: number | null;
  opponentScore?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface OpponentAnalysis {
  id: string;
  matchId: string;
  opponentTeamId: string;
  tags: OpponentAnalysisTag[];
  slidesUrl?: string | null;
  videoUrl?: string | null;
  summary: string;
  createdAt?: string;
  updatedAt?: string;
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
  sessionNumber: number;
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
