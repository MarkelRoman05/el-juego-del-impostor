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
            [class.active]="activeTab() === 'categories'"
            (click)="switchToCategories()"
          >
            Categorías
          </button>
          <button
            class="tab"
            [class.active]="activeTab() === 'rooms'"
            (click)="switchToRooms()"
          >
            Salas activas
          </button>
        </div>

        @if (activeTab() === 'categories') {
          @if (editingCategory() !== null) {
            <div class="card">
              <div class="card-header">
                <impostor-icon name="note" />
                 <h3>{{ editingCategory() === '__new__' ? 'Nueva categoría' : 'Editar categoría' }}</h3>
              </div>
              <label class="field-label">Nombre</label>
              <input
                type="text"
                [(ngModel)]="editLabel"
                placeholder="Nombre de la categoría"
                 [disabled]="admin.loading()"
               />
               <label class="field-label">Palabras</label>
               <div class="word-list" aria-label="Palabras de la categoría">
                 @for (word of editWords; track $index) {
                   <div class="word-row">
                     <input
                       type="text"
                       [ngModel]="word"
                       (ngModelChange)="changeWord($index, $event)"
                       [disabled]="admin.loading()"
                       [attr.aria-label]="'Palabra ' + ($index + 1)"
                     />
                     <button
                       type="button"
                       class="btn danger small word-delete"
                       (click)="removeWord($index)"
                       [disabled]="admin.loading()"
                       [attr.aria-label]="'Borrar ' + word"
                     >
                       Borrar
                     </button>
                   </div>
                 }
               </div>
               <div class="add-word">
                 <input
                   type="text"
                   [(ngModel)]="newWord"
                   (keyup.enter)="addWord()"
                   placeholder="Añadir palabra"
                   [disabled]="admin.loading()"
                 />
                 <button type="button" class="btn small" (click)="addWord()" [disabled]="admin.loading() || !newWord.trim()">
                   Añadir
                 </button>
               </div>
               <div class="words-stats">
                 <span>{{ editWords.length }} palabras</span>
               </div>
               @if (hasDuplicateWords(editWords)) {
                 <p class="error-msg">No puede haber palabras duplicadas.</p>
               }
               <div class="card-actions">
                 <button class="btn primary" (click)="saveEditingCategory()" [disabled]="admin.loading() || hasDuplicateWords(editWords)">
                  {{ admin.loading() ? "Guardando..." : "Guardar" }}
                </button>
                <button class="btn ghost" (click)="editingCategory.set(null)">Cancelar</button>
              </div>
              @if (admin.error()) {
                <p class="error-msg">{{ admin.error() }}</p>
              }
            </div>
          } @else {
            <div class="card">
              <div class="card-header">
                <impostor-icon name="books" />
                 <h3>Todas las categorías</h3>
                <button class="btn small" (click)="startNewCategory()">
                  + Nueva
                </button>
              </div>
              @if (categoryEntries().length === 0) {
                 <p class="hint">Gestiona las categorías del juego o crea una propia.</p>
              } @else {
                <div class="rooms-list">
                  @for (entry of categoryEntries(); track entry.key) {
                    <div class="room-item">
                      <div class="room-info">
                        <span class="room-code">{{ entry.label }}</span>
                         <span class="room-players">{{ entry.words.length }} palabras{{ entry.custom ? '' : ' · integrada' }}</span>
                      </div>
                      <div class="card-actions" style="gap:6px">
                        <button class="btn small" (click)="startEditCategory(entry.key)">Editar</button>
                         <button class="btn danger small" (click)="removeCategory(entry.key)" [disabled]="admin.loading()">Eliminar</button>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }
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
       flex-direction: column;
       gap: 8px;
       max-height: 360px;
       overflow-y: auto;
       padding: 2px 10px 2px 2px;
       scrollbar-gutter: stable;
     }
     .word-row {
       display: flex;
       gap: 8px;
       align-items: center;
     }
     .word-row input {
       min-width: 0;
       flex: 1;
     }
     .word-delete {
       flex: 0 0 auto;
     }
     .add-word {
       display: flex;
       gap: 8px;
       margin-top: 8px;
     }
     .add-word input {
       min-width: 0;
       flex: 1;
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
    .field-label {
      display: block;
      font-size: 12px;
      color: var(--muted);
      margin: 8px 0 4px;
      font-weight: 600;
    }
  `],
})
export class AdminPanelComponent implements OnInit {
  readonly admin = inject(AdminService);
  readonly router = inject(Router);
  readonly activeTab = signal<"categories" | "rooms">("categories");
  readonly editingCategory = signal<string | null>(null);

   editLabel = "";
   editWords: string[] = [];
   newWord = "";
   private editKey = "";

  async ngOnInit(): Promise<void> {
    if (!this.admin.isAuthenticated()) {
      this.router.navigate(["/admin/login"]);
      return;
    }
    await this.admin.loadCategories();
  }

  async switchToRooms(): Promise<void> {
    this.activeTab.set("rooms");
    await this.loadRooms();
  }

  async switchToCategories(): Promise<void> {
    this.activeTab.set("categories");
    this.editingCategory.set(null);
    await this.admin.loadCategories();
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
      gameover: "Partida terminada",
    };
    return labels[phase] || phase;
  }

  categoryEntries(): Array<{ key: string; label: string; words: string[]; custom: boolean }> {
    return Object.entries(this.admin.categories()).map(([key, cat]) => ({
      key,
      label: cat.label,
      words: cat.words,
      custom: cat.custom,
    }));
  }

   startNewCategory(): void {
     this.editKey = "";
     this.editLabel = "";
     this.editWords = [];
     this.newWord = "";
     this.editingCategory.set("__new__");
  }

  startEditCategory(key: string): void {
    const cat = this.admin.categories()[key];
    if (!cat) return;
     this.editKey = key;
     this.editLabel = cat.label;
     this.editWords = [...cat.words];
     this.newWord = "";
     this.editingCategory.set(key);
   }

   addWord(): void {
     const word = this.newWord.trim();
     if (!word || word.length < 2 || word.length > 40 || this.hasDuplicate(word)) return;
     this.editWords = [...this.editWords, word];
     this.newWord = "";
   }

   changeWord(index: number, value: string): void {
     this.editWords = this.editWords.map((word, i) => i === index ? value : word);
   }

   removeWord(index: number): void {
     this.editWords = this.editWords.filter((_, i) => i !== index);
   }

   private hasDuplicate(word: string, exceptIndex = -1): boolean {
     const normalized = word.trim().toLocaleLowerCase();
     return this.editWords.some((current, index) => index !== exceptIndex && current.trim().toLocaleLowerCase() === normalized);
   }

   hasDuplicateWords(words: string[]): boolean {
     const normalized = words.map((word) => word.trim().toLocaleLowerCase());
     return new Set(normalized).size !== normalized.length;
   }

   async saveEditingCategory(): Promise<void> {
     const words = this.editWords.map((word) => word.trim()).filter((word) => word.length >= 2 && word.length <= 40);
     if (!this.editLabel.trim() || !words.length || this.hasDuplicateWords(words)) return;
     if (this.editingCategory() === "__new__") {
      const key = this.editLabel.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30);
      if (!key) return;
      const ok = await this.admin.createCategory(key, this.editLabel.trim(), words);
      if (ok) this.editingCategory.set(null);
    } else {
      const ok = await this.admin.updateCategory(this.editKey, {
        label: this.editLabel.trim(),
        words,
      });
      if (ok) this.editingCategory.set(null);
    }
  }

  async removeCategory(key: string): Promise<void> {
    const cat = this.admin.categories()[key];
    if (!cat) return;
    if (confirm(`¿Eliminar la categoría "${cat.label}"?`)) {
      await this.admin.deleteCategory(key);
    }
  }

  logout(): void {
    this.admin.logout();
    this.router.navigate(["/"]);
  }
}
