# El Impostor

## Commands

- Node.js `>=22.22.3` is required; keep `package-lock.json` synchronized with `package.json`.
- `npm run build` creates `dist/el-impostor`; run it before production serving or `node test/dom-config.test.js`.
- `npm start` builds first, then runs `server.js` on `PORT` (default `3111`).
- `npm run dev` starts Express and Angular together; `PORT` is Express and `DEV_PORT` is Angular. The dev proxy forwards `/socket.io` and `/api`.
- Integration tests are direct Node scripts, not `npm test`: start `PORT=3121 DATA_DIR=/tmp/impostor-data node server.js`, then run `URL=http://127.0.0.1:3121 node test/e2e.js` or a focused `test/*.test.js` script. Use a different port for parallel runs.
- `node test/e2e.js CODE NAME` is bot mode and intentionally stays connected; `npm run test:client` is the Angular test target, currently with no client specs.
- There is no lint or formatter script.

## Runtime

- `server.js` is the CommonJS Express/Socket.IO entrypoint; `words.js` owns built-in word data and `/healthz` is the container health endpoint.
- Express serves only `dist/el-impostor/browser`; `dist/`, `public/`, `.angular/`, and `node_modules/` are generated/local files.
- `Dockerfile` builds Angular inside the image, so keep `src`, `angular.json`, and TypeScript configs in the Docker build context. `docker compose up --build` exposes `3111` and persists `/app/data`.
- Admin credentials come from `ADMIN_USER`/`ADMIN_PASS` or `admin-credentials.json` under `DATA_DIR`; runtime files `admin-config.json`, `admin-tokens.json`, and `admin-credentials.json` must not be committed.
- `DATA_DIR` defaults to the repository directory locally and `/app/data` in Docker.

## Architecture

- `src/app/game.service.ts` is the client source of truth for Socket.IO state, session recovery, phases, roles, and final reveals; `server.js` owns room state and event validation.
- The active game phases are `home`, `lobby`, `round`, `gameover`, and `waiting`; `AppComponent` selects standalone phase components and global overlays.
- There is no in-game voting phase. The host ends a round through `impostor:mark`; the server emits `game:over` with impostor names and the word, then `round:next` returns to the lobby.
- The impostor set is intentionally reused across rounds until reset to the lobby; do not change this without updating game semantics and tests.
- Public player IDs are used for room actions, but reconnection requires the private `reconnectToken` from `room:joined`; keep it only in local session storage.
- Preserve Socket.IO event names and private role payload boundaries. Custom word lists must never appear in serialized room/lobby payloads.
- Angular uses strict TypeScript/templates, standalone components, signals, `inject`, and `OnPush`; use template bindings rather than DOM manipulation or `innerHTML`.
- There is no game timer: only the host can end the round or return to the lobby.
