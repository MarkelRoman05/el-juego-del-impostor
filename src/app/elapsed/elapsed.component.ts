import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IconComponent } from "../icon/icon.component";
import { formatGameTime } from "../game-time";

@Component({
  selector: "impostor-elapsed",
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: "./elapsed.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ElapsedComponent {
  readonly ms = input<number | null>(null);
  readonly text = computed(() => {
    const ms = this.ms();
    return ms == null ? "" : formatGameTime(ms);
  });
}
