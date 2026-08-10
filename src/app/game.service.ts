import { Injectable, signal } from "@angular/core";
import { io, Socket } from "socket.io-client";
import { Ack, Phase, RevealData, RolePayload, Room } from "./game.models";

const SESSION_KEY = "impostor_session";
const WORDS_KEY = "impostor_words";

@Injectable({ providedIn: "root" })
export class GameService {
  readonly phase = signal<Phase>("home");
  readonly room = signal<Room | null>(null);
  readonly me = signal<string | null>(null);
  readonly role = signal<RolePayload | null>(null);
  readonly reveal = signal<RevealData | null>(null);
  readonly votedFor = signal<string | null>(null);
  readonly votingDeadline = signal(0);
  readonly roundStartedAt = signal(0);
  readonly connected = signal(true);
  readonly toast = signal("");

  private readonly socket: Socket;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  private reconnecting = false;

  constructor() {
    this.socket = io();
    this.socket.on("connect", () => {
      this.connected.set(true);
      this.rejoinOnce();
    });
    this.socket.on("disconnect", () => this.connected.set(false));
    this.socket.on("connect_error", () => this.connected.set(false));
    this.socket.on(
      "room:joined",
      ({ room, me }: { room: Room; me: string }) => {
        this.room.set(room);
        this.me.set(me);
        this.phase.set(this.phaseFor(room.phase));
        this.saveSession({ name: this.name(), code: room.code, playerId: me });
        history.replaceState(null, "", `/?c=${room.code}`);
      },
    );
    this.socket.on("lobby:update", (room: Room) => this.room.set(room));
    this.socket.on(
      "phase:changed",
      ({
        phase,
        startedAt,
        deadlineAt,
      }: {
        phase: string;
        startedAt?: number;
        deadlineAt?: number;
      }) => {
        if (phase === "round" && startedAt) this.roundStartedAt.set(startedAt);
        if (phase === "voting") {
          this.votedFor.set(null);
          this.votingDeadline.set(deadlineAt ?? Date.now() + 60000);
        }
        this.phase.set(this.phaseFor(phase));
        if (phase === "lobby") this.role.set(null);
      },
    );
    this.socket.on("round:started", (role: RolePayload) => {
      this.role.set(role);
      this.roundStartedAt.set(Date.now());
      this.phase.set("round");
    });
    this.socket.on("round:reveal", (data: RevealData) => {
      this.reveal.set(data);
      this.phase.set("reveal");
    });
    this.socket.on("kicked", () => {
      this.clearSession();
      this.reset();
      this.notify("Te han expulsado de la partida");
    });
    this.rejoinOnce();
  }

  create(name: string, words: string): void {
    this.saveSession({ name });
    this.saveWords(words);
    this.socket.emit(
      "room:create",
      { name, customWords: words },
      (res: Ack) => {
        if (res?.error) this.notify(res.error);
      },
    );
  }

  join(code: string, name: string, words: string): void {
    const session = this.loadSession();
    this.saveSession({ name });
    this.saveWords(words);
    this.socket.emit(
      "room:join",
      { code, name, playerId: session.playerId ?? null, customWords: words },
      (res: Ack) => {
        if (res?.error) this.notify(res.error);
      },
    );
  }

  configure(config: Record<string, string | number | boolean>): void {
    this.socket.emit("config:set", config);
  }
  start(): void {
    this.socket.emit("round:start", (res: Ack) => {
      if (res?.error) this.notify(res.error);
    });
  }
  revealNow(): void {
    this.socket.emit("round:reveal");
  }
  nextRound(): void {
    this.socket.emit("round:next");
  }
  vote(targetId: string): void {
    if (this.votedFor()) return;
    this.votedFor.set(targetId);
    this.socket.emit("vote:cast", { targetId }, (res: Ack) => {
      if (res?.error) {
        this.votedFor.set(null);
        this.notify(res.error);
      }
    });
  }
  kick(playerId: string): void {
    this.socket.emit("lobby:kick", { playerId });
  }
  leave(): void {
    this.socket.emit("lobby:leave");
    this.clearSession();
    this.reset();
  }
  copyLink(): void {
    const url = `${location.origin}/?c=${this.room()?.code ?? ""}`;
    navigator.clipboard
      ?.writeText(url)
      .then(() => this.notify("Enlace copiado"))
      .catch(() => window.prompt("Copia el enlace:", url));
  }
  notify(message: string): void {
    this.toast.set(message);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(""), 3500);
  }
  loadWords(): string {
    try {
      return localStorage.getItem(WORDS_KEY) ?? "";
    } catch {
      return "";
    }
  }
  saveWords(value: string): void {
    try {
      localStorage.setItem(WORDS_KEY, value);
    } catch {
      /* private storage can be unavailable */
    }
  }
  wordsCount(value: string): number {
    return value
      .split(/[\n,;]+/)
      .map((word) => word.trim())
      .filter((word) => word.length >= 2 && word.length <= 40).length;
  }
  name(): string {
    return this.loadSession().name ?? "";
  }

  private phaseFor(value: string): Phase {
    return ["lobby", "round", "voting", "reveal"].includes(value)
      ? (value as Phase)
      : "waiting";
  }
  private rejoinOnce(): void {
    if (this.reconnecting) return;
    const session = this.loadSession();
    if (!session.code || !session.playerId || !session.name) return;
    this.reconnecting = true;
    this.socket.emit(
      "room:join",
      {
        code: session.code,
        name: session.name,
        playerId: session.playerId,
        customWords: this.loadWords(),
      },
      (res: Ack) => {
        this.reconnecting = false;
        if (res?.error && !/otra pestaña/.test(res.error)) this.clearSession();
      },
    );
  }
  private loadSession(): { name?: string; code?: string; playerId?: string } {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) ?? "{}") as {
        name?: string;
        code?: string;
        playerId?: string;
      };
    } catch {
      return {};
    }
  }
  private saveSession(session: {
    name: string;
    code?: string;
    playerId?: string;
  }): void {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  private clearSession(): void {
    localStorage.removeItem(SESSION_KEY);
  }
  private reset(): void {
    this.phase.set("home");
    this.room.set(null);
    this.me.set(null);
    this.role.set(null);
    this.reveal.set(null);
    this.votedFor.set(null);
  }
}
