# Project facts

Durable facts about this project that aren't obvious from the code and shouldn't have to be re-explained each
session. Safety rules live in `CLAUDE.md`; reasons for decisions live in `docs/DECISIONS.md`; what changed when lives
in `docs/CHANGES.md`. Add a fact with the date you learned it. Delete it when it stops being true.

## Repo and people

- The repo is `github.com/garyreyes/dlsu-map`, public, default branch `main`. Gary Reyes owns it, so only Gary's
  account can change settings such as branch protection. (2026-10-19)
- `main` is protected by a repository ruleset (id 25407958), on since 2026-10-19: PR required with 0 approvals,
  `gates` required and the branch up to date with `main`, no force-push, no deletion. Without `gh`, a branch is
  pushed from the terminal and the PR is opened and merged on github.com. (2026-10-19)
- Charles's GitHub account is `charlesco-05`, with write access to the repo (can open and merge PRs, not change
  settings). (2026-10-19)
- The required CI check is named **`gates`**. Renaming the job breaks branch protection until the rule is updated
  to match. (2026-10-19)

## Local machine (Windows)

- Node 24 is installed (via winget) but isn't on the Git Bash PATH by default. Prepend it:
  `export PATH="/c/Program Files/nodejs:$PATH"`. PowerShell finds it normally. (2026-10-19)
- The GitHub CLI (`gh` 2.102.0) is installed on Charles's laptop at `C:\Program Files\GitHub CLI\gh.exe`. A Git Bash
  session opened before the install doesn't have it on PATH; use the full path or open a new terminal. Gary's laptop
  has `gh` 2.96.0, signed in as `garyreyes` with admin on the repo. (2026-10-19)
- Git converts line endings (`core.autocrlf`), so "LF will be replaced by CRLF" warnings are expected and harmless.
  (2026-10-19)

## Working on the code

- Setup after cloning: Node 24, then `npm ci` (also installs the Husky hook). `npm run dev` compiles the data,
  then starts Vite.
- **`public/data/*.json` is generated and gitignored.** `npm run compile-data` writes it from `data-src/`; `dev`
  and `build` run it first, so CI fails on any broken data constraint. Never edit it by hand. (2026-10-20)
- Files under `tests/` and `scripts/` (tsconfig.node, `module: nodenext`) import JSON with
  `with { type: 'json' }`; src files don't need it. (2026-10-20)
- Before a PR: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, then `npm run e2e` (it serves the
  build), which are the same commands CI runs.
- **TypeScript (D1):** `@typescript/typescript6@6.0.2` is the package version but it contains compiler 6.0.3; ESLint
  and the editor use it. `@typescript/native` is `typescript@7`, and `npm run typecheck` calls its `tsc` by full
  path. `tsc` 7 runs in build mode (`-b`) over `tsconfig.app.json` (src/) and `tsconfig.node.json` (configs, tests,
  scripts, tools). (2026-10-19)
- **Line endings:** `.gitattributes` forces LF in the working copy on every OS. Without it, Windows checkouts get CRLF
  and `prettier --check` fails locally while passing in Linux CI. (2026-10-19)
- **Layer rules** (`eslint.boundaries.js`) use built-in ESLint rules only. They cover static and dynamic `import()`,
  but not CommonJS `require` or aliasing `window` to a variable before calling `.fetch`; review catches those.
  Feature code lives either at the feature's top level (logic) or under `components/` (UI); any other subfolder is
  treated as logic. (2026-10-19)

## OpenStreetMap data

- **Overpass is unreliable from here:** every public mirror returned 502/504 or timed out on 2026-10-19 and
  2026-10-20. The main API (`api.openstreetmap.org/api/0.6/map.json?bbox=…`) answered in about 3 s with 2.5 MB, so
  `npm run fetch-osm` uses it (D27). It needs a `User-Agent` naming the app. (2026-10-20)
- **An area request cuts relations at its edge.** It returns every way touching the area in full, but a relation
  only with the members that touch it. The campus boundary (relation 11126048) came back with 2 of its 9 ways, so
  the script fetches such relations again with `/relation/<id>/full`. Every building came back complete. (2026-10-20)
- The campus boundary is 9 separate outer rings, plus gates and entrances as points on its ways. Only 2 hold our
  buildings (the main campus; STRC, Andrew and Razon across Taft); the other 7 are small patches (bike parking and
  the like, 42–1,144 m²) that the compiler drops and lists. Miguel Hall (relation 6095002) is a multipolygon with a
  courtyard hole, which `campus.json` can't draw yet (no holes). `type=building` relations (One Archers' Place, a
  hotel) add no shape: their outline and parts are ordinary ways. (2026-10-20)
- Ways come back complete even far outside the area: the LRT line way runs the length of Manila with all its
  stations. The compiler clips to what the scene needs. (2026-10-20)
- **OSM `building:part`s cover only part of a footprint here** (at ground level: Yuchengco 54%, Henry Sy 16%,
  St. La Salle 0%). So the compiler draws a building's outline at its own height *plus* its parts; the usual 3D rule
  "parts replace the outline" would make most of St. La Salle vanish. A few connector parts reach out of their
  building (centre outside it); the compiler gives them to the building holding their corners and says so. (2026-10-20)
- **`campus.json` coordinates: x is meters east, y is meters north** of the origin 120.9932, 14.5647, WGS84 scale
  (`src/shared/geo/project.ts`). `prototypes/map-home/campus.json` is different: y is meters *south* (three.js z)
  and it sits about 21 m west. Never copy coordinates from the prototype. (2026-10-20)
- Node 24 runs `scripts/*.ts` directly (type stripping), so scripts import other `.ts` files with the extension and
  need no build step. `Object.groupBy` isn't available: `tsconfig.node.json` targets ES2023. (2026-10-20)

## Floor photos and extraction

- **Official DLSU floor plans are not guaranteed** (owner, 2026-10-20). The evacuation-map photos are the main source
  for all 10 buildings, through `tools/floor-extract/` (D17, D29).
- **Two map styles on campus.** STRC's signs are green (light-green paper, double black walls, green route). Every other
  building photographed (St. Joseph, Velasco, Miguel, Andrew, Yuchengco) uses a white "EVACUATION MAP" template: thin
  grey single walls, a **red** route, black pillar squares, often under a plastic sleeve with glare. The tool detects
  the style from the paper (`--style` overrides). Thresholds were measured on STRC 4F and St. Joseph 3F. (2026-10-20)
- **Read the corners precisely.** Use `npm run floor-extract -- crop <photo> <x,y>…` and read each corner pillar's
  centre off the grid labels (the crop shifts near the photo's edge, so never work out offsets by hand). On
  St. Joseph 3F, rough corners lost half the partitions; read ones found nearly all. For a building that isn't a
  rectangle, extend the outer walls' lines to make the 4 corners. (2026-10-20)
- What the draft always gets wrong (cleanup, D17): stair and ramp treads read as walls, boxes around exit signs and
  "YOU ARE HERE", some short wall stubs and outer walls missed. 0.4–1.9 s per floor. (2026-10-20)

## Room lists

- **`data-src/rooms/<building>.csv`**, one per building, named by slug. Columns:
  `floor,code,name,floor_label,floor_checked,note`. `floor` is a whole number (G = 1). `code` is typed as printed
  on the lobby directory (`C404/406`, `C-309`); the compiler expands combined entries (`/`, `-` and `&` all
  separate rooms, D18) and makes codes canonical with `parseRoomCode`. `floor_checked` = `yes` lets a room sit
  off number ÷ 100 (D26). `note` records every change from the sign. (2026-10-20)
- **A dash between room numbers is a range on Velasco, St. Joseph and St. Miguel** (D33), so those CSVs type the
  range out with `/` and a note. Check each new sign: on STRC the dash means "and".
- **Prefixes as typed:** Velasco prints `VH-` and St. Joseph `J-`; both are only suggested (D25), so the CSVs use `VL-`
  and `SJ-`. St. Miguel prints bare numbers; its CSV adds `SM`. Miguel 3F's "AFED-FA" (Dining Room/Employee Canteen)
  is not a room code and is left out. (2026-10-20)
- Names are typed as printed, with obvious spelling fixed and trailing periods dropped; abbreviations stay
  (`Che`, `CMD`, `BCRU`). (owner, 2026-10-20)
- **STRC's directory has one wrong code:** its 4th-floor "Stock Room · C302" is entered as **C402** (C302 is a 3rd-floor
  lab). And `C102/104-106` is rooms 102, 104 and 106, since C105 is the Mechatronics Lab. Both are the owner's
  calls, 2026-10-20; check the doors when next on site.
- **Owner calls on the other signs** (2026-10-20; check the doors when next on site): Velasco lists **VH-106** twice
  (CNC Lab, MEM CIM Lab), entered as one room with both names; **VH-201A-206** is 201A then 202–206 (no 201 or 201B).
  St. Joseph's **601/602A/B** wrap is split as "Chemical Room" and "Devt. Biology Research Room", and **J-208/209**
  (printed under J-202/203) is read as the same Comparative Anatomy Lab.
- `tsconfig.node.json` maps `@/*` so scripts can typecheck src files that use the alias. Type imports only: Node
  doesn't resolve `@/`, so a value import through it would crash `compile-data` (CI's build step catches
  it). (2026-10-20)

## Cloudflare

- The free Cloudflare account is Gary's, signed in with GitHub. Never upgrade it to Workers Paid (D11).
- `CLOUDFLARE_API_TOKEN` is a user API token made from the **Edit Cloudflare Workers** template, scoped to this one
  account (My Profile → API Tokens). Tokens in the current format start with `cfut_`. Both it and
  `CLOUDFLARE_ACCOUNT_ID` are GitHub Actions secrets only. (2026-10-19)
- Adding a secret on github.com: the token goes in the **Secret** box, not **Name**. A secret whose name looks like
  random characters is a pasted token: delete it and roll the token in Cloudflare. (2026-10-19)
- **Checked live on 2026-10-20** with a throwaway Worker (wrangler 4.147.0, then deleted):
  - `wrangler versions upload` fails on a Worker that doesn't exist yet ("run the `deploy` command first").
  - `wrangler deploy` with `workers_dev: false` creates the Worker with no live URL: "No targets deployed", and
    `<name>.<account>.workers.dev` returns 404 (error 1042). D28 relies on this.
  - With `preview_urls: true`, `versions upload --preview-alias pr-1` gives `https://pr-1-<name>.gary-reyes.workers.dev`.
    Uploading again to the same alias updates that link within about 12 s. Deleting the Worker removes its previews.
  - `public/_headers` is applied on preview links and in `wrangler dev` alike. `/_headers` itself is never served.
  - With `not_found_handling: "single-page-application"`, **any** missing path gets `index.html` with status 200,
    including `/data/missing.json` fetched with `Sec-Fetch-Mode: cors`. So `shared/data` must reject a response
    whose content type isn't JSON; `res.ok` alone passes. Same in `wrangler dev`.
- The account's workers.dev subdomain is `gary-reyes`, so preview links contain the owner's name. They are public to
  anyone with the link and carry `noindex` (D19). (2026-10-20)
- On Gary's laptop, `npx playwright install chromium` times out (Playwright's downloader; plain `curl` of the same
  file works). Run the e2e tests on the installed Chrome instead: `PLAYWRIGHT_CHANNEL=chrome npm run e2e`. CI
  downloads its own Chromium. (2026-10-20)

## 3D stack (1c)

- **camera-controls 3 renamed its pans.** `ACTION.SCREEN_PAN` / `TOUCH_SCREEN_PAN` is the map-style pan (a vertical
  drag moves along the ground); `ACTION.TRUCK` slides in the screen's plane. `verticalDragToForward` was removed and
  only logs a warning. drei doesn't re-export `ACTION`, so `CameraRig.tsx` reads it from the controls' class.
  (2026-10-20)
- **R3F's `<Canvas fallback>` is never seen in a browser that has canvas:** R3F renders it as the `<canvas>`
  element's children. A WebGL failure is rethrown during render, so the app's `ErrorBoundary` shows "The map couldn't
  load" instead. `tests/e2e/home.spec.ts` checks this by stubbing out `getContext('webgl…')`. (2026-10-20)
- **The React Compiler lint rules only recognise refs by name:** a ref passed as a prop must be called `…Ref`, or
  `react-hooks/immutability` flags writes to `.current`. The compiler itself isn't in the build, so stable callbacks
  (like a ref callback that sets the camera up) still need `useCallback`. (2026-10-20)
- **The 3D map is a lazy chunk** (`React.lazy` in `src/app/App.tsx`): the pill and sheet load in about 385 kB, and
  three.js follows in about 960 kB, so search works before the scene is ready (user-flows §3.2). (2026-10-20)

## Offline (1d)

- **Workbox's generated service worker reports no download progress.** vite-plugin-pwa's `onOfflineReady` fires once,
  when the first copy is complete. A percentage needs `injectManifest` (our own service worker), so O2 has none for
  now (10a). (2026-10-20)
- **`onOfflineReady` fires only on the first save, never on later opens.** `useOfflineStatus` reads "already saved"
  off the registration: an active worker means the copy is complete, because Workbox precaches before activating.
  (2026-10-20)
- **Saved is not controlled.** Without `clientsClaim`, the page open during the first save keeps using the network
  until a reload, so going offline right after "Ready offline" could still lose the 3D chunk. `clientsClaim: true`
  fixes it; updates still wait for every tab to close (`registerType: 'prompt'`). `tests/e2e/offline.spec.ts` checks
  both. (2026-10-20)
- **The precache list check** reads the `url:"…"` entries out of `dist/sw.js` and compares them with every file in
  `dist/`. A new file type in `public/` fails it until `globPatterns` in `vite.config.ts` covers it (or it is added to
  the test's named exceptions). Playwright's `serviceWorkers: 'block'` stands in for "never got saved". (2026-10-20)
- **Faking the network in the offline tests** (Chromium, verified in 1▸):
  - `context.route` also catches the service worker's own precache downloads, so aborting one file makes the first
    save fail on purpose.
  - Registering the same `sw.js` again after a failed first install starts a fresh install. That is how "Saving
    paused" retries in place.
  - "Opened with no signal" is faked by overriding `Navigator.prototype.onLine` in `addInitScript`. A localStorage
    flag lets it survive the reload that signal returning triggers. (2026-10-20)
- **`navigator.onLine` only says "no signal" reliably.** `true` can mean Wi-Fi with no internet (a login page). So
  "Try again" calls `canReachSite()` (`shared/data/reach.ts`) before reloading. (2026-10-20)

## Zod and the CSP

- **Zod 4 probes for `eval` when it builds a schema, and the CSP blocks it** (`script-src 'self'`; no
  `'unsafe-eval'`). `tests/e2e/hosting.spec.ts` reports it as "script-src blocked eval". Until 2c nothing in the
  first-load bundle imports a schema, which is why `canReachSite` lives in `reach.ts`, apart from `load.ts`.
  **2c will hit this** when the scene calls `loadCampus`. Likely fix: `z.config({ jitless: true })` once at start-up
  (Zod's own switch for CSP-restricted pages). Never relax the CSP for it. (2026-10-20)

## Tool versions pinned in CI

- `markdownlint-cli2@0.23.3`: an exact-pinned devDependency since 1a, and CI's `npx` step uses the same version. Bump
  both together. Its dependencies carry dev-only `npm audit` warnings (braces, katex, smol-toml); the shipped app has
  none (`npm audit --omit=dev` is clean). (2026-10-19)
- `impeccable@4.6.0` for the design detector, to match the locally installed Impeccable plugin. Bump both together.
  Exit 0 = clean, 2 = findings (fails CI), 1 = couldn't scan. Telemetry is off in CI (`DO_NOT_TRACK=1`).
  (2026-10-19)
- GitHub Actions: `actions/checkout@v7` and `actions/setup-node@v7`, both official. No third-party actions: change
  detection is a short shell step instead of `dorny/paths-filter`. (2026-10-19)
- `wrangler@4.149.0` and `@playwright/test@1.63.0`, exact-pinned devDependencies for 1b. 4.149.0 is the first
  wrangler whose `miniflare` pulls `sharp@0.35.5`; 4.147.0/4.148.0 pull `sharp@0.35.4`, which has a high-severity
  librsvg advisory (GHSA-wq5f-xc86-pv6w). Don't pin wrangler below 4.149.0. (2026-10-20)
- `motion` stays on major 12 (`^12.43.0`): `react-modal-sheet` 5.6.0 is built and tested against `motion` 12.35
  (its devDependency), and `motion` 14 only came out on 2026-10-02. Move to 14 only with a `react-modal-sheet`
  release that supports it, checked on a phone. (2026-10-20)

## Docs

- `docs/HANDOVER.md` is frozen history and is excluded from markdown lint. Don't reformat it. (2026-10-19)
- The PRD's use-case labels (`**UC2. …**`) are bold text, not headings, on purpose; lint rule MD036 is off for that.
  (2026-10-19)
