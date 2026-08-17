import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  signal,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { GameService } from "../game.service";
import { ConfirmService } from "../confirm/confirm.service";
import { MoreMenuService } from "../more-menu/more-menu.service";
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
  readonly confirm = inject(ConfirmService);
  readonly menu = inject(MoreMenuService);
  readonly revealed = signal(false);
  isHost(): boolean {
    return this.game.me() === this.game.room()?.hostId;
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
  async finishGame(): Promise<void> {
    if (await this.confirm.ask("¿Confirmar que quieres finalizar la sesión?")) {
      this.game.markImpostor();
    }
  }

  openMenu(player: { id: string; name: string }): void {
    this.menu.show(player);
  }

  @HostListener("window:pointerup") onPointerUp(): void {
    this.holdEnd();
  }
}
