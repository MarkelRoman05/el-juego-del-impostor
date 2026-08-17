import { Injectable, signal } from '@angular/core';

export interface MenuPlayer {
  id: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class MoreMenuService {
  readonly player = signal<MenuPlayer | null>(null);
  readonly open = signal(false);

  show(player: MenuPlayer): void {
    this.player.set(player);
    this.open.set(false);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => this.open.set(true)),
    );
  }

  close(): void {
    if (!this.open()) {
      this.player.set(null);
      return;
    }
    this.open.set(false);
  }

  closed(): void {
    if (!this.open()) this.player.set(null);
  }
}
