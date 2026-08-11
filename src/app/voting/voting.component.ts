import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { GameService } from "../game.service";
import { Player } from "../game.models";
import { formatGameTime } from "../game-time";
import { IconComponent } from "../icon/icon.component";

@Component({
  selector: "impostor-voting",
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: "./voting.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VotingComponent {
  readonly game = inject(GameService);
  private readonly now = signal(Date.now());
  private readonly timer = setInterval(() => this.now.set(Date.now()), 500);

  constructor() {
    inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
  }

  isHost(): boolean {
    return this.game.me() === this.game.room()?.hostId;
  }

  remaining(): string {
    return formatGameTime(this.game.votingDeadline() - this.now());
  }

  canVote(player: Player): boolean {
    return player.connected && !player.eliminated && player.id !== this.game.me();
  }
  
  trackPlayer(_: number, player: Player): string {
    return player.id;
  }
}
