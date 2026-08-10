import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { AdminService } from "./admin.service";
import { IconComponent } from "../icon/icon.component";

@Component({
  selector: "impostor-admin-login",
  standalone: true,
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="view active admin-login-view">
      <header class="hero">
        <div class="logo"><impostor-icon name="lock" /></div>
        <h1>Admin</h1>
      </header>
      <div class="card form-card">
        <form (ngSubmit)="login()">
          <label for="username">Usuario</label>
          <input
            id="username"
            type="text"
            [(ngModel)]="username"
            name="username"
            placeholder="Usuario"
            autocomplete="username"
            [disabled]="admin.loading()"
            (keydown.enter)="$event.preventDefault(); passwordInput.focus()"
          />
          <label for="password">Contraseña</label>
          <input
            #passwordInput
            id="password"
            type="password"
            [(ngModel)]="password"
            name="password"
            placeholder="Contraseña"
            autocomplete="current-password"
            [disabled]="admin.loading()"
          />
          @if (admin.error()) {
            <p class="error-msg">{{ admin.error() }}</p>
          }
          <button type="submit" class="btn primary big" [disabled]="admin.loading()">
            <impostor-icon name="lock" />
            {{ admin.loading() ? "Entrando..." : "Entrar" }}
          </button>
        </form>
        <button class="btn ghost" (click)="goBack()">
          Volver al juego
        </button>
      </div>
    </section>
  `,
  styles: [`
    .admin-login-view {
      min-height: 100dvh;
      justify-content: center;
      width: min(100% - 28px, 470px);
      margin: auto;
      padding: 18px 0;
    }
    .error-msg {
      color: var(--pink);
      font-size: 13px;
      text-align: center;
      margin: 8px 0;
      padding: 10px;
      background: #2a1526;
      border: 1px solid #ff6b9680;
      border-radius: 10px;
    }
  `],
})
export class AdminLoginComponent {
  readonly admin = inject(AdminService);
  readonly router = inject(Router);

  username = "";
  password = "";

  async login(): Promise<void> {
    if (!this.username.trim() || !this.password) return;
    const success = await this.admin.login(this.username.trim(), this.password);
    if (success) {
      await this.router.navigate(["/admin"]);
    }
  }

  goBack(): void {
    this.router.navigate(["/"]);
  }
}
