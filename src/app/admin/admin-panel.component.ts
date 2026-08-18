import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import { Router } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { AdminService } from "./admin.service";
import { ConfirmService } from "../confirm/confirm.service";
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

        @if (activeTab() === "categories") {
          @if (editingCategory() !== null) {
            <div class="card">
              <div class="card-header">
                <impostor-icon name="note" />
                <h3>
                  {{
                    editingCategory() === "__new__"
                      ? "Nueva categoría"
                      : "Editar categoría"
                  }}
                </h3>
              </div>
              <label class="field-label">Nombre</label>
              <input
                type="text"
                [(ngModel)]="editLabel"
                placeholder="Nombre de la categoría"
                [disabled]="admin.loading()"
              />
              <div class="field-label-row">
                <label class="field-label">Palabras</label>
                <div class="edit-mode-toggle">
                  <button
                    type="button"
                    class="mode-btn"
                    [class.active]="editMode() === 'individual'"
                    (click)="setEditMode('individual')"
                  >
                    Una a una
                  </button>
                  <button
                    type="button"
                    class="mode-btn"
                    [class.active]="editMode() === 'json'"
                    (click)="setEditMode('json')"
                  >
                    JSON
                  </button>
                </div>
              </div>
              @if (editMode() === "individual") {
                <div class="word-list" aria-label="Palabras de la categoría">
                  @for (word of editWords; track $index) {
                    <div class="word-card">
                      <div class="word-card-head">
                        <span class="word-index"
                          >Palabra {{ $index + 1 }}</span
                        >
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
                      <input
                        type="text"
                        class="word-input"
                        [ngModel]="word"
                        (ngModelChange)="changeWord($index, $event)"
                        [disabled]="admin.loading()"
                        [attr.aria-label]="'Palabra ' + ($index + 1)"
                      />
                      <input
                        type="text"
                        class="pista-input"
                        [ngModel]="editPistas[$index] || ''"
                        (ngModelChange)="editPistas[$index] = $event"
                        [disabled]="admin.loading()"
                        placeholder="Pista"
                        [attr.aria-label]="'Pista de ' + word"
                      />
                      <input
                        type="text"
                        class="info-input"
                        [ngModel]="editInfos[$index] || ''"
                        (ngModelChange)="editInfos[$index] = $event"
                        [disabled]="admin.loading()"
                        placeholder="Info extra"
                        [attr.aria-label]="'Info extra de ' + word"
                      />
                    </div>
                  }
                </div>
                <div class="add-word">
                  <input
                    type="text"
                    [(ngModel)]="newWord"
                    (ngModelChange)="wordError.set(null)"
                    (keyup.enter)="addWord()"
                    placeholder="Añadir palabra"
                    [disabled]="admin.loading()"
                  />
                  <input
                    type="text"
                    [(ngModel)]="newPista"
                    (keyup.enter)="addWord()"
                    placeholder="Pista"
                    [disabled]="admin.loading()"
                  />
                  <input
                    type="text"
                    [(ngModel)]="newInfo"
                    (keyup.enter)="addWord()"
                    placeholder="Info extra"
                    [disabled]="admin.loading()"
                  />
                  <button
                    type="button"
                    class="btn small"
                    (click)="addWord()"
                    [disabled]="admin.loading() || !newWord.trim()"
                  >
                    Añadir
                  </button>
                </div>
              } @else {
                <textarea
                  class="bulk-words"
                  [ngModel]="bulkText()"
                  (ngModelChange)="applyJson($event)"
                  [disabled]="admin.loading()"
                  rows="12"
                  spellcheck="false"
                  placeholder='[
  { "word": "mango", "pista": "fruta", "info": "" },
  { "word": "perro", "pista": "", "info": "doméstico" }
]'
                  aria-label="Lista de palabras en formato JSON"
                ></textarea>
                <p class="hint bulk-hint">
                  Cada entrada es un objeto con <code>word</code> (obligatoria),
                  <code>pista</code> e <code>info</code> (opcionales, se pueden
                  dejar vacías). También admite un array de textos simples.
                </p>
              }
              @if (wordError()) {
                <p class="error-msg">{{ wordError() }}</p>
              } @else if (hasDuplicateWords(editWords)) {
                <p class="error-msg">No puede haber palabras duplicadas.</p>
              }
              <div class="words-stats">
                <span>{{ editWords.length }} palabras</span>
              </div>
              <div class="card-actions">
                <button
                  class="btn primary"
                  (click)="saveEditingCategory()"
                  [disabled]="admin.loading() || hasDuplicateWords(editWords)"
                >
                  {{ admin.loading() ? "Guardando..." : "Guardar" }}
                </button>
                <button class="btn ghost" (click)="editingCategory.set(null)">
                  Cancelar
                </button>
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
                <p class="hint">
                  Gestiona las categorías del juego o crea una propia.
                </p>
              } @else {
                <p class="hint reorder-hint">
                  Arrastra para reordenar las categorías.
                </p>
                <div class="rooms-list">
                  @for (entry of categoryEntries(); track entry.key; let i = $index) {
                    <div
                      class="room-item"
                      [class.drag-over]="dragIndex() !== null && dragIndex() !== i && dragTarget() === i"
                      (dragover)="onCategoryDragOver($event, i)"
                      (dragleave)="onCategoryDragLeave(i)"
                      (drop)="onCategoryDrop(i)"
                    >
                      <button
                        type="button"
                        class="drag-handle"
                        draggable="true"
                        (dragstart)="onCategoryDragStart(i)"
                        (dragend)="onCategoryDragEnd()"
                        [attr.aria-label]="'Reordenar ' + entry.label"
                        title="Arrastra para reordenar"
                      >
                        <impostor-icon name="grip" />
                      </button>
                      <div class="room-info">
                        <span class="room-code">{{ entry.label }}</span>
                        <span class="room-players"
                          >{{ entry.words.length }} palabras{{
                            entry.custom ? "" : " · integrada"
                          }}</span
                        >
                      </div>
                      <div class="card-actions" style="gap:6px">
                        <button
                          class="btn small"
                          (click)="startEditCategory(entry.key)"
                        >
                          Editar
                        </button>
                        <button
                          class="btn danger small"
                          (click)="removeCategory(entry.key)"
                          [disabled]="admin.loading()"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }
        }

        @if (activeTab() === "rooms") {
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
                      <span class="room-phase">{{
                        getPhaseLabel(room.phase)
                      }}</span>
                      <span class="room-players"
                        >{{ room.connected }}/{{ room.players }}</span
                      >
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
  styles: [
    `
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
        gap: 12px;
        max-height: 360px;
        overflow-y: auto;
        padding: 2px 10px 2px 2px;
        scrollbar-gutter: stable;
      }
      .word-card {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 10px;
        background: #11131b;
        border: 1px solid var(--line);
        border-radius: 10px;
      }
      .word-card-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .word-index {
        font-size: 12px;
        font-weight: 600;
        color: var(--muted);
      }
      .word-input,
      .pista-input,
      .info-input {
        width: 100%;
        box-sizing: border-box;
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
      .room-item.drag-over {
        border-color: var(--violet);
        box-shadow: 0 0 0 1px var(--violet);
      }
      .drag-handle {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        padding: 0;
        border: none;
        background: transparent;
        color: var(--muted);
        cursor: grab;
        border-radius: 8px;
        touch-action: none;
      }
      .drag-handle:hover {
        color: var(--ink);
        background: var(--line);
      }
      .drag-handle:active {
        cursor: grabbing;
      }
      .reorder-hint {
        margin: 0 0 8px;
      }
      .room-info {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        flex: 1;
        min-width: 0;
        text-align: left;
      }
      .room-code {
        font-family: "DM Mono", monospace;
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
      .field-label-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin: 8px 0 4px;
      }
      .field-label-row .field-label {
        margin: 0;
      }
      .edit-mode-toggle {
        display: flex;
        gap: 4px;
        background: var(--panel);
        padding: 3px;
        border-radius: 9px;
        border: 1px solid var(--line);
      }
      .mode-btn {
        padding: 6px 12px;
        border: none;
        background: transparent;
        color: var(--muted);
        font-weight: 600;
        font-size: 12px;
        cursor: pointer;
        border-radius: 6px;
        transition: all 0.2s;
      }
      .mode-btn:hover {
        color: var(--ink);
      }
      .mode-btn.active {
        color: var(--ink);
        background: var(--line);
      }
      .bulk-words {
        width: 100%;
        box-sizing: border-box;
        resize: vertical;
        padding: 10px;
        border-radius: 10px;
        border: 1px solid var(--line);
        background: #11131b;
        color: var(--ink);
        font-size: 14px;
        line-height: 1.5;
        font-family: inherit;
      }
      .bulk-hint {
        margin: 8px 0 0;
        text-align: left;
      }
    `,
  ],
})
export class AdminPanelComponent implements OnInit {
  readonly admin = inject(AdminService);
  readonly confirm = inject(ConfirmService);
  readonly router = inject(Router);
  readonly activeTab = signal<"categories" | "rooms">("categories");
  readonly editingCategory = signal<string | null>(null);
  readonly editMode = signal<"individual" | "json">("individual");
  readonly wordError = signal<string | null>(null);
  readonly bulkText = signal("");
  readonly dragIndex = signal<number | null>(null);
  readonly dragTarget = signal<number | null>(null);

  editLabel = "";
  editWords: string[] = [];
  editPistas: string[] = [];
  editInfos: string[] = [];
  newWord = "";
  newPista = "";
  newInfo = "";
  private editKey = "";

  async ngOnInit(): Promise<void> {
    if (!this.admin.isAuthenticated()) {
      this.router.navigate(["/admin/login"]);
      return;
    }
    await this.admin.loadCategories();
    this.editPistas = [];
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
    if (await this.confirm.ask(`¿Cerrar la sala ${code}?`)) {
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

  categoryEntries(): Array<{
    key: string;
    label: string;
    words: string[];
    custom: boolean;
  }> {
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
    this.editPistas = [];
    this.editInfos = [];
    this.newWord = "";
    this.newPista = "";
    this.newInfo = "";
    this.wordError.set(null);
    this.editMode.set("individual");
    this.bulkText.set("");
    this.editingCategory.set("__new__");
  }

  startEditCategory(key: string): void {
    const cat = this.admin.categories()[key];
    if (!cat) return;
    this.editKey = key;
    this.editLabel = cat.label;
    this.editWords = [...cat.words];
    this.editPistas = [...(cat.pistas || [])];
    this.editInfos = [...(cat.infos || [])];
    this.newWord = "";
    this.newPista = "";
    this.newInfo = "";
    this.wordError.set(null);
    this.editMode.set("individual");
    this.bulkText.set("");
    this.editingCategory.set(key);
  }

  setEditMode(mode: "individual" | "json"): void {
    if (mode === this.editMode()) return;
    if (mode === "json") {
      this.bulkText.set(this.toJson());
    }
    this.editMode.set(mode);
  }

  private toJson(): string {
    const items = this.editWords.map((word, index) => {
      const entry: { word: string; pista?: string; info?: string } = {
        word: word.trim(),
      };
      const pista = (this.editPistas[index] ?? "").trim();
      const info = (this.editInfos[index] ?? "").trim();
      if (pista) entry.pista = pista;
      if (info) entry.info = info;
      return entry;
    });
    return JSON.stringify(items, null, 2);
  }

  applyJson(text: string): void {
    this.bulkText.set(text);
    this.wordError.set(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      this.wordError.set("JSON inválido");
      return;
    }
    if (!Array.isArray(parsed)) {
      this.wordError.set("El JSON debe ser un array de palabras");
      return;
    }
    const words: string[] = [];
    const pistas: string[] = [];
    const infos: string[] = [];
    for (const item of parsed) {
      if (typeof item === "string") {
        words.push(item);
        pistas.push("");
        infos.push("");
      } else if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        words.push(typeof obj["word"] === "string" ? obj["word"] : "");
        pistas.push(typeof obj["pista"] === "string" ? obj["pista"] : "");
        infos.push(typeof obj["info"] === "string" ? obj["info"] : "");
      }
    }
    this.editWords = words;
    this.editPistas = pistas;
    this.editInfos = infos;
  }

  addWord(): void {
    const word = this.newWord.trim();
    if (!word || word.length < 2 || word.length > 40) return;
    if (this.hasDuplicate(word)) {
      this.wordError.set("La palabra ya existe en la lista");
      return;
    }
    this.wordError.set(null);
    this.editWords = [...this.editWords, word];
    this.editPistas = [...this.editPistas, this.newPista.trim()];
    this.editInfos = [...this.editInfos, this.newInfo.trim()];
    this.newWord = "";
    this.newPista = "";
    this.newInfo = "";
  }

  changeWord(index: number, value: string): void {
    this.editWords = this.editWords.map((word, i) =>
      i === index ? value : word,
    );
    this.wordError.set(null);
  }

  removeWord(index: number): void {
    this.editWords = this.editWords.filter((_, i) => i !== index);
    this.editPistas = this.editPistas.filter((_, i) => i !== index);
    this.editInfos = this.editInfos.filter((_, i) => i !== index);
    this.wordError.set(null);
  }

  private hasDuplicate(word: string, exceptIndex = -1): boolean {
    const normalized = word.trim().toLocaleLowerCase();
    return this.editWords.some(
      (current, index) =>
        index !== exceptIndex &&
        current.trim().toLocaleLowerCase() === normalized,
    );
  }

  hasDuplicateWords(words: string[]): boolean {
    const normalized = words.map((word) => word.trim().toLocaleLowerCase());
    return new Set(normalized).size !== normalized.length;
  }

  async saveEditingCategory(): Promise<void> {
    const kept = this.editWords
      .map((word, index) => ({
        word: word.trim(),
        pista: (this.editPistas[index] ?? "").trim(),
        info: (this.editInfos[index] ?? "").trim(),
      }))
      .filter((entry) => entry.word.length >= 2 && entry.word.length <= 40);
    const words = kept.map((entry) => entry.word);
    const pistas = kept.map((entry) => entry.pista);
    const infos = kept.map((entry) => entry.info);
    if (
      !this.editLabel.trim() ||
      !words.length ||
      this.hasDuplicateWords(words) ||
      !!this.wordError()
    )
      return;
    if (this.editingCategory() === "__new__") {
      const key = this.editLabel
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "")
        .slice(0, 30);
      if (!key) return;
      const ok = await this.admin.createCategory(
        key,
        this.editLabel.trim(),
        words,
        pistas,
        infos,
      );
      if (ok) this.editingCategory.set(null);
    } else {
      const ok = await this.admin.updateCategory(this.editKey, {
        label: this.editLabel.trim(),
        words,
        pistas,
        infos,
      });
      if (ok) this.editingCategory.set(null);
    }
  }

  async removeCategory(key: string): Promise<void> {
    const cat = this.admin.categories()[key];
    if (!cat) return;
    if (await this.confirm.ask(`¿Eliminar la categoría "${cat.label}"?`)) {
      await this.admin.deleteCategory(key);
    }
  }

  onCategoryDragStart(index: number): void {
    this.dragIndex.set(index);
  }

  onCategoryDragEnd(): void {
    this.dragIndex.set(null);
    this.dragTarget.set(null);
  }

  onCategoryDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    this.dragTarget.set(index);
  }

  onCategoryDragLeave(index: number): void {
    if (this.dragTarget() === index) this.dragTarget.set(null);
  }

  async onCategoryDrop(targetIndex: number): Promise<void> {
    const from = this.dragIndex();
    this.dragIndex.set(null);
    this.dragTarget.set(null);
    if (from === null || from === targetIndex) return;
    const entries = this.categoryEntries();
    if (
      from < 0 ||
      from >= entries.length ||
      targetIndex < 0 ||
      targetIndex >= entries.length
    )
      return;
    const reordered = [...entries];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(targetIndex, 0, moved);
    const ok = await this.admin.reorderCategories(
      reordered.map((entry) => entry.key),
    );
    if (!ok) await this.admin.loadCategories();
  }

  logout(): void {
    this.admin.logout();
    this.router.navigate(["/"]);
  }
}
