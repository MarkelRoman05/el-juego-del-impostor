import { ChangeDetectionStrategy, Component } from "@angular/core";
import { IconComponent } from "../icon/icon.component";

@Component({
  selector: "impostor-waiting",
  standalone: true,
  imports: [IconComponent],
  templateUrl: "./waiting.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaitingComponent {}
