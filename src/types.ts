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

export type AbsenceReason = 'Vacation' | 'Study' | 'Injury' | 'Permission' | 'Unknown';

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
  | 'planning';

export interface PlayerAttendance {
  playerName: string;
  status: 'Attending' | 'Absent' | 'Gym';
  absenceReason?: AbsenceReason;
  notes?: string;
}

export interface Exercise {
  id: string;
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

export interface MatchFixture {
  id: string;
  opponent: string;
  opponentLogo?: string;
  date: string;
  time: string;
  location: 'Home' | 'Away' | 'Neutral';
  venue?: string;
  competitionName: string;
  matchday?: string;
  status: 'Scheduled' | 'Played' | 'Postponed' | 'Cancelled';
  result?: {
    ourGoals: number;
    opponentGoals: number;
  };
  tacticalNotes?: string;
  lineup?: string[];
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
