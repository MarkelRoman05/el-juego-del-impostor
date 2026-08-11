# El Impostor

## Commands

- Node.js `>=22.22.3` is required; `package-lock.json` must remain synchronized with `package.json`.
- `npm run build` builds Angular into `dist/el-impostor`; `npm start` builds first and then runs Express.
- `npm run dev` starts Express on `:3111` and Angular with `proxy.conf.json`; use `npx ng serve` only when the backend is already running. There is no `ng dev` command.
- After a build, run `node test/dom-config.test.js`.
- Integration tests are direct Node scripts, not `npm test`: start a server with `PORT=3121 DATA_DIR=/tmp/impostor-data node server.js`, then run them with `URL=http://127.0.0.1:3121 node test/e2e.js` (or the other files in `test/`). Use separate ports for parallel runs.
- `test/e2e.js CODE NAME` runs bot mode. `npm run test:client` is the Angular test target, but there are currently no client specs in the repository.
- There is no lint or formatter script.

## Runtime

- `server.js` is the CommonJS Express/Socket.IO entrypoint; `words.js` owns built-in categories and word data.
- `Dockerfile` builds Angular inside the image, so do not remove `src`, `angular.json`, or TypeScript configs from the build context.
- Express serves only `dist/el-impostor/browser`; do not put source or generated bundles in `public/`. `dist/`, `public/`, `.angular/`, and `node_modules/` are generated/local files.
- Admin credentials are read from `ADMIN_USER`/`ADMIN_PASS`, or `admin-credentials.json` under `DATA_DIR`; runtime admin config, tokens, and credentials must not be committed. Docker Compose reads these variables from the local `.env` file.
- `DATA_DIR` defaults to the repository directory locally and is `/app/data` in Docker; it holds persistent admin state.

## Architecture

- `src/app/game.service.ts` is the client source of truth for Socket.IO state, local session recovery, phases, roles, votes, and reveals.
- Game phases are standalone components under `src/app/{home,lobby,round,voting,reveal,waiting}`; `AppComponent` only selects the phase and global overlays.
- Public player IDs are used for room UI actions, but reconnection requires the private `reconnectToken` returned in `room:joined`; never use or expose that token outside local session storage.
- Preserve Socket.IO event names and private role payload boundaries. Custom word lists must never appear in serialized room/lobby payloads.
- The impostor set is intentionally reused between rounds until the game resets to the lobby; do not silently change that behavior.
- Client code uses strict TypeScript, signals, `inject`, and `OnPush`; use template bindings rather than DOM manipulation or `innerHTML`.
- The only automatic game timer is the voting deadline; the round `timer` field remains inactive.
