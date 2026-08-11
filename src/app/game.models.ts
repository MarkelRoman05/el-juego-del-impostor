export type Phase =
  | "home"
  | "lobby"
  | "round"
  | "voting"
  | "result"
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
  timer: number;
  voting: boolean;
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
  timer: number;
  impostors?: string[];
}
export interface VoteResult {
  id: string;
  name: string;
  count: number;
}
export interface Ballot {
  from: string;
  to: string;
}
export interface LiveVote {
  from: string;
  to: string;
}
export interface RevealData {
  eliminated: { id: string; name: string } | null;
  tied: boolean;
  votes: VoteResult[];
  ballots: Ballot[];
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
