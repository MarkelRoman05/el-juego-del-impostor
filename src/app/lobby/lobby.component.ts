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
  deportes: "Deportes",
  futbol: "Fútbol",
  profesiones: "Profesiones",
  objetos: "Objetos",
  naturaleza: "Naturaleza",
  tecnologia: "Tecnología",
  musica: "Música",
  mezcla: "Mezcla",
};
const TIMERS = [
  { value: 0, label: "Sin límite" },
  { value: 30, label: "30 s" },
  { value: 60, label: "1 min" },
  { value: 120, label: "2 min" },
  { value: 180, label: "3 min" },
];

@Component({
  selector: "impostor-lobby",
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: "./lobby.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LobbyComponent {
  readonly game = inject(GameService);
  readonly categories = Object.entries(CATEGORIES);
  readonly timers = TIMERS;
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
  trackPlayer(_: number, player: Player): string {
    return player.id;
  }
}
