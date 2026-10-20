# Changes

What changed and when, newest first. One entry per finished change: the date, what changed, and anything a later
session needs to know. Search this file; it isn't required reading (the reading order is in `CLAUDE.md`).

**Archive policy:** once this file passes about 1,000 lines, move the oldest entries into
`docs/CHANGES-archive-<first date>-to-<last date>.md` and keep this file recent.

---

## 2026-10-20: 1c app shell (3D map, gestures, search pill, sheet)

- **Map** (`features/campus-scene`): a full-screen R3F canvas with the bare ground, green haze and lights from
  DESIGN.md (palette A); buildings come in 2c. drei `CameraControls` give one-finger pan and pinch zoom toward the
  fingers; a custom two-finger twist turns the map and two fingers dragged up or down tilt it. The compass appears
  past 4° and turns back the short way; recenter flies home. The camera frames the area between the pill and the
  sheet. The 3D code is a lazy chunk, so the pill and sheet work before three.js loads (user-flows §3.2).
- **Chrome:** the 52px search pill with the Beta tag, 48px map buttons, the OSM credit, and the sheet at peek with
  "Type a room, like ST311" (a 400px left panel from 768px). Tapping either opens the full-screen search frame;
  results come in 3c. Back, Escape and the back arrow close it, and it's modal (background inert, focus restored).
- **States:** "Loading the campus…", and "The map couldn't load" when WebGL is missing, the scene throws, or the
  map's chunk fails to download (the pill and sheet stay usable). Reduced motion turns flights and the sheet into
  cuts. Light interface only (owner's choice).
- **D30 (proposed):** reading text is 16px or more and taps 48px or more; only the Beta tag and the credit stay at
  14px. DESIGN.md's type scale, chips, secondary button and segments are updated, and the map haze and sun colours
  joined its tokens.
- **Tests:** the gesture maths test-first (35 cases, run red against a stub). The reviewer found that two-finger tilt
  could never fire on a phone, because pointer events move one finger at a time; a tracker now waits for both
  fingers, with tests fed one finger at a time. New e2e tests cover no-WebGL, Back, Escape, double taps and the modal
  search; the 1b off-site test now runs with the 3D map on screen. 12 e2e and 328 unit tests pass.
- **`/impeccable audit`:** both detector passes (source and the live page) are clean, and every text colour passes
  WCAG AA (lowest 5.37:1, the Beta tag). It found the "Student project, not an official DLSU app" line missing from
  the shell (PRODUCT.md, ARCHITECTURE §8): it now sits under the hint. Also fixed: no grab bar while the sheet can't be
  dragged, and the OSM link's tap area reaches 48px. Open: the map can't be panned by keyboard (S11 text-only mode,
  5c, is that path), and the 3D chunk is 962 kB (owner to decide on a size budget).
- **Check on a real phone (preview link):** twist and tilt feel, pinch-zoom landing under the fingers with the view
  offset, and the sheet's safe area on iPhone.

## 2026-10-20: Campus loader for the 1c shell

- `loadCampus()` (`src/shared/data/load.ts`) fetches `/data/campus.json` and returns `{ ok: true, data }` or
  `{ ok: false, reason }`. It never throws, so the shell can show "The map couldn't load" instead of a half-drawn map.
- Reasons: `offline` (no answer), `http` (error status), `not-json` (the content type isn't `application/json`, which
  catches Cloudflare's 200 `index.html` fallback for a missing file), `invalid` (broken JSON or a schema failure).
  Written test-first: 7 of 8 tests failed against a stub, then all passed. The reviewer pass found no blocker; it
  added a case-insensitive content type, `BASE_URL` in the path and a test for a fetch that throws at once (10 tests).
  `rooms.json` (3c) reuses the same path.

## 2026-10-20: App-shell tools for 1c

- Added the ARCHITECTURE §2 packages 1c needs, in their own PR (SPLIT.md): `three` 0.186, `@react-three/fiber` 9.8,
  `@react-three/drei` 10.7 and `@types/three`; `tailwindcss` 4 with `@tailwindcss/vite`; `react-modal-sheet` with its
  `motion` peer, held at 12 (see PROJECT_FACTS); `zustand` 5; `lucide-react` 1.52 for icons (its 2 px round-cap
  line icons match DESIGN.md). Nothing uses them yet.
- The 3D stack is pinned to patch updates (`~`), and R3F 9.8 accepts React `>=19 <19.4`, so D3's pin still holds.
  `npm ls --all` passes and `npm audit --omit=dev` is clean. The dev-only audit warnings are the known ones
  (`PROJECT_FACTS.md`).
- 1c is marked `in progress` in `docs/ROADMAP.md`. The campus loader and the shell follow in their own PRs.

## 2026-10-20: 6a floor-extract tool

- `tools/floor-extract/` replaces the spike (dev-only, never shipped): `npm run floor-extract -- crop <photo> <x,y>…`
  writes zoomed, gridded crops to read the 4 corners; `… extract <photo> <tl> <tr> <br> <bl>` straightens the plan,
  splits colours, finds walls (double lines merged) and the route, and writes an overlay, a 3D preview and
  `draft.json` (0–1 plan coordinates) to `tools/floor-extract/out/`, gitignored like the photos.
- No OpenCV (D29, proposed): homography warp, long runs and blobs are plain TypeScript, written test-first on
  hand-drawn images (64 tests). Only `sharp` was added, pinned at 0.35.5 (already in the tree through wrangler).
- **Two map styles** (STRC's green signs; the white template with a red route everywhere else): detected from the
  paper, ink judged against the paper around it so glare and shadow don't hide walls. Checked by eye on STRC 4F and
  2F, St. Joseph 3F and St. Miguel 3F (124, 101, 131 and 510 walls; 0.4–1.9 s each).
- The reviewer found no silent-wrong output in the maths; its fixes (output paths with `#` or `%`, dark edges of the
  red route read as walls, a faster merge search, grid sampling for style detection) are in, with a test where one
  applies. Official DLSU plans aren't guaranteed, so this is the main path for floors (PROJECT_FACTS).

## 2026-10-20: 3b STRC room list → rooms.json

- `data-src/rooms/strc.csv`: STRC's lobby directory typed row by row, **62 rooms** (G 13, 2F 19, 3F 18, 4F 12),
  counted by hand on the photo and checked again by the reviewer. Owner's calls: the 4th-floor "Stock Room · C302"
  is C402; `C102/104-106` is 102, 104 and 106; obvious spelling fixed, each fix in the `note` column.
- `scripts/compile/rooms.ts` (test-first, red against a stub): a small CSV reader (quotes, CRLF, Excel's byte-order
  mark, real line numbers in errors), combined entries expanded (D18), codes made canonical by the real
  `parseRoomCode` (C → ST in one place), sorted by prefix then number. The build fails on a code used twice, another
  building's prefix, a floor the building lacks, a floor off number ÷ 100 without `floor_checked` (D26), a row that
  isn't a code, or a bad header.
- `npm run compile-data` now also writes `public/data/rooms.json` (5 KB), and writes neither file if either has
  errors. `tests/compile-rooms.test.ts` pins the real counts and 13 rooms by exact value.
- `tsconfig.node.json` maps `@/*`, so the compiler can typecheck the parser (type imports only).
- The reviewer found no mismatch with the photo and no silent drop; its smaller findings (line numbers after blank
  lines, the BOM, header spaces, one error per row, numeric sort, error noise when the campus fails) are fixed with
  tests. 336 tests.

## 2026-10-20: Rooms data shape agreed before 3b

- Added `src/shared/data/rooms.ts`: the Zod schema for `public/data/rooms.json`, the meeting point between the 3b
  compiler and search and the room card (3c, 3d). Each room: canonical `code`, `building`, `floor` (1 = ground),
  `name`, and `floorLabel` only where a room's floor reads differently from its building's labels, such as
  Velasco's "G Mezz" (D26). An array, so a duplicate code is rejected instead of silently dropped by `JSON.parse`.
- `rooms.sample.json` and 14 tests. Whether a prefix is the canonical one (`ST`, not `C`) needs the prefix table, so
  the compiler checks that. Room positions join with the floor files (6d), additively.

## 2026-10-20: 2b data compiler v1

- `npm run compile-data` (`scripts/compile-data.ts`) turns `data-src/campus/buildings.json` and the OSM snapshot into
  `public/data/campus.json` (117 KB): 16 buildings (33 volumes), 4 skybridges, 2 campus rings, 937 city blocks within
  300 m, 266 paths including the LRT. It prints a compile report and fails, writing nothing, on any error. `dev` and
  `build` run it first; `public/data/*.json` is gitignored.
- Rules, all in pure modules under `scripts/compile/`, written test-first (red against stubs, then green):
  - WGS84 projection to meters, **y north** (`src/shared/geo/project.ts`), checked against degree lengths by hand.
  - Heights: `height` wins, else levels × 3.4 m; base from `min_height` or `min_level`; 9 m when OSM has none. A
    height tag it can't read is an error on campus and a note in the city.
  - A building is its outline **plus** its OSM parts (parts cover only 0–54% of footprints here). Connector parts
    reaching out of a building go to the one holding their corners, with a note.
  - Bridges touching a listed building (edges meeting counts); boundary rings holding a listed building; city blocks
    with no base, so raised ones are skipped; paths cut at the edge, never with a repeated point.
  - Build errors: shared prefixes or suggest prefixes (ARCHITECTURE §3.4), an OSM id missing from the snapshot, a
    building with no level count, an unreadable height, a file the schema rejects.
- The prefix table now comes only from `buildings.json`: `toPrefixTable` (`src/shared/data/prefix-table.ts`) builds it
  from `campus.json` for search (3c). `shared/config/room-prefixes.ts` is gone; the parser tests keep their own copy,
  and `tests/compile-data.test.ts` checks the real data gives exactly that table.
- The reviewer pass found no blocker and 7 silent-wrong cases (concave/connector parts dropped to the city, unread
  heights guessed, edge-only bridges, degenerate clipped pieces, unnoted areas, multi-ring parts, double ownership).
  All fixed with tests. 269 tests.

## 2026-10-20: Rail path kind in the campus shape (before 2b)

- `campus.json` paths gain `kind: 'rail'` for the LRT Line 1 viaduct over Taft Avenue, the campus's strongest
  landmark from above (PLAN §5). Drawn, never walked. Additive, so 2c isn't blocked. The sample has a real stretch
  of the line beside the campus, and a test checks it survives parsing. The 2b compiler emits it, cut at the map's edge.

## 2026-10-20: 2a OSM snapshot and building list

- `npm run fetch-osm` (`scripts/fetch-osm.ts`) downloads the campus area from the OSM main API, refetches any relation
  the area cut short, and writes `data-src/campus/osm/snapshot-2026-10-20.geojson`: 1,397 features (all 16 buildings,
  the campus boundary, 266 streets and paths, 53 gates, 27 entrances, 14 elevators, 48 crossings, 4 skybridges).
  Run by hand only. Overpass was down both days, so D27 switches to the main API. Gary agreed
  D25, D26 and D27 in his review of #11; they are marked agreed and added to `SUMMARY.md` and `docs/PLAN.md`.
- `scripts/osm-to-geojson.ts`: our own converter, written test-first (36 cases, real extracts in `scripts/fixtures/`,
  red against a stub first). Keeps only what the map uses; reports anything it can't convert instead of guessing.
- A reviewer pass found no wrong shape in today's data, but six inputs the converter would have drawn wrong in
  silence. All are now reported or handled, with tests: figure-8 rings, a hole in nested outlines (now the innermost),
  repeated or oddly-roled members, zero-area rings, highway multipolygons. The script got a 60 s timeout, a Manila
  date and sorted output.
- `data-src/campus/buildings.json` (16 buildings: slug, OSM ids, names and aliases from signs or OSM, tier, prefixes,
  `suggestPrefixes`, floor labels seen on signs) with its Zod schema in `src/shared/data/buildings.ts`, checked
  against the snapshot by `tests/data-src.test.ts`. `data-src/LICENSE` (ODbL), as D4 requires; it leaves out
  `data-src/floors/` (not ours to license yet, D21), matching `ATTRIBUTION.md`.

## 2026-10-20: Campus data shape agreed before 2a

- Added `src/shared/data/campus.ts`: the Zod schema and types for `public/data/campus.json`, the SPLIT.md meeting
  point between the compiler (2b) and the scene (2c). Based on the prototype's `campus.json`, with city blocks
  split out of `buildings` (never tappable), the `campus` tier renamed `block`, building parts as `volumes`, and an
  `origin` so meters can be turned back into lon/lat. Gates, entrances and walkways join later (4a), additively.
- `campus.sample.json` for building 2c now: real pieces (STRC, Henry Sy, Bloemen, a skybridge, a ring, paths)
  projected from the 2a snapshot by the 2b compiler. **y is meters north.** An earlier copy came from the prototype,
  which stored y as meters south (three.js z) and sat about 21 m west, so it was mirrored against this schema. 21
  tests: the sample passes and each kind of broken file is rejected. Added `zod` 4 (in the ARCHITECTURE §2 stack).
- From Gary's review: buildings also carry `aliases`, `suggestPrefixes` (D25) and `floorLabels`, the same rules as
  `buildings.json`, so search (3c) and the room card (3d) read them from `campus.json` instead of keeping their own
  copy. "G Mezz" (D26) stays out: it belongs in the `rooms.json` shape (3b), since floor-label keys are whole numbers.

## 2026-10-20: 1b hosting (Cloudflare previews, headers, robots, off-site test)

- `wrangler.jsonc`: Cloudflare Workers static assets serving `dist/` with the single-page fallback (D5). Production
  stays dark (`workers_dev: false`) and each PR gets `https://pr-<n>-dlsu-map.gary-reyes.workers.dev` (D28,
  proposed). The owner creates the Worker once by hand (`wrangler deploy`, no URL published); CI only uploads
  previews.
- `public/_headers`: D5's CSP, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (no camera, mic or location) and
  `X-Robots-Tag: noindex`. `public/robots.txt` disallows every crawler (D19).
- `tests/e2e/hosting.spec.ts` (Playwright, Pixel 7 profile) against `wrangler dev`: exact headers on `/` and on a
  deep link, `robots.txt`, `/_headers` not served, and nothing loaded from another site with no CSP violation.
  Written test-first: 3 of 6 failed before `_headers` and `robots.txt` existed, then all passed. Two self-checks
  prove each half of the guard can fail (a CSP-blocked `fetch`, and an off-site navigation only the request block
  sees), and an injected CDN image was seen to fail the test. Gaps for 1d (service worker) and 2c (late loads) are
  noted in the test.
- CI: `gates` now installs Chromium and runs `npm run e2e` after the build (same job name, D22). A new `preview` job
  (not required) uploads the preview after `gates` passes on same-repo code PRs and posts the link as one PR comment
  that it edits on each push. The token is only in the upload step; fork and Dependabot PRs skip it.
- New `tsconfig.e2e.json` gives the e2e tests DOM types without giving them to Node scripts.
- Found while checking (PROJECT_FACTS "Cloudflare"): a missing `/data/*.json` returns `index.html` with status 200,
  so `shared/data` must check the content type.

## 2026-10-20: Root MIT license and attribution (D4)

- Added the root `LICENSE` (MIT, code) and `ATTRIBUTION.md` (which license covers what, plus the OSM credit),
  both called for by D4 but missing. `data-src/LICENSE` (ODbL) arrives with 2a (#12). README links both.
- OSM-derived files outside `data-src/` (the prototype's `campus.json`, `*.sample.json`, `scripts/fixtures/`) are
  ODbL, not MIT. The floor plans in `data-src/floors/` aren't licensed yet (D21).

## 2026-10-20: Hosting tools for 1b (`wrangler`, Playwright)

- Added `wrangler@4.149.0` and `@playwright/test@1.63.0` as exact-pinned devDependencies, in their own PR so the
  lockfile change doesn't collide with other branches (SPLIT.md). Nothing uses them yet; `1b-hosting` does.
- `npm ls --all` passes. `npm audit --omit=dev` is still clean; the dev-only warnings are the same
  `markdownlint-cli2` chain as before (wrangler 4.149.0 avoids a `sharp` advisory, see PROJECT_FACTS).

## 2026-10-20: Dependabot skips major `@types/node` bumps

- `@types/node` must match the Node we run (24, in `.nvmrc` and CI), so Dependabot now ignores its major updates;
  patch and minor still come through. Closed #8 (24 → 26). Bump `.nvmrc`, the CI Node version and `@types/node`
  together in one PR when Node moves.

## 2026-10-20: 3a room-code parser

- `parseRoomCode(typed, table)` in `src/features/search/parse-room-code.ts`, exported from the feature's
  `index.ts`. Pure, and it never checks `rooms.json` (3c does). The prefix table is a temporary constant in
  `src/shared/config/room-prefixes.ts` until 2b reads it from `buildings.json`.
- Written test-first: 80 cases, all `toStrictEqual` on exact results, run red against a stub (57 failed), then
  green. One test proves all five result kinds are reachable.
- A reviewer pass found no wrong-room parse, but four loose spots, all fixed with tests. Leading zeros are now
  rejected (`ST0311`). A tail after a dash or slash must look like a combined entry, so `ST311-lab` and `ST311-A`
  are no longer read as `ST311`. Forms printed on the signs (`J-602A/B`, `VH-208A&B`, `101A-101B`) still parse.
  Phone input is normalized (en dash, full-width, zero-width space). An accepted prefix beats a suggest-only one.
- ARCHITECTURE §3.4: suggest prefixes count in the 2b compiler's prefix-uniqueness check.

## 2026-10-20: Room-code result shape agreed before 3a

- Added `src/shared/data/room-code.ts`: the parser's result type, five kinds (`code`, `suggest`, `unknown-prefix`,
  `no-prefix`, `not-a-code`), plus the prefix-table type and the parser's signature. `room-code.sample.ts` has one
  sample per kind so 3c/3d can start before the parser lands. This is the SPLIT.md meeting point for room codes.
- Proposed D25 (`VH` and `J` from the Velasco and St. Joseph signs are suggested, never accepted) and D26 (a room's
  floor is where its directory row or map puts it; number ÷ 100 is only a guess, for mezzanines). ARCHITECTURE §3.3
  and §3.4 and the S2 table in `docs/user-flows.md` updated to match.

## 2026-10-19: 1a project scaffold

- Vite 8 + React 19.3.1 (`~19.3.1`, D3) + TypeScript per D1, with skeleton-only dependencies: each later sub-phase
  adds what it uses in its own PR (decided in 1a). `npm ls --all` is clean.
- Scripts CI calls: `lint` (ESLint 10 `strictTypeChecked` + react-hooks, Prettier check, markdownlint), `typecheck`
  (tsc 7 by full path; new CI step fails unless it's 7.x), `test` (Vitest), `build` (`vite build`; the data compiler
  joins in 2b).
- ARCHITECTURE §6 layer rules are now lint errors (`eslint.boundaries.js`, built-in rules only, decided in 1a), proven
  by 50 cases in `tests/boundaries.test.ts`. A reviewer pass found gaps (dynamic `import()`, the app shell, other
  feature subfolders, `..` inside `@/` paths, WebSocket/EventSource/sendBeacon); all closed with tests.
- The ARCHITECTURE §7 folder tree (`.gitkeep` placeholders), a placeholder page with `noindex`, Husky + lint-staged,
  Dependabot's npm block, `.gitattributes` (LF everywhere), `.vscode/settings.json` (workspace TypeScript, D1).
- D1 corrected: `@typescript/typescript6` stops at 6.0.2 (it contains compiler 6.0.3), so `^6.0.3` couldn't install.

## 2026-10-19: Gate 0 done (gh, Cloudflare)

- `gh` checked on Gary's laptop (2.96.0, signed in, admin on the repo).
- Free Cloudflare account created. `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` saved as GitHub Actions
  secrets. The first try put the token in the secret's name field; that secret was deleted and the token rolled.
- The token is only proven by the first deploy in 1b. Next: 1a scaffold (Lane A).

## 2026-10-19: Plan approved (Gate 0)

- The team approved the plan. D15–D24 are now *agreed* in `docs/DECISIONS.md`; D14 (GPS) stays proposed because
  GPS moved out of v1.
- The lanes in `docs/SPLIT.md` are agreed: Lane A Gary, Lane B Charles.
- `CLAUDE.md` status now says the build follows `docs/ROADMAP.md` from 1a. `docs/PLAN.md` got a status note pointing
  to the current docs; `SUMMARY.md` was rewritten in the entry below (PR #4).
- GitHub CLI installed on Charles's laptop. Gate 0 still open: `gh` on Gary's laptop, the Cloudflare account and
  secrets.

## 2026-10-19: SUMMARY and README brought up to date

- `SUMMARY.md` rewritten to match the PRD, ARCHITECTURE and D15–D24: v1 includes 10 full interiors, plain From / To
  fields (no sentence parser), no GPS in v1, real room-code formats (`ST311`, `AG1104`) instead of `B305`/`G304`, the
  Google-Maps-style interface and black map ground, the 11-phase roadmap and the two lanes.
- `README.md`: status, a reading order that includes the PRD, ARCHITECTURE, user flows, roadmap and split, and a short
  contributing note about the protected `main`.

## 2026-10-19: Roadmap and work split

- Added `docs/ROADMAP.md`: ARCHITECTURE §10's 11 phases split into 38 sub-phases with a lane, dependencies and
  status each, plus Gate 0 and the Impeccable cadence. Two reorders from `docs/user-flows.md` §8: the steps list
  before the 3D player (5c), and the floor builder moved up to Phase 6 (6c).
- Added `docs/SPLIT.md`: two lanes (A: platform, screens, 3D; B: data, logic, campus), folder ownership, the five
  points where the lanes meet, the order of work side by side, and working rules. Lane names are proposed.
- Branch protection is on (ruleset on `main`), earlier than D22 planned. `CLAUDE.md`, D22 and
  `docs/PROJECT_FACTS.md` updated to match.

## 2026-10-19: Prototype feedback, round 1 (owner tested on a phone)

- Green fog: the distance and sky fade into a soft green in every map palette.
- Every off-campus building is see-through (35%), replacing "see-through only while blocking". Only campus buildings
  can now hide the selection.
- Rotating on a phone: the map library only rotated when two fingers slid sideways together. A two-finger twist now
  turns the map with the fingers, like Google Maps (checked with a simulated twist: 60° in, 59.9° turned). A compass
  button appears while the map is turned and turns it back.
- `docs/DESIGN.md` updated (map depth, compass, gestures). No new finish review: these are owner-directed refinements.
- Owner confirmed all three on a real phone. Then asked for a black ground like Waze's dark mode: palette A is now
  near-black (#121614) with soft grey paths and a dark green haze, replacing D13's orange. Green and grey stay in
  the switcher for comparison. Recorded in `docs/PRODUCT.md` and `docs/DESIGN.md`.

## 2026-10-19: Design direction and map home prototype

- The owner pinned the direction: the Google Maps interface convention (quality bar Google Maps, Apple Maps, Waze)
  over the D13 massing-model map, with a fixed green interface colour. Impeccable's random direction pick was skipped
  because the direction was pinned; recorded in the surface brief.
- Added `prototypes/map-home/`: a phone-testable prototype of S1–S5 (search, room card, Where are you, route
  summary) on the real campus from an OpenStreetMap snapshot (2026-10-19). Signature move: the found room's floor
  drawn as a green band one storey tall, with a floor chip. Only ST311, ST402, ST404 and ST406 are real rooms.
  Not app code: three.js loads from a CDN here, which the real app must not do.
- Finish review took four rounds (8 fixes, then 3 and 2 regressions); final disposition **ship** for the scored
  fixes. Not reviewed: motion (every capture had reduced motion on), a night map, label style.
- Added `docs/DESIGN.md` and `.impeccable/design.json` (written from the built prototype), the surface brief in
  `.impeccable/surfaces/`, and two detector ignores for confirmed false positives in `.impeccable/config.json`.
- `docs/PRODUCT.md` gained two owner commitments: the Google Maps convention and the green interface.
- Published privately: <https://claude.ai/artifact/VXTeRoikyZv1bwGHotiSPo>.

## 2026-10-19: Product context for design (`/impeccable init`)

- Added `docs/PRODUCT.md`, translated from the PRD. Impeccable finds it in `docs/`, so the root stays clean. No
  Stack section (ARCHITECTURE owns it).
- New facts from init: platform `web`; the app's own words are plain English; "DLSU 3D Campus Navigator" is a
  working name; no DLSU seal, logo or official marks anywhere.
- D13's massing-model look is recorded as a decided commitment; the palette stays open for the design step.

## 2026-10-19: User flows mapped

- Added `docs/user-flows.md`: 11 screens, 6 system states and 1 dev-only page. Each screen has its one primary
  action, its transitions and its empty, loading and error states, with Mermaid diagrams for the branching flows.
- New proposed decisions: D23 (From can be typed as a room code) and D24 (beta reports via a pre-filled Google Form,
  never including From). The PRD's UC1, UC2, UC6 and the §8 Must row were updated to match.
- `CLAUDE.md` reading order now includes `docs/user-flows.md`. It supersedes `docs/PLAN.md` §6.2.

## 2026-10-19: Harness setup (CI gate, safety rules, project docs)

- Added `.github/workflows/ci.yml`: one job, `gates`, on every PR and every push to `main`. Markdown lint always runs.
  Lint, type-check, test, build and the Impeccable design detector run only when code changed and
  `package-lock.json` exists, so today only markdown lint runs (D22).
- Added `.markdownlint-cli2.jsonc` (120-column wrap; `HANDOVER.md` is frozen and excluded) and fixed the existing
  docs to pass it. The fixes are only code-fence languages, blank lines, and one wrapped line. No content changed.
- Added `.github/dependabot.yml` for GitHub Actions. The npm block is written but commented out until Phase 1.
- Rewrote `CLAUDE.md`: reading order, never-do list, ask-first list, merge/push rule, security, layer rules, gates.
  It now points at PRD and ARCHITECTURE for the v1 scope (GPS moved to later) and the real prefix table.
- Added this file and `docs/PROJECT_FACTS.md`.
- Verified locally: actionlint passes on the workflow; the change-detection rule classifies 10 sample cases
  correctly; a deliberately broken doc fails markdown lint (exit 1); a sample page with gradient text and a purple
  glow fails the detector (exit 2, 7 findings).
- First CI run on GitHub passed (PR #2). Merged to `main` as a fast-forward.
- **Deferred:** branch protection on `main` moves to the start of Phase 1 (D22). It needs the repo owner's account.
