# El Impostor

## Commands

- Node.js `>=22.22.3` is required; `package-lock.json` must remain synchronized with `package.json`.
- `npm run build` builds Angular into `dist/el-impostor`; run it before serving production or running the DOM smoke test.
- `npm start` builds first and then runs `server.js`; Express serves `dist/el-impostor/browser` on `PORT` (default `3111`).
- `npm run dev` runs `scripts/dev.js`, which starts both Express and Angular; `PORT` controls Express and `DEV_PORT` controls Angular. The Angular proxy forwards `/socket.io` and `/api` to Express.
- After a build, run `node test/dom-config.test.js`.
- Integration tests are direct Node scripts, not `npm test`: start `PORT=3121 DATA_DIR=/tmp/impostor-data node server.js`, then run `URL=http://127.0.0.1:3121 node test/e2e.js` or a focused script such as `test/config-partial.test.js` and `test/words-privacy.test.js`. Use separate ports for parallel runs.
- `test/e2e.js CODE NAME` runs bot mode and stays connected. `npm run test:client` is the Angular test target; there are currently no client specs.
- There is no lint or formatter script.

## Runtime

- `server.js` is the CommonJS Express/Socket.IO entrypoint; `words.js` owns built-in categories and word data. `/healthz` is the container health endpoint.
- `Dockerfile` builds Angular inside the image, so do not remove `src`, `angular.json`, or TypeScript configs from the build context. `docker compose up --build` exposes port `3111` and persists `/app/data`.
- Express serves only `dist/el-impostor/browser`; do not put source or generated bundles in `public/`. `dist/`, `public/`, `.angular/`, and `node_modules/` are generated/local files.
- Admin credentials are read from `ADMIN_USER`/`ADMIN_PASS`, or `admin-credentials.json` under `DATA_DIR`; `admin-config.json`, `admin-tokens.json`, and `admin-credentials.json` are runtime state and must not be committed. Docker Compose reads credentials from environment or local `.env`.
- `DATA_DIR` defaults to the repository directory locally and is `/app/data` in Docker; it holds persistent admin state.

## Architecture

- `src/app/game.service.ts` is the client source of truth for Socket.IO state, local session recovery, phases, roles, votes, and reveals.
- Game phases are standalone components under `src/app/{home,lobby,round,voting,reveal,waiting}`; `AppComponent` only selects the phase and global overlays.
- Public player IDs are used for room UI actions, but reconnection requires the private `reconnectToken` returned in `room:joined`; never use or expose that token outside local session storage.
- Preserve Socket.IO event names and private role payload boundaries. Custom word lists must never appear in serialized room/lobby payloads.
- The impostor set is intentionally reused between rounds until the game resets to the lobby; do not silently change that behavior.
- Client code uses strict TypeScript with strict Angular templates, signals, `inject`, and `OnPush`; use template bindings rather than DOM manipulation or `innerHTML`.
- The only automatic game timer is the voting deadline; the round `timer` field remains inactive.
