import { Injectable, signal, computed } from "@angular/core";

interface AdminConfig {
  globalCustomWords: string;
  words: string[];
}

interface RoomInfo {
  code: string;
  phase: string;
  players: number;
  connected: number;
  category: string;
  impostors: number;
  customWordsCount: number;
  createdAt: number;
}

@Injectable({ providedIn: "root" })
export class AdminService {
  private readonly TOKEN_KEY = "admin_token";
  private readonly API_BASE = "/api/admin";

  readonly token = signal<string | null>(localStorage.getItem(this.TOKEN_KEY));
  readonly isAuthenticated = computed(() => !!this.token());
  readonly config = signal<AdminConfig | null>(null);
  readonly rooms = signal<RoomInfo[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async login(username: string, password: string): Promise<boolean> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await fetch(`${this.API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        this.token.set(data.token);
        localStorage.setItem(this.TOKEN_KEY, data.token);
        await this.loadConfig();
        return true;
      }
      this.error.set(data.error || "Error de autenticación");
      return false;
    } catch {
      this.error.set("Error de conexión");
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  logout(): void {
    this.token.set(null);
    localStorage.removeItem(this.TOKEN_KEY);
    this.config.set(null);
    this.rooms.set([]);
  }

  async loadConfig(): Promise<void> {
    if (!this.token()) return;
    this.loading.set(true);
    try {
      const res = await fetch(`${this.API_BASE}/config`, {
        headers: { Authorization: `Bearer ${this.token()}` },
      });
      if (res.status === 401) {
        this.logout();
        return;
      }
      const data = await res.json();
      this.config.set(data);
    } catch {
      this.error.set("Error al cargar configuración");
    } finally {
      this.loading.set(false);
    }
  }

  async saveConfig(globalCustomWords: string): Promise<boolean> {
    if (!this.token()) return false;
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await fetch(`${this.API_BASE}/config`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token()}`,
        },
        body: JSON.stringify({ globalCustomWords }),
      });
      if (res.status === 401) {
        this.logout();
        return false;
      }
      const data = await res.json();
      if (res.ok) {
        this.config.set({ globalCustomWords, words: data.words });
        return true;
      }
      this.error.set(data.error || "Error al guardar");
      return false;
    } catch {
      this.error.set("Error de conexión");
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  async loadRooms(): Promise<void> {
    if (!this.token()) return;
    try {
      const res = await fetch(`${this.API_BASE}/rooms`, {
        headers: { Authorization: `Bearer ${this.token()}` },
      });
      if (res.status === 401) {
        this.logout();
        return;
      }
      const data = await res.json();
      this.rooms.set(data.rooms);
    } catch {
      this.error.set("Error al cargar salas");
    }
  }

  async deleteRoom(code: string): Promise<boolean> {
    if (!this.token()) return false;
    try {
      const res = await fetch(`${this.API_BASE}/rooms/${code}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${this.token()}` },
      });
      if (res.status === 401) {
        this.logout();
        return false;
      }
      if (res.ok) {
        await this.loadRooms();
        return true;
      }
      return false;
    } catch {
      this.error.set("Error al eliminar sala");
      return false;
    }
  }
}
