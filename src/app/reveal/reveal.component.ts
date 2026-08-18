import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { NamesPipe } from "../names.pipe";
import { GameService } from "../game.service";
import { ConfirmService } from "../confirm/confirm.service";
import { MoreMenuService } from "../more-menu/more-menu.service";
import { IconComponent } from "../icon/icon.component";
import { ElapsedComponent } from "../elapsed/elapsed.component";

@Component({
  selector: "impostor-reveal",
  standalone: true,
  imports: [CommonModule, NamesPipe, IconComponent, ElapsedComponent],
  templateUrl: "./reveal.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RevealComponent {
  readonly game = inject(GameService);
  readonly confirm = inject(ConfirmService);
  readonly menu = inject(MoreMenuService);
  
  isHost(): boolean {
    return this.game.me() === this.game.room()?.hostId;
  }

  openMenu(player: { id: string; name: string }): void {
    this.menu.show(player);
  }
}
