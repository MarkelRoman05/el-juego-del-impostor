import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RoomConfig, Player } from "../game.models";
import { GameService } from "../game.service";
import { IconComponent } from "../icon/icon.component";

const CATEGORIES: Record<string, string> = {
  animales: "Animales",
  comida: "Comida",
  lugares: "Lugares",
  cine: "Cine y TV",
  futbol: "Fútbol",
  profesiones: "Profesiones",
  objetos: "Objetos",
  naturaleza: "Naturaleza",
  tecnologia: "Tecnología",
  musica: "Música",
  mezcla: "Mezcla",
};

@Component({
  selector: "impostor-lobby",
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: "./lobby.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LobbyComponent {
  readonly game = inject(GameService);
  readonly categories = Object.entries(CATEGORIES).filter(([key]) => key !== "mezcla");
  isHost(): boolean {
    return this.game.me() === this.game.room()?.hostId;
  }
  connectedPlayers(): number {
    return (
      this.game.room()?.players.filter((player) => player.connected).length ?? 0
    );
  }
  maxImpostors(): number {
    return Math.max(1, Math.min(3, this.connectedPlayers() - 1));
  }
  setConfig(key: keyof RoomConfig, value: string | number | boolean): void {
    this.game.configure({ [key]: value });
  }
  selectedCategories(): string[] {
    const value = this.game.room()?.config.category ?? "animales";
    if (value === "mezcla") {
      return this.categories.map(([key]) => key);
    }
    const keys = value.split(",").filter(k => k.length > 0);
    return keys.length > 0 ? keys : ["animales"];
  }
  isCategorySelected(key: string): boolean {
    return this.selectedCategories().includes(key);
  }
  setCategory(key: string, checked: boolean): void {
    const selected = new Set(this.selectedCategories());
    if (checked) selected.add(key);
    else selected.delete(key);
    if (!selected.size) selected.add(key);
    this.setConfig("category", [...selected].join(","));
  }
  isAllCategoriesSelected(): boolean {
    const value = this.game.room()?.config.category ?? "animales";
    if (value === "mezcla") return true;
    const selected = this.selectedCategories();
    return selected.length === this.categories.length;
  }
  setAllCategories(checked: boolean): void {
    this.setConfig("category", checked ? "mezcla" : "animales");
  }
  trackPlayer(_: number, player: Player): string {
    return player.id;
  }
}
