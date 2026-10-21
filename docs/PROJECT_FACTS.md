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
- **ESLint and `tsc` 7 can disagree on narrowing.** ESLint (TS 6 API) flags an `as` cast or `?? x` as unnecessary that
  `tsc` 7 then needs, or the reverse. Write an explicit guard (`if (!a) return;`) that both accept instead of
  toggling the cast. (2026-10-20)
- **Adding a dependency on Charles's laptop churns the lockfile.** `npm install` there (npm 11.19) strips the
  `"peer": true` flags from entries Gary's npm wrote, so the diff touches dozens of unrelated packages. What worked in
  4b: keep main's `package-lock.json`, splice in only the new packages' entries by hand, then `npm ci` and
  `npm ls --all` to prove the lock is whole. (2026-10-21)
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
  buildings (the main campus; STRC, Andrew and Razon north of it, across the side streets: every one of our
  buildings is on the west side of Taft); the other 7 are small patches (bike parking and
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
- **OSM has no doors for our buildings.** The only `entrance=*` nodes on the 10 full buildings are street gates on
  4 outlines (Gates 4A/4B on Gokongwei, 5A/5B on Andrew, 6 on Razon, Gate 1 on St. La Salle), so entrances are pins
  in `data-src/campus/entrances.json` (D31). Gates come twice: Gate 1 is `node/821585690` (guarded, on the service
  road) and `node/7543149937` (on St. La Salle's wall); Gate 2 is also tagged "Henry Gate (GATE 2 NORTH)"
  (`node/11733783709`). `gates.json` picks one node per gate. (2026-10-20)
- **The 9 gates in `gates.json` are the ones students use** (Charles, 2026-10-20). Agno Gate is how students leave
  the main campus for Fidel A. Reyes St and the buildings across it. Leveriza Gate (`node/821585671`), the unnamed
  gate west of St. Joseph (`node/1385443464`) and the private gate near Yuchengco (`node/7607854120`) stay out.
  Gates 5A, 5B and 4A are also Andrew's and Gokongwei's doors, so a pin sits on each. (2026-10-20)
- **A door with no path on its side fails the build** ("the way to the nearest path goes through yuchengco"). Fix
  it in OSM: map the walkway, joined to an existing path at both ends, then re-fetch the snapshot. Same-day re-fetch
  means deleting that day's snapshot by hand first (the script won't overwrite it). Yuchengco's south-east door
  needed this on 2026-10-20. (2026-10-20)
- **Taft Avenue is two one-way carriageways** about 17 m apart with the LRT between them, each `sidewalk=right` and
  2–4 `lanes`, so the compiler draws one sidewalk per carriageway (D32). 9 `footway=crossing` ways cross it near
  campus. Leaving out the other main roads splits off about 29 pieces of city streets (186 points), which the
  compiler drops; the 3 inside the campus are escalators and raised walkways near Yuchengco (`level` 1–2, for the
  indoor network, 8a) and `way/814461722`, a footway that stops 3.4 m short of the next path in OSM. (2026-10-20)
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
- **Signs aren't drawn to OSM's proportions** (6b spike, D36). Long side ÷ short side, straightened sign against the
  OSM outline's smallest rectangle: STRC 4F 4.06 and 2F 4.21 against 3.61 (62.8 × 17.4 m); St. Joseph 3F 8.31
  against 7.31 (109.6 × 15.0 m); Miguel 3F 1.75 against 1.88 (57.3 × 30.5 m). Which is right is unknown; measuring
  STRC's width on site would settle it. Stretched onto the outline, the outline sits a median 0.1–0.4 m from the
  nearest traced wall (90th percentile 0.6–1.2 m). (2026-10-21)
- **The outline can't tell which way round a sign goes.** Over all 8 placements, a quarter turn always scores far
  worse (median 1.6–5 m off), but the right way and turned 180° tie for box-shaped buildings (STRC, Miguel) and only
  just differ for St. Joseph. Hence `fit.turn` by hand. Both STRC signs (2F, 4F) are drawn the same way round, odd
  rooms along the top. (2026-10-21)
- **Which outlines fit onto their own corners** (6b, points along a side bending under 5° dropped): Andrew, Velasco,
  Miguel, Razon's low block, Mutien-Marie and STRC (5 points in OSM, one on a nearly straight side, and skewed at its
  east end, so its east-end walls poke out up to about 1 m). Gokongwei, Yuchengco, St. Joseph, St. La Salle and
  Razon's tower get the smallest rectangle around them. Yuchengco has several volumes from the ground; a floor goes on
  the largest one standing at its height, so check Yuchengco's in 9c. (2026-10-21)
- **`turn: 0` can't flip on a new snapshot.** The campus grid sits about 25° off north, so of the two sides a sign's
  top can go on, one always faces clearly more north: north parts differ by at least 0.84 (short sides) and 1.8 (long
  sides) across all 16 buildings. A building squared to east–west would sit on the tie and could flip. (2026-10-21)
- **Storey height = the own outline's top ÷ `levels`.** Connon, St. La Salle and Yuchengco have a part rising past
  their main block (stair tower, roof deck); using the tallest top gave 4.08, 4.53 and 3.78 m storeys instead of
  3.4. Henry Sy comes out 3.57 m and Andrew 4.5 m, from their OSM `height`. (2026-10-21)

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
- **STRC’s directory is wrong twice** (owner checked the doors, 2026-10-21): its 4th-floor “Stock Room · C302” is
  **C402** (C302 is a 3rd-floor lab). And `C102/104-106` is not three rooms: 104 and 106 are one big lab, 105 is the
  Mechatronics Lab, and **102 is a different room**, left out until someone reads its door.
- **Owner calls on the other signs** (2026-10-20, all checked at the doors 2026-10-21): Velasco lists **VH-106** twice
  (CNC Lab, MEM CIM Lab), one door with both names; **VH-201A-206** is 201A, **201B** (a separate room beside it, not on
  the sign) and 202–206. St. Joseph's **601/602A/B** wrap is split as "Chemical Room" and "Devt. Biology Research
  Room" (601 is next to 602), and **J-208/209** (printed under J-202/203) is the same Comparative Anatomy Lab.
- `tsconfig.node.json` maps `@/*` so scripts can typecheck src files that use the alias. Type imports only: Node
  doesn't resolve `@/`, so a value import through it would crash `compile-data` (CI's build step catches
  it). (2026-10-20)

## Routing

- **Assumptions until 8a maps the real stairs and elevators** (not confirmed, 2026-10-21): every full-tier building
  has an elevator, and stairs cost the same going down as going up (20 s a floor). Auto only takes the elevator for 3+
  floors, so the first matters only when a student picks Elevator.
- **ngraph behaviour the router relies on** (probed 2026-10-21, ngraph.graph 20.1.2, ngraph.path 1.6.1):
  `aStar(...).find(a, b)` returns the path **target first**, so reverse it; it returns `[]` when nothing joins them
  and **throws** for a node id not in the graph. `addLink` on a pair that already has a link **overwrites** its data,
  and `getLink(b, a)` doesn't find a link added as `a, b`. So `walk-graph.ts` keeps its own cost map keyed by the pair
  and adds every point as a node.
- **Taft's 45 s wait** sits on a crossing *run*: crossing links joined at points off the sidewalk, reaching two sidewalk
  points. OSM's crossing-tagged footways past the curb are crossings too, so a per-link wait would charge some
  crossings twice. The real network has 8 runs, each one link. No gate-to-building walk crosses Taft. (2026-10-21)
- **Known limits of the crossing rule** (from the 4b review; none of these shapes is in the data): a crosswalk ending
  where no sidewalk is drawn gets no wait; one with three or more curb ends (a T) splits 45 s between them; a median
  drawn as sidewalk makes two crossings (90 s). `tests/routing.test.ts` expects exactly 8 waits, so a refresh that
  adds one of these fails there first.
- **Directions (4c, D35) calls Claude made, not the owner** (2026-10-21): a bend under 10° is a wobble in the drawing
  and never joins a merged turn; merging chains (bends each within 15 m of the one before are one turn, however long
  the chain); a merged turn sits at its first junction but is named after the way it ends on; a building names a turn
  by its `short`; a real distance never shows below 5 m, but a step on the same spot as the next shows 0; crossing
  links in a row are one step per street name, and an unnamed one reads "Cross the street"; the bend onto the last
  link into a door is left to the Enter step and never joins a turn.
- **What the real campus gives** (2026-10-21, 190 trips, every gate and full building to every full building): at most
  6 steps on a walk, back-to-back turns at least 16.9 m apart, and no trip crosses Taft (so the cross step is tested on
  fixtures only). OSM draws many jogs a few meters long, so merging matters: near STRC three bends within 13 m are one
  right turn. Only one trip each gets a bare "Bear left" / "Bear right" with no name.

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
