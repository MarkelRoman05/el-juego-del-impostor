import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { GameService } from "../game.service";
import { IconComponent } from "../icon/icon.component";

@Component({
  selector: "impostor-home",
  standalone: true,
  imports: [FormsModule, IconComponent],
  templateUrl: "./home.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  readonly game = inject(GameService);
  name = this.game.name();
  code = new URLSearchParams(location.search).get("c")?.toUpperCase() ?? "";
  words = this.game.loadWords();
  wordsOpen = false;

  create(): void {
    if (!this.name.trim())
      return this.game.notify("Escribe tu nombre para crear una partida");
    this.game.create(this.name.trim(), this.words);
  }

  join(): void {
    if (!this.name.trim())
      return this.game.notify("Escribe tu nombre para unirte");
    if (!/^[A-Z0-9]{4}$/.test(this.code))
      return this.game.notify("El código tiene 4 letras o números");
    this.game.join(this.code, this.name.trim(), this.words);
  }

  setCode(value: string): void {
    this.code = value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 4);
  }
  updateWords(): void {
    this.game.saveWords(this.words);
  }
}
