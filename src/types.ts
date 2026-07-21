export type GameMoment = 'Attack' | 'Defense' | 'Transition A-D' | 'Transition D-A' | 'Set Pieces' | 'Other';

export interface Exercise {
  id: string;
  name: string;
  gameMoment: GameMoment;
  subMoment: string;
  description: string;
  duration: string; // e.g., "15 min"
  dimensions: string; // e.g., "40x30m"
  coachRoles: string; // e.g., "Coach A: Referee, Coach B: Feedback"
  image?: string; // base64 image or placeholder
  playerGroups?: string; // Player groups assignment for this exercise
}

export interface TrainingBlock {
  id: string;
  title: string;
  exercises: Exercise[];
}

export interface PlayerGroup {
  id: string;
  groupNumber: number;
  bibColor: string; // HEX color or color class
  players: string; // comma separated or text list
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
  warmUp: TrainingBlock;
  mainPart: TrainingBlock;
  coolDown: TrainingBlock;
  playerGroups: PlayerGroup[];
  materialsNeeded: string; // comma separated or bullet list
}
