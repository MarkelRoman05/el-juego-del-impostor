export type Phase =
  | "home"
  | "lobby"
  | "round"
  | "voting"
  | "reveal"
  | "waiting";
export type Role = "player" | "impostor";

export interface Player {
  id: string;
  name: string;
  connected: boolean;
}
export interface RoomConfig {
  impostors: number;
  category: string;
  customWordsCount: number;
  timer: number;
  voting: boolean;
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
export interface RevealData {
  impostors: Array<{ id: string; name: string }>;
  votes: VoteResult[];
  ballots: Ballot[];
  word: string;
  category: string;
  round: number;
}
export interface Ack {
  ok?: boolean;
  error?: string;
}
