import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { GameService } from "../game.service";
import { IconComponent } from "../icon/icon.component";
import { InstallPromptEvent, onInstallPrompt, clearInstallPrompt } from "../pwa-install";

@Component({
  selector: "impostor-home",
  standalone: true,
  imports: [FormsModule, IconComponent],
  templateUrl: "./home.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  readonly game = inject(GameService);
  readonly destroyRef = inject(DestroyRef);
  name = this.game.name();
  code = new URLSearchParams(location.search).get("c")?.toUpperCase() ?? "";

  readonly showInstall = signal(false);
  private installPrompt: InstallPromptEvent | null = null;
  private readonly isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  constructor() {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;
    if (this.isIOS) this.showInstall.set(true);
    const stopListening = onInstallPrompt((event) => {
      this.installPrompt = event;
      this.showInstall.set(true);
    });
    window.addEventListener("appinstalled", this.onAppInstalled);
    this.destroyRef.onDestroy(() => {
      stopListening();
      window.removeEventListener("appinstalled", this.onAppInstalled);
    });
  }

  private onAppInstalled = (): void => {
    clearInstallPrompt();
    this.showInstall.set(false);
  };

  install(): void {
    if (this.installPrompt) {
      this.installPrompt.prompt();
      this.installPrompt = null;
      return;
    }
    this.game.notify("Usa Compartir y elige «Añadir a pantalla de inicio»");
  }

  create(): void {
    if (!this.name.trim())
      return this.game.notify("Escribe tu nombre para crear una partida");
    this.game.create(this.name.trim());
  }

  join(): void {
    if (!this.name.trim())
      return this.game.notify("Escribe tu nombre para unirte");
    if (!/^[A-Z0-9]{4}$/.test(this.code))
      return this.game.notify("El código tiene 4 letras o números");
    this.game.join(this.code, this.name.trim());
  }

  setCode(value: string): void {
    this.code = value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 4);
  }
}
