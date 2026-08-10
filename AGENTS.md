# El Impostor

## Runtime And Build

- Node.js `>=22.22.3` is required by Angular 22; use the same requirement locally and in Docker.
- Install dependencies with `npm install`; `package-lock.json` is committed and must stay in sync with `package.json`.
- `npm run build` is required before `npm start`; Angular outputs the browser bundle to `dist/el-impostor/browser`.
- Express serves `dist/el-impostor/browser` from `server.js`; do not put source files or generated bundles back in `public/`.
- `dist/`, `public/`, `.angular/`, and `node_modules/` are generated or local-only and are ignored.
- `Dockerfile` builds Angular inside the image, then prunes dev dependencies; keep `src`, `angular.json`, and TypeScript configs available to the build stage.

## Architecture

- `server.js` is the CommonJS Express and Socket.IO backend; `words.js` owns the word categories and dictionary data.
- `src/app/game.service.ts` is the single client-side source of truth for Socket.IO state, session storage, phases, roles, votes, and reveal data.
- Each game phase is a standalone Angular component under `src/app/{home,lobby,round,voting,reveal,waiting}`; `AppComponent` only selects the active phase and global overlays.
- Preserve the existing Socket.IO event names and private role payloads when changing the client; the server deliberately never serializes custom word lists.
- Client components use Angular signals, `inject`, `OnPush`, and strict TypeScript; prefer template bindings over DOM manipulation or `innerHTML`.

## Verification

- Run `node test/dom-config.test.js` after `npm run build`; it checks the generated Angular entrypoint and client privacy invariants.
- Backend integration tests need a running server and can target another port with `URL=http://127.0.0.1:PORT`: `test/e2e.js`, `test/verify-fixes.js`, `test/config-partial.test.js`, `test/words-privacy.test.js`, and `test/random-impostor.test.js`.
- Use a separate server port when running focused integration tests in parallel; these tests create live Socket.IO rooms and are not unit tests.
- `test/e2e.js CODE NAME` runs bot mode instead of the full scenario.
- There is no configured lint or formatter script; do not assume `npm test` covers the direct Node integration tests.
