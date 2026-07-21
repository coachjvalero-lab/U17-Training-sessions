export type GameMoment = 'Ataque' | 'Defensa' | 'Transición A-D' | 'Transición D-A' | 'Balón Parado' | 'Otro';

export interface Exercise {
  id: string;
  name: string;
  gameMoment: GameMoment;
  subMoment: string;
  description: string;
  duration: string; // e.g., "15 min"
  dimensions: string; // e.g., "40x30m"
  coachRoles: string; // e.g., "Coach A: Árbitro, Coach B: Feedback"
  image?: string; // base64 image or placeholder
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
  mainObjective: string;
  teamLogo?: string; // base64
  warmUp: TrainingBlock;
  mainPart: TrainingBlock;
  coolDown: TrainingBlock;
  playerGroups: PlayerGroup[];
  materialsNeeded: string; // comma separated or bullet list
}
