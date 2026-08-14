import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly dialog = signal<{ message: string } | null>(null);
  readonly show = signal(false);
  private resolveFn: ((value: boolean) => void) | null = null;

  ask(message: string): Promise<boolean> {
    this.dialog.set({ message });
    this.show.set(false);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => this.show.set(true)),
    );
    return new Promise((resolve) => {
      this.resolveFn = resolve;
    });
  }

  confirm(): void {
    this.finish(true);
  }

  cancel(): void {
    this.finish(false);
  }

  closed(): void {
    if (!this.show()) this.dialog.set(null);
  }

  private finish(value: boolean): void {
    if (!this.dialog()) return;
    this.resolveFn?.(value);
    this.resolveFn = null;
    this.show.set(false);
  }
}
