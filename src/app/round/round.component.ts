import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  signal,
} from "@angular/core";
import { GameService } from "../game.service";
import { IconComponent } from "../icon/icon.component";

@Component({
  selector: "impostor-round",
  standalone: true,
  imports: [IconComponent],
  templateUrl: "./round.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoundComponent {
  readonly game = inject(GameService);
  readonly revealed = signal(false);
  isHost(): boolean {
    return this.game.me() === this.game.room()?.hostId;
  }
  isHintEnabled(): boolean {
    return this.game.room()?.config.impostorHint === true;
  }
  holdStart(event: Event): void {
    event.preventDefault();
    this.revealed.set(true);
  }
  holdEnd(): void {
    this.revealed.set(false);
  }
  leaveRound(): void {
    if (window.confirm("¿Salir de la partida? Esta acción no se puede deshacer.")) {
      this.game.leaveRound();
    }
  }
  @HostListener("window:pointerup") onPointerUp(): void {
    this.holdEnd();
  }
}
