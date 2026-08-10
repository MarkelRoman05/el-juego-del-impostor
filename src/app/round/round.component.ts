import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  inject,
  signal,
} from "@angular/core";
import { GameService } from "../game.service";
import { formatGameTime } from "../game-time";
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
  private readonly now = signal(Date.now());
  private readonly timer = setInterval(() => this.now.set(Date.now()), 500);

  constructor() {
    inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
  }
  isHost(): boolean {
    return this.game.me() === this.game.room()?.hostId;
  }
  remaining(): string {
    const role = this.game.role();
    return !role || role.timer <= 0
      ? ""
      : formatGameTime(
          this.game.roundStartedAt() + role.timer * 1000 - this.now(),
        );
  }
  holdStart(event: Event): void {
    event.preventDefault();
    this.revealed.set(true);
  }
  holdEnd(): void {
    this.revealed.set(false);
  }
  @HostListener("window:pointerup") onPointerUp(): void {
    this.holdEnd();
  }
}
