import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from "@angular/core";
import { Router } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { AdminService } from "./admin.service";
import { IconComponent } from "../icon/icon.component";

@Component({
  selector: "impostor-admin-panel",
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="view active admin-panel-view">
      @if (!admin.isAuthenticated()) {
        <p class="hint">Redirigiendo al login...</p>
      } @else {
        <header class="admin-header">
          <h2>
            <impostor-icon name="detective" />
            Panel Admin
          </h2>
          <button class="btn ghost small" (click)="logout()">
            Cerrar sesión
          </button>
        </header>

        <div class="admin-tabs">
          <button
            class="tab"
            [class.active]="activeTab() === 'words'"
            (click)="activeTab.set('words')"
          >
            Palabras globales
          </button>
          <button
            class="tab"
            [class.active]="activeTab() === 'rooms'"
            (click)="switchToRooms()"
          >
            Salas activas
          </button>
        </div>

        @if (activeTab() === 'words') {
          <div class="card words-card">
            <div class="card-header">
              <impostor-icon name="books" />
              <h3>Palabras personalizadas globales</h3>
            </div>
            <p class="hint">
              Estas palabras se mezclan en todas las partidas. Separa con comas, punto y coma o saltos de línea.
            </p>
            <textarea
              [(ngModel)]="wordsText"
              placeholder="Escribe las palabras aquí..."
              rows="10"
              [disabled]="admin.loading()"
            ></textarea>
            <div class="words-stats">
              <span>{{ currentWords().length }} palabras</span>
              @if (wordsText !== (admin.config()?.globalCustomWords ?? '')) {
                <span class="unsaved">Sin guardar</span>
              }
            </div>
            <div class="card-actions">
              <button
                class="btn primary"
                (click)="saveWords()"
                [disabled]="admin.loading() || wordsText === (admin.config()?.globalCustomWords ?? '')"
              >
                {{ admin.loading() ? "Guardando..." : "Guardar" }}
              </button>
              <button
                class="btn ghost"
                (click)="resetWords()"
                [disabled]="admin.loading() || wordsText === (admin.config()?.globalCustomWords ?? '')"
              >
                Descartar
              </button>
            </div>
            @if (admin.error()) {
              <p class="error-msg">{{ admin.error() }}</p>
            }
          </div>

          <div class="card preview-card">
            <div class="card-header">
              <impostor-icon name="note" />
              <h3>Vista previa</h3>
            </div>
            <div class="word-list">
              @for (word of currentWords(); track word) {
                <span class="word-tag">{{ word }}</span>
              } @empty {
                <p class="hint">No hay palabras definidas</p>
              }
            </div>
          </div>
        }

        @if (activeTab() === 'rooms') {
          <div class="card rooms-card">
            <div class="card-header">
              <impostor-icon name="game" />
              <h3>Salas activas</h3>
              <button class="btn small" (click)="loadRooms()">
                Actualizar
              </button>
            </div>
            @if (admin.rooms().length === 0) {
              <p class="hint">No hay salas activas</p>
            } @else {
              <div class="rooms-list">
                @for (room of admin.rooms(); track room.code) {
                  <div class="room-item">
                    <div class="room-info">
                      <span class="room-code">{{ room.code }}</span>
                      <span class="room-phase">{{ getPhaseLabel(room.phase) }}</span>
                      <span class="room-players">{{ room.connected }}/{{ room.players }}</span>
                    </div>
                    <button
                      class="btn danger small"
                      (click)="deleteRoom(room.code)"
                      [disabled]="admin.loading()"
                    >
                      Cerrar
                    </button>
                  </div>
                }
              </div>
            }
          </div>
        }
      }
    </section>
  `,
  styles: [`
    .admin-panel-view {
      width: min(100% - 28px, 520px);
      margin: auto;
      padding: 18px 0 calc(28px + env(safe-area-inset-bottom));
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-height: 100dvh;
    }
    .admin-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .admin-header h2 {
      margin: 0;
      font-size: 24px;
    }
    .admin-tabs {
      display: flex;
      gap: 4px;
      background: var(--panel);
      padding: 4px;
      border-radius: 12px;
      border: 1px solid var(--line);
    }
    .tab {
      flex: 1;
      padding: 10px 16px;
      border: none;
      background: transparent;
      color: var(--muted);
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      border-radius: 8px;
      transition: all 0.2s;
    }
    .tab:hover {
      color: var(--ink);
    }
    .tab.active {
      color: var(--ink);
      background: var(--line);
    }
    .card-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 4px;
    }
    .card-header h3 {
      margin: 0;
      flex: 1;
      font-size: 16px;
    }
    .card-actions {
      display: flex;
      gap: 10px;
    }
    .words-stats {
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: var(--muted);
      font-size: 12px;
    }
    .unsaved {
      color: var(--yellow);
      font-weight: 600;
    }
    .word-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      max-height: 200px;
      overflow-y: auto;
    }
    .word-tag {
      padding: 5px 10px;
      background: #11131b;
      border: 1px solid var(--line);
      border-radius: 8px;
      font-size: 12px;
      color: var(--muted);
    }
    .rooms-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .room-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      background: #11131b;
      border: 1px solid var(--line);
      border-radius: 10px;
      gap: 10px;
    }
    .room-info {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .room-code {
      font-family: 'DM Mono', monospace;
      font-weight: 700;
      color: var(--violet);
      font-size: 15px;
    }
    .room-phase {
      padding: 3px 7px;
      background: var(--violet);
      color: white;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .room-players {
      color: var(--muted);
      font-size: 12px;
    }
    .btn.danger {
      background: linear-gradient(135deg, var(--pink), #cf3d6c);
      border: none;
    }
    .error-msg {
      color: var(--pink);
      font-size: 13px;
      text-align: center;
      margin: 8px 0 0;
      padding: 8px;
      background: #2a1526;
      border: 1px solid #ff6b9680;
      border-radius: 8px;
    }
    textarea {
      resize: vertical;
      min-height: 150px;
    }
  `],
})
export class AdminPanelComponent implements OnInit {
  readonly admin = inject(AdminService);
  readonly router = inject(Router);
  readonly activeTab = signal<"words" | "rooms">("words");

  wordsText = "";

  async ngOnInit(): Promise<void> {
    if (!this.admin.isAuthenticated()) {
      this.router.navigate(["/admin/login"]);
      return;
    }
    await this.admin.loadConfig();
    this.wordsText = this.admin.config()?.globalCustomWords ?? "";
  }

  currentWords(): string[] {
    return this.wordsText
      .split(/[\n,;]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 2 && w.length <= 40)
      .filter((w, i, arr) => arr.indexOf(w) === i);
  }

  async saveWords(): Promise<void> {
    const success = await this.admin.saveConfig(this.wordsText);
    if (success) {
      this.wordsText = this.admin.config()?.globalCustomWords ?? "";
    }
  }

  resetWords(): void {
    this.wordsText = this.admin.config()?.globalCustomWords ?? "";
  }

  async switchToRooms(): Promise<void> {
    this.activeTab.set("rooms");
    await this.loadRooms();
  }

  async loadRooms(): Promise<void> {
    await this.admin.loadRooms();
  }

  async deleteRoom(code: string): Promise<void> {
    if (confirm(`¿Cerrar la sala ${code}?`)) {
      await this.admin.deleteRoom(code);
    }
  }

  getPhaseLabel(phase: string): string {
    const labels: Record<string, string> = {
      lobby: "Lobby",
      round: "Jugando",
      voting: "Votando",
      reveal: "Revelado",
    };
    return labels[phase] || phase;
  }

  logout(): void {
    this.admin.logout();
    this.router.navigate(["/"]);
  }
}
