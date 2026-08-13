import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { GameService } from "../game.service";
import { IconComponent } from "../icon/icon.component";

@Component({
  selector: "impostor-waiting",
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: "./waiting.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaitingComponent {
  readonly game = inject(GameService);
}
