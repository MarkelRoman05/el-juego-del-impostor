import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  signal,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { GameService } from "../game.service";
import { Player } from "../game.models";
import { IconComponent } from "../icon/icon.component";

@Component({
  selector: "impostor-round",
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: "./round.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoundComponent {
  readonly game = inject(GameService);
  readonly revealed = signal(false);
  isHost(): boolean {
    return this.game.me() === this.game.room()?.hostId;
  }
  trackPlayer(_: number, player: Player): string {
    return player.id;
  }
  isPlayingPlayer(playerId: string): boolean {
    const room = this.game.room();
    return !(playerId === room?.hostId && room.config.hostPlays === false);
  }
  holdStart(event: Event): void {
    event.preventDefault();
    this.revealed.set(true);
  }
  holdEnd(): void {
    this.revealed.set(false);
  }
  finishGame(): void {
    if (window.confirm("¿Confirmar que ha dicho la palabra correcta?")) {
      this.game.markImpostor();
    }
  }
  @HostListener("window:pointerup") onPointerUp(): void {
    this.holdEnd();
  }
}
