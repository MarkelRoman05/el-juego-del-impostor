export type Phase =
  | "home"
  | "lobby"
  | "round"
  | "gameover"
  | "waiting";
export type Role = "player" | "impostor";

export interface Player {
  id: string;
  name: string;
  connected: boolean;
  eliminated?: boolean;
  waiting?: boolean;
}
export interface RoomConfig {
  impostors: number;
  category: string;
  customWordsCount: number;
  impostorHint: boolean;
  hostPlays: boolean;
}
export interface Room {
  code: string;
  hostId: string | null;
  phase: string;
  players: Player[];
  config: RoomConfig;
}
export interface RolePayload {
  role: Role;
  word?: string;
  category: string;
  pista?: string;
  info?: string;
  starter?: string;
  starterId?: string;
  impostors?: string[];
  startedAt?: number;
}
export interface RevealData {
  gameOver: boolean;
  word?: string;
  category?: string;
  info?: string;
  reason?: string;
  durationMs?: number;
  impostors?: Array<{ id: string; name: string }>;
}
export interface Ack {
  ok?: boolean;
  error?: string;
}
