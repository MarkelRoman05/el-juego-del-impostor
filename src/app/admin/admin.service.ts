import { Injectable, signal, computed } from "@angular/core";

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

export interface AdminCategory {
  label: string;
  words: string[];
  pistas?: string[];
  custom: boolean;
}

@Injectable({ providedIn: "root" })
export class AdminService {
  private readonly TOKEN_KEY = "admin_token";
  private readonly API_BASE = "/api/admin";

  readonly token = signal<string | null>(localStorage.getItem(this.TOKEN_KEY));
  readonly isAuthenticated = computed(() => !!this.token());
  readonly rooms = signal<RoomInfo[]>([]);
  readonly categories = signal<Record<string, AdminCategory>>({});
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
        await this.loadCategories();
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
    this.rooms.set([]);
    this.categories.set({});
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
      if (!res.ok) throw new Error("rooms");
      const data = await res.json();
      this.rooms.set(Array.isArray(data.rooms) ? data.rooms : []);
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

  async loadCategories(): Promise<void> {
    if (!this.token()) return;
    try {
      const res = await fetch(`${this.API_BASE}/categories`, {
        headers: { Authorization: `Bearer ${this.token()}` },
      });
      if (res.status === 401) {
        this.logout();
        return;
      }
      const data = await res.json();
      this.categories.set(data.categories || {});
    } catch {
      this.error.set("Error al cargar categorías");
    }
  }

  async createCategory(key: string, label: string, words: string[], pistas?: string[]): Promise<boolean> {
    if (!this.token()) return false;
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await fetch(`${this.API_BASE}/categories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token()}`,
        },
        body: JSON.stringify({ key, label, words, pistas }),
      });
      if (res.status === 401) {
        this.logout();
        return false;
      }
      const data = await res.json();
      if (res.ok) {
        this.categories.set(data.categories || {});
        return true;
      }
      this.error.set(data.error || "Error al crear categoría");
      return false;
    } catch {
      this.error.set("Error de conexión");
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  async updateCategory(key: string, updates: { label?: string; words?: string[]; pistas?: string[] }): Promise<boolean> {
    if (!this.token()) return false;
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await fetch(`${this.API_BASE}/categories/${key}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token()}`,
        },
        body: JSON.stringify(updates),
      });
      if (res.status === 401) {
        this.logout();
        return false;
      }
      const data = await res.json();
      if (res.ok) {
        this.categories.set(data.categories || {});
        return true;
      }
      this.error.set(data.error || "Error al actualizar categoría");
      return false;
    } catch {
      this.error.set("Error de conexión");
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  async deleteCategory(key: string): Promise<boolean> {
    if (!this.token()) return false;
    this.loading.set(true);
    this.error.set(null);
    try {
      const res = await fetch(`${this.API_BASE}/categories/${key}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${this.token()}` },
      });
      if (res.status === 401) {
        this.logout();
        return false;
      }
      const data = await res.json();
      if (res.ok) {
        this.categories.set(data.categories || {});
        return true;
      }
      this.error.set(data.error || "Error al eliminar categoría");
      return false;
    } catch {
      this.error.set("Error de conexión");
      return false;
    } finally {
      this.loading.set(false);
    }
  }
}
