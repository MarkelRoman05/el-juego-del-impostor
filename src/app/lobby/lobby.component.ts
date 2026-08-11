import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RoomConfig, Player } from "../game.models";
import { GameService } from "../game.service";
import { IconComponent } from "../icon/icon.component";

@Component({
  selector: "impostor-lobby",
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: "./lobby.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LobbyComponent implements OnInit {
  readonly game = inject(GameService);
  readonly categories = signal<Array<[string, string]>>([]);
  readonly selectedWord = signal("");
  readonly manualWord = signal("");
  readonly exactWord = computed(() => this.selectedWord() || this.manualWord());

  async ngOnInit(): Promise<void> {
    try {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const entries = Object.entries(data.categories || {}) as Array<[string, { label: string }]>;
      this.categories.set(entries.map(([key, cat]) => [key, cat.label]));
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  }

  isHost(): boolean {
    return this.game.me() === this.game.room()?.hostId;
  }
  connectedPlayers(): number {
    return (
      this.game.room()?.players.filter((player) => player.connected && (player.id !== this.game.room()?.hostId || this.game.room()?.config.hostPlays !== false)).length ?? 0
    );
  }
  maxImpostors(): number {
    return Math.max(1, Math.min(3, this.connectedPlayers() - 1));
  }
  hasSelectedCategory(): boolean {
    return this.selectedCategories().length > 0;
  }
  canStart(): boolean {
    return this.hasSelectedCategory() || this.exactWord().trim().length > 0;
  }
  setConfig(key: keyof RoomConfig, value: string | number | boolean): void {
    this.game.configure({ [key]: value });
    if (key === "hostPlays" && value === true) {
      this.selectedWord.set("");
      this.manualWord.set("");
      this.game.configure({ customWords: "", hostWordFromCatalog: false });
    }
  }
  setSelectedWord(word: string): void {
    this.selectedWord.set(word);
    this.manualWord.set("");
    this.game.configure({ customWords: word, hostWordFromCatalog: Boolean(word) });
  }
  setManualWord(value: string): void {
    const word = value.slice(0, 40);
    this.selectedWord.set("");
    this.manualWord.set(word);
    this.game.configure({ customWords: word, hostWordFromCatalog: false });
  }
  selectedCategories(): string[] {
    const value = this.game.room()?.config.category ?? "";
    if (value === "mezcla") {
      return this.categories().map(([key]) => key);
    }
    const keys = value.split(",").filter(k => k.length > 0);
    return keys;
  }
  isCategorySelected(key: string): boolean {
    return this.selectedCategories().includes(key);
  }
  setCategory(key: string, checked: boolean): void {
    const selected = new Set(this.selectedCategories());
    if (checked) selected.add(key);
    else selected.delete(key);
    this.setConfig("category", [...selected].join(","));
  }
  isAllCategoriesSelected(): boolean {
    const value = this.game.room()?.config.category ?? "";
    if (value === "mezcla") return true;
    const selected = this.selectedCategories();
    return selected.length === this.categories().length;
  }
  setAllCategories(checked: boolean): void {
    if (checked) {
      this.setConfig("category", "mezcla");
    } else {
      this.setConfig("category", "");
    }
  }
  trackPlayer(_: number, player: Player): string {
    return player.id;
  }
}
