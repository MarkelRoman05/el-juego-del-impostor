import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { NamesPipe } from "../names.pipe";
import { GameService } from "../game.service";
import { Player } from "../game.models";
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
  trackPlayer(_: number, player: Player): string {
    return player.id;
  }
}
