import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { GameService } from "./game.service";
import { HomeComponent } from "./home/home.component";
import { LobbyComponent } from "./lobby/lobby.component";
import { RoundComponent } from "./round/round.component";
import { VotingComponent } from "./voting/voting.component";
import { RevealComponent } from "./reveal/reveal.component";
import { WaitingComponent } from "./waiting/waiting.component";
import { IconComponent } from "./icon/icon.component";

@Component({
  selector: "impostor-root",
  standalone: true,
  imports: [
    HomeComponent,
    LobbyComponent,
    RoundComponent,
    VotingComponent,
    RevealComponent,
    WaitingComponent,
    IconComponent,
  ],
  templateUrl: "./app.component.html",
  styleUrl: "../styles.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  readonly game = inject(GameService);
}
