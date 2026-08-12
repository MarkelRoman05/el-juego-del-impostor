import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { captureInstallPrompt } from './app/pwa-install';

captureInstallPrompt();

bootstrapApplication(AppComponent, appConfig).catch((error: unknown) => console.error(error));

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
