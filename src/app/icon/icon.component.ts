import { ChangeDetectionStrategy, Component, Input } from "@angular/core";

export type IconName =
  | "players"
  | "detective"
  | "game"
  | "note"
  | "clipboard"
  | "books"
  | "pencil"
  | "timer"
  | "ballot"
  | "play"
  | "lock"
  | "share"
  | "hourglass"
  | "theater"
  | "check"
  | "plug"
  | "mic"
  | "plus"
  | "download"
  | "logout"
  | "question";

@Component({
  selector: "impostor-icon",
  standalone: true,
  template: `
    <svg
      class="icon"
      [class]="'icon-' + name"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @switch (name) {
        @case ("players") {
          <circle cx="9" cy="8" r="3.5" />
          <path d="M3.5 20c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M16 15.3c1.8.3 3.3 1.6 4 3.7" />
        }
        @case ("detective") {
          <path d="M5 9.5 7 6h10l2 3.5" />
          <path d="M4 9.5h16v2H4z" />
          <circle cx="12" cy="14" r="4" />
          <path d="M10 14h.01M14 14h.01M10 17c1.2.8 2.8.8 4 0" />
        }
        @case ("game") {
          <path
            d="m7 8-2 2-1 6a2 2 0 0 0 3.7 1l1.3-2h6l1.3 2a2 2 0 0 0 3.7-1l-1-6-2-2z"
          />
          <path d="M8 12v3M6.5 13.5h3M16 13h.01M18 15h.01" />
        }
        @case ("note") {
          <path d="M5 3h11l3 3v15H5z" />
          <path d="M16 3v4h3M8 12h8M8 16h6" />
        }
        @case ("clipboard") {
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        }
        @case ("share") {
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
        }
        @case ("books") {
          <path d="M4 5h4v15H4zM10 4h4v16h-4zM16 6h4v14h-4z" />
          <path d="M3 20h18" />
        }
        @case ("pencil") {
          <path d="m4 17 1-4L16 2l4 4L9 17zM4 17l4 1 12-12" />
          <path d="m14 4 4 4" />
        }
        @case ("timer") {
          <circle cx="12" cy="13" r="7" />
          <path d="M12 13V9M9 3h6M12 3v3" />
        }
        @case ("ballot") {
          <path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" />
          <path d="m15 16 1 1 2-2" />
        }
        @case ("play") {
          <path d="m8 5 11 7-11 7z" />
        }
        @case ("lock") {
          <rect x="5" y="10" width="14" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" />
        }
        @case ("hourglass") {
          <path
            d="M6 3h12M6 21h12M8 3c0 5 4 5 4 9s-4 4-4 9M16 3c0 5-4 5-4 9s4 4 4 9"
          />
        }
        @case ("theater") {
          <path d="M4 5h7v7H4zM13 12h7v7h-7z" />
          <path d="M7 8h.01M9 10h.01M16 15h.01M18 17h.01" />
        }
        @case ("check") {
          <path d="m5 12 4 4L19 6" />
        }
        @case ("plug") {
          <path d="M9 7v4M15 7v4M7 11h10v1a5 5 0 0 1-5 5v4M12 21v-4M8 7h8" />
        }
        @case ("mic") {
          <rect x="9" y="3" width="6" height="10" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
        }
        @case ("plus") {
          <path d="M12 5v14M5 12h14" />
        }
        @case ("download") {
          <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
        }
        @case ("logout") {
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
        }
        @case ("question") {
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.9.6-1.5 1.3-1.5 2.2" />
          <circle cx="12" cy="16.5" r="0.7" fill="currentColor" />
        }
      }
    </svg>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconComponent {
  @Input() name: IconName = "detective";
}
