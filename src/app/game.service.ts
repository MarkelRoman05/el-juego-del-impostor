import { Injectable, signal } from "@angular/core";
import { io, Socket } from "socket.io-client";
import { Ack, LiveVote, Phase, RevealData, RolePayload, Room } from "./game.models";

const SESSION_KEY = "impostor_session";

@Injectable({ providedIn: "root" })
export class GameService {
  readonly phase = signal<Phase>("home");
  readonly room = signal<Room | null>(null);
  readonly me = signal<string | null>(null);
  readonly role = signal<RolePayload | null>(null);
  readonly reveal = signal<RevealData | null>(null);
  readonly votedFor = signal<string | null>(null);
  readonly votingDeadline = signal(0);
  readonly liveVotes = signal<LiveVote[]>([]);
  readonly wordOptions = signal<string[]>([]);
  readonly roundStartedAt = signal(0);
  readonly connected = signal(false);
  readonly reconnecting = signal(false);
  readonly toast = signal("");

  private readonly socket: Socket;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  private rejoinInProgress = false;
  private rejoinTimeout: ReturnType<typeof setTimeout> | undefined;
  private rejoinRetry: ReturnType<typeof setTimeout> | undefined;
  private everConnected = false;
  private restoringSession = false;

  constructor() {
    const session = this.loadSession();
    this.restoringSession = Boolean(session.code && session.playerId && session.reconnectToken && session.name);
    this.reconnecting.set(this.restoringSession);
    this.socket = io();
    this.socket.on("connect", () => {
      this.connected.set(true);
      clearTimeout(this.rejoinTimeout);
      clearTimeout(this.rejoinRetry);
      this.rejoinInProgress = false;
      this.reconnecting.set(Boolean(this.loadSession().code));
      this.everConnected = true;
      this.rejoinOnce();
    });
    this.socket.on("disconnect", () => {
      clearTimeout(this.rejoinTimeout);
      this.rejoinInProgress = false;
      if (this.everConnected) this.reconnecting.set(true);
      this.connected.set(false);
    });
    this.socket.on("connect_error", () => {
      if (this.everConnected) this.reconnecting.set(true);
      this.connected.set(false);
    });
    this.socket.on(
      "room:joined",
      ({ room, me, reconnectToken }: { room: Room; me: string; reconnectToken: string }) => {
        this.restoringSession = false;
        this.reconnecting.set(false);
        this.room.set(room);
        this.me.set(me);
        this.reveal.set(null);
        this.votedFor.set(null);
        this.liveVotes.set([]);
        this.wordOptions.set([]);
        this.phase.set(this.phaseFor(room.phase));
        this.saveSession({ name: this.name(), code: room.code, playerId: me, reconnectToken });
        history.replaceState(null, "", `/?c=${room.code}`);
      },
    );
    this.socket.on("lobby:update", (room: Room) => {
      const previous = this.room();
      if (previous?.code === room.code) this.notifyPlayerChanges(previous, room);
      this.room.set(room);
    });
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
        if (phase === "round") {
          this.reveal.set(null);
          this.liveVotes.set([]);
        }
        if (phase === "voting") {
          this.reveal.set(null);
          this.votedFor.set(null);
          this.liveVotes.set([]);
          this.votingDeadline.set(deadlineAt ?? Date.now() + 60000);
        }
        this.phase.set(this.phaseFor(phase));
        if (phase === "lobby") {
          this.role.set(null);
          this.reveal.set(null);
          this.liveVotes.set([]);
          this.wordOptions.set([]);
        }
      },
    );
    this.socket.on("round:started", (role: RolePayload) => {
      this.role.set(role);
      this.roundStartedAt.set(Date.now());
      this.phase.set("round");
    });
    this.socket.on("vote:update", (votes: LiveVote[]) => this.liveVotes.set(votes));
    this.socket.on("word:options", (words: string[]) => this.wordOptions.set(words));
    this.socket.on("round:result", (data: RevealData) => {
      this.reveal.set(data);
      this.phase.set("result");
    });
    this.socket.on("game:over", (data: RevealData) => {
      this.reveal.set(data);
      this.phase.set("gameover");
    });
    this.socket.on("kicked", () => {
      this.clearSession();
      this.reset();
      this.notify("Te han expulsado de la partida");
    });
    this.socket.on("session:replaced", () => {
      this.clearSession();
      this.reset();
      this.reconnecting.set(false);
      this.socket.disconnect();
      this.notify("Esta sesión fue reemplazada desde otra pestaña");
    });
    this.socket.on("vote:state", ({ targetId }: { targetId: string | null }) => {
      this.votedFor.set(targetId);
    });
    this.socket.on("game:ended", () => {
      this.clearSession();
      this.reset();
      this.notify("La partida ha terminado");
    });
  }

  create(name: string): void {
    this.saveSession({ name });
    this.socket.emit(
      "room:create",
      { name },
      (res: Ack) => {
        if (res?.error) this.notify(res.error);
      },
    );
  }

  join(code: string, name: string): void {
    const session = this.loadSession();
    this.saveSession({ name });
    this.socket.emit(
      "room:join",
      { code, name, playerId: null },
      (res: Ack) => {
        if (res?.error) this.notify(res.error);
      },
    );
  }

  configure(config: Record<string, string | number | boolean>): void {
    this.room.update((room) => room
      ? { ...room, config: { ...room.config, ...config } }
      : room);
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
  leaveRound(): void {
    this.socket.emit("round:leave", (res: Ack) => {
      if (res?.error) this.notify(res.error);
    });
  }
  endGame(): void {
    this.socket.emit("game:end", (res: Ack) => {
      if (res?.error) this.notify(res.error);
    });
  }
  nextRound(): void {
    this.socket.emit("round:next");
  }
  markImpostor(playerId: string): void {
    this.socket.emit("impostor:mark", { playerId }, (res: Ack) => {
      if (res?.error) this.notify(res.error);
    });
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
  copyCode(): void {
    const code = this.room()?.code ?? "";
    navigator.clipboard
      ?.writeText(code)
      .then(() => this.notify("Código copiado"))
      .catch(() => window.prompt("Copia el código:", code));
  }
  notify(message: string): void {
    this.toast.set(message);
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(""), 4000);
  }
  name(): string {
    return this.loadSession().name ?? "";
  }
  isEliminated(): boolean {
    const me = this.me();
    return Boolean(me && this.room()?.players.find((player) => player.id === me)?.eliminated);
  }
  isObserver(): boolean {
    return this.isEliminated() || (
      this.me() === this.room()?.hostId && this.room()?.config.hostPlays === false
    );
  }

  private phaseFor(value: string): Phase {
    return ["lobby", "round", "voting", "result", "gameover"].includes(value)
      ? (value as Phase)
      : "waiting";
  }
  private notifyPlayerChanges(previous: Room, current: Room): void {
    const previousPlayers = new Map(previous.players.map((player) => [player.name, player]));
    const currentPlayers = new Map(current.players.map((player) => [player.name, player]));

    for (const [name, player] of currentPlayers) {
      const oldPlayer = previousPlayers.get(name);
      if (!oldPlayer) {
        this.notify(`${name} se ha unido a la partida`);
      } else if (!oldPlayer.connected && player.connected) {
        this.notify(`${name} se ha reconectado`);
      }
    }
    for (const [name, player] of previousPlayers) {
      const currentPlayer = currentPlayers.get(name);
      if (player.connected && (!currentPlayer || !currentPlayer.connected)) {
        this.notify(`${name} ha dejado la partida`);
      }
    }
  }
  private rejoinOnce(attempt = 0): void {
    if (this.rejoinInProgress || !this.connected()) return;
    const session = this.loadSession();
    if (!session.code || !session.playerId || !session.reconnectToken || !session.name) return;
    this.rejoinInProgress = true;
    this.rejoinTimeout = setTimeout(() => {
      this.rejoinInProgress = false;
      if (this.connected()) this.scheduleRejoin(attempt + 1);
    }, 10000);
    this.socket.emit(
      "room:join",
      {
        code: session.code,
        name: session.name,
        playerId: session.playerId,
        reconnectToken: session.reconnectToken,
      },
      (res: Ack) => {
        clearTimeout(this.rejoinTimeout);
        this.rejoinInProgress = false;
        if (!res) {
          if (this.connected()) this.scheduleRejoin(attempt + 1);
          return;
        }
        if (res.error && /otra pestaña/.test(res.error)) {
          this.scheduleRejoin(attempt + 1);
          return;
        }
        if (res.error) {
          this.restoringSession = false;
          this.reconnecting.set(false);
          if (!/otra pestaña/.test(res.error)) {
            this.clearSession();
            this.reset();
          }
        }
      },
    );
  }
  private scheduleRejoin(attempt: number): void {
    clearTimeout(this.rejoinRetry);
    this.rejoinRetry = setTimeout(
      () => this.rejoinOnce(attempt),
      Math.min(3000, 400 + attempt * 300),
    );
  }
  private loadSession(): { name?: string; code?: string; playerId?: string; reconnectToken?: string } {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) ?? "{}") as {
        name?: string;
        code?: string;
        playerId?: string;
        reconnectToken?: string;
      };
    } catch {
      return {};
    }
  }
  private saveSession(session: {
    name: string;
    code?: string;
    playerId?: string;
    reconnectToken?: string;
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
    this.liveVotes.set([]);
    this.wordOptions.set([]);
  }
}
