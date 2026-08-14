import { Injectable, signal } from "@angular/core";
import { io, Socket } from "socket.io-client";
import { Ack, Phase, RevealData, RolePayload, Room } from "./game.models";

const SESSION_KEY = "impostor_session";

@Injectable({ providedIn: "root" })
export class GameService {
  readonly phase = signal<Phase>("home");
  readonly room = signal<Room | null>(null);
  readonly me = signal<string | null>(null);
  readonly role = signal<RolePayload | null>(null);
  readonly reveal = signal<RevealData | null>(null);
  readonly wordOptions = signal<string[]>([]);
  readonly starter = signal<{ name: string; id: string } | null>(null);
  readonly connected = signal(false);
  readonly reconnecting = signal(false);
  readonly toast = signal("");

  private readonly socket: Socket;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  private rejoinInProgress = false;
  private rejoinTimeout: ReturnType<typeof setTimeout> | undefined;
  private rejoinRetry: ReturnType<typeof setTimeout> | undefined;
  private rejoinRequestId = 0;
  private everConnected = false;
  private restoringSession = false;
  private intentionalDisconnect = false;
  private lastWakeRecovery = 0;

  constructor() {
    const session = this.loadSession();
    this.restoringSession = Boolean(session.code && session.playerId && session.reconnectToken && session.name);
    this.reconnecting.set(this.restoringSession);
    this.socket = io();
    this.socket.on("connect", () => {
      this.connected.set(true);
      this.cancelRejoin();
      this.reconnecting.set(Boolean(this.loadSession().code));
      this.everConnected = true;
      this.rejoinOnce();
    });
    this.socket.on("disconnect", () => {
      this.cancelRejoin();
      if (this.everConnected) this.reconnecting.set(true);
      this.connected.set(false);
      if (this.intentionalDisconnect) {
        this.intentionalDisconnect = false;
        this.reconnecting.set(false);
      }
    });
    this.socket.on("connect_error", () => {
      if (this.everConnected) this.reconnecting.set(true);
      this.connected.set(false);
    });
    this.socket.on(
      "room:joined",
      ({ room, me, reconnectToken }: { room: Room; me: string; reconnectToken: string }) => {
        this.cancelRejoin();
        this.restoringSession = false;
        this.reconnecting.set(false);
        this.room.set(room);
        this.me.set(me);
        this.reveal.set(null);
        this.wordOptions.set([]);
        this.starter.set(null);
        const waiting = room.players.some((player) => player.id === me && player.waiting);
        this.phase.set(waiting ? "waiting" : this.phaseFor(room.phase));
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
        starter,
        starterId,
      }: {
        phase: string;
        starter?: string;
        starterId?: string;
      }) => {
         if (phase === "round") {
           this.reveal.set(null);
           this.starter.set(starter && starterId ? { name: starter, id: starterId } : null);
        }
        this.phase.set(this.phaseFor(phase));
        if (phase === "lobby") {
          this.role.set(null);
          this.reveal.set(null);
          this.wordOptions.set([]);
          this.starter.set(null);
        }
      },
    );
    this.socket.on("round:started", (role: RolePayload) => {
      this.role.set(role);
      if (role.starter && role.starterId) {
        this.starter.set({ name: role.starter, id: role.starterId });
      }
      this.phase.set("round");
    });
    this.socket.on("word:options", (words: string[]) => this.wordOptions.set(words));
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
      this.cancelRejoin();
      this.clearSession();
      this.reset();
      this.reconnecting.set(false);
      this.intentionalDisconnect = true;
      this.socket.disconnect();
      this.notify("Esta sesión fue reemplazada desde otra pestaña");
    });
    this.socket.on("game:ended", () => {
      this.cancelRejoin();
      this.clearSession();
      this.reset();
      this.notify("La partida ha terminado");
    });
    window.addEventListener("online", this.recoverConnection);
    window.addEventListener("pageshow", this.recoverConnection);
    document.addEventListener("visibilitychange", this.recoverOnVisibility);
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
  markImpostor(): void {
    this.socket.emit("impostor:mark", (res: Ack) => {
      if (res?.error) this.notify(res.error);
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
  shareLink(): void {
    const url = `${location.origin}/?c=${this.room()?.code ?? ""}`;
    const fallback = () =>
      navigator.clipboard
        ?.writeText(url)
        .then(() => this.notify("Enlace copiado"))
        .catch(() => window.prompt("Copia el enlace:", url));
    if (typeof navigator.share === "function") {
      navigator.share({ title: "El Impostor", text: "Únete a mi partida", url }).catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        fallback();
      });
    } else {
      fallback();
    }
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
    return ["lobby", "round", "gameover"].includes(value)
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
    const requestId = ++this.rejoinRequestId;
    this.rejoinTimeout = setTimeout(() => {
      if (requestId !== this.rejoinRequestId) return;
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
        if (requestId !== this.rejoinRequestId) return;
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
          this.cancelRejoin();
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
  private cancelRejoin(): void {
    clearTimeout(this.rejoinTimeout);
    clearTimeout(this.rejoinRetry);
    this.rejoinTimeout = undefined;
    this.rejoinRetry = undefined;
    this.rejoinInProgress = false;
    this.rejoinRequestId += 1;
  }
  private recoverConnection = (): void => {
    const session = this.loadSession();
    if (!session.code || !session.playerId || !session.reconnectToken || !session.name) return;
    const now = Date.now();
    if (now - this.lastWakeRecovery < 3000) return;
    this.lastWakeRecovery = now;
    if (this.socket.connected) {
      this.rejoinOnce();
    } else {
      this.socket.connect();
    }
  };
  private recoverOnVisibility = (): void => {
    if (document.visibilityState === "visible") this.recoverConnection();
  };
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
    if (location.search) history.replaceState(null, "", "/");
    this.room.set(null);
    this.me.set(null);
    this.role.set(null);
    this.reveal.set(null);
    this.wordOptions.set([]);
    this.starter.set(null);
  }
}
