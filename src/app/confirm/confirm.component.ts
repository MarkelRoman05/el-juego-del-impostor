import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { ConfirmService } from './confirm.service';
import { IconComponent } from "../icon/icon.component";

@Component({
  selector: 'impostor-confirm',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './confirm.component.html',
  styleUrl: './confirm.component.css',
  imports: [IconComponent],
})
export class ConfirmComponent {
  readonly confirm = inject(ConfirmService);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.confirm.dialog()) this.confirm.cancel();
  }
}
