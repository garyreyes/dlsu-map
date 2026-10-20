# Changes

What changed and when, newest first. One entry per finished change: the date, what changed, and anything a later
session needs to know. Search this file; it isn't required reading (the reading order is in `CLAUDE.md`).

**Archive policy:** once this file passes about 1,000 lines, move the oldest entries into
`docs/CHANGES-archive-<first date>-to-<last date>.md` and keep this file recent.

---

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
