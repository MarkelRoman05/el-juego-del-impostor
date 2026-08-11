import { ChangeDetectionStrategy, Component, inject, OnInit, signal, DestroyRef } from "@angular/core";
import { Router, RouterOutlet, NavigationEnd } from "@angular/router";
import { filter } from "rxjs/operators";
import { GameService } from "./game.service";
import { HomeComponent } from "./home/home.component";
import { LobbyComponent } from "./lobby/lobby.component";
import { RoundComponent } from "./round/round.component";
import { RevealComponent } from "./reveal/reveal.component";
import { WaitingComponent } from "./waiting/waiting.component";
import { IconComponent } from "./icon/icon.component";

@Component({
  selector: "impostor-root",
  standalone: true,
  imports: [
    RouterOutlet,
    HomeComponent,
    LobbyComponent,
    RoundComponent,
    RevealComponent,
    WaitingComponent,
    IconComponent,
  ],
  templateUrl: "./app.component.html",
  styleUrl: "../styles.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  readonly game = inject(GameService);
  readonly router = inject(Router);
  readonly destroyRef = inject(DestroyRef);
  readonly isAdmin = signal(false);

  ngOnInit(): void {
    this.checkRoute(this.router.url);
    const sub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e) => this.checkRoute((e as NavigationEnd).url));
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  private checkRoute(url: string): void {
    this.isAdmin.set(url.startsWith("/admin") || url.startsWith("#/admin"));
  }

  leaveGame(): void {
    const isHost = this.game.me() === this.game.room()?.hostId;
    const message = isHost
      ? "¿Finalizar la partida para todos?"
      : "¿Salir de la partida?";
    if (!window.confirm(message)) return;
    if (isHost) this.game.endGame();
    else this.game.leaveRound();
  }
}
