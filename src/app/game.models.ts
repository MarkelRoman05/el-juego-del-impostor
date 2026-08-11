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
  round: number;
  players: Player[];
  config: RoomConfig;
}
export interface RolePayload {
  role: Role;
  word?: string;
  category: string;
  round: number;
  impostors?: string[];
}
export interface RevealData {
  round: number;
  gameOver: boolean;
  word?: string;
  reason?: string;
  impostors?: Array<{ id: string; name: string }>;
}
export interface Ack {
  ok?: boolean;
  error?: string;
}
