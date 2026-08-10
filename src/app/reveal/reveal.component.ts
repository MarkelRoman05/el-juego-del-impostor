import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { NamesPipe } from "../names.pipe";
import { GameService } from "../game.service";
import { IconComponent } from "../icon/icon.component";

@Component({
  selector: "impostor-reveal",
  standalone: true,
  imports: [CommonModule, NamesPipe, IconComponent],
  templateUrl: "./reveal.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RevealComponent {
  readonly game = inject(GameService);
  isHost(): boolean {
    return this.game.me() === this.game.room()?.hostId;
  }
  playerName(id: string): string {
    return (
      this.game.room()?.players.find((player) => player.id === id)?.name ?? "?"
    );
  }
  trackVote(_: number, vote: { id: string }): string {
    return vote.id;
  }
}
