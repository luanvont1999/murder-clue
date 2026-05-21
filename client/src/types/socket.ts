export type RoomStatus = "waiting" | "playing" | "finished";

export interface RoomStatePayload {
  room: string;
  members: number;
  maxMembers: number;
  url?: string;
  hostId: string;
  isHost: boolean;
  status: RoomStatus;
  playerIds: string[];
  canStart: boolean;
  hasSubmitted?: boolean;
  submittedCount?: number;
  game: { startedAt: number } | null;
  myResult?: { correctCount: number; elapsedMs: number } | null;
}

export interface RoomAck extends Partial<RoomStatePayload> {
  ok?: boolean;
  created?: boolean;
  error?: string;
  message?: string;
}

export interface RoomErrorPayload {
  error: string;
  message: string;
}

export interface GameStartedPayload {
  myNumbers: number[];
  playerIndex: number;
  startedAt: number;
  pairs: [number, number][];
}

export interface SubmitAnswerAck {
  ok?: boolean;
  correctCount?: number;
  elapsedMs?: number;
  submittedCount?: number;
  error?: string;
  message?: string;
}

export interface LeaderboardEntry {
  rank: number;
  playerIndex: number;
  displayName?: string;
  correctCount: number;
  elapsedMs: number;
}

export interface GameEndedPayload {
  leaderboard: LeaderboardEntry[];
}

export interface GameSubmitProgressPayload {
  submittedCount: number;
  maxMembers: number;
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected";
