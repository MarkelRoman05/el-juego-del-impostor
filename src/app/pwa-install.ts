export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let pending: InstallPromptEvent | null = null;
let subscriber: ((event: InstallPromptEvent) => void) | null = null;

export function captureInstallPrompt(): void {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    pending = event as InstallPromptEvent;
    subscriber?.(pending);
  });
}

export function onInstallPrompt(listener: (event: InstallPromptEvent) => void): () => void {
  subscriber = listener;
  if (pending) listener(pending);
  return () => {
    if (subscriber === listener) subscriber = null;
  };
}

export function clearInstallPrompt(): void {
  pending = null;
}
