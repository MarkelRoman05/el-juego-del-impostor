import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { GameService } from '../game.service';
import { MoreMenuService } from './more-menu.service';
import { ConfirmService } from '../confirm/confirm.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'impostor-more-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './more-menu.component.html',
  styleUrl: './more-menu.component.css',
  imports: [IconComponent],
})
export class MoreMenuComponent {
  readonly menu = inject(MoreMenuService);
  readonly game = inject(GameService);
  readonly confirm = inject(ConfirmService);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.menu.open()) this.menu.close();
  }

  makeHost(): void {
    const player = this.menu.player();
    if (!player) return;
    this.menu.close();
    this.game.setHost(player.id);
  }

  async kick(): Promise<void> {
    const player = this.menu.player();
    if (!player) return;
    this.menu.close();
    if (await this.confirm.ask(`¿Expulsar a '${player.name}' de la sala?`)) {
      this.game.kick(player.id);
    }
  }
}
