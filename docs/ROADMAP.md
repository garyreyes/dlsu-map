# DLSU 3D Campus Navigator: Roadmap

The build queue: ARCHITECTURE.md §10's 11 phases split into 38 sub-phases, each one `feature-planner` pass. Confirmed
by the owner on 2026-10-19. Who does what is in `docs/SPLIT.md`.

**Status:** `not started` · `in progress` · `done`. When a sub-phase finishes, mark it `done` here in the same PR
that adds its `docs/CHANGES.md` entry, so the two files never drift apart.

**Marks:**

- 🧪 = correctness-critical: write the failing test first; done means the test was run and seen passing.
- ↺ = moved from the order in ARCHITECTURE.md §10 because of a real dependency in `docs/user-flows.md` §8.
- **Lane** A or B: see `docs/SPLIT.md`.

**Impeccable cadence:** every sub-phase that adds or changes UI ends with `/impeccable audit`. Every phase marked
▸ ends with `/impeccable critique` then `/impeccable polish` across that phase's screens together. The last phase ends
with a full-app polish.

## Gate 0: before any app code

| Item | Status |
|---|---|
| Team approves the plan (CLAUDE.md: no app code until then) | done (2026-10-19) |
| D15–D24 move from *proposed* to agreed in `docs/DECISIONS.md` | done (2026-10-19) |
| Lanes in `docs/SPLIT.md` agreed (A Gary, B Charles) | done (2026-10-19) |
| Branch protection on `main` (D22): PR required, `gates` required, no force-push or deletion | done (2026-10-19) |
| GitHub CLI installed and signed in on both laptops (`winget install GitHub.cli`, `gh auth login`) | done (2026-10-19) |
| Free Cloudflare account created (Gary, repo owner) and its token + account id saved as GitHub Actions secrets | done (2026-10-19) |

## Phase 1: Skeleton ▸

| ID | Sub-phase | Lane | Depends on | Status |
|---|---|---|---|---|
| 1a | Project scaffold: Vite + React ~19.3 + TS (tsc 7 / TS 6 API, D1), the ARCHITECTURE §7 folders, ESLint + Prettier, Vitest, `lint`/`typecheck`/`test`/`build` scripts, Husky + lint-staged, Dependabot npm block | A | Gate 0 | done |
| 1b | Hosting: Cloudflare Workers static assets, a preview link per PR, CSP + security headers in `_headers`, `noindex` + disallow-all `robots.txt` (D19), Playwright test that fails on any request to another site | A | 1a | done |
| 1c | App shell: R3F canvas with the prototype's gestures (pan, pinch, twist, tilt, compass); search bar, sheet and map buttons from DESIGN.md tokens; fix DESIGN.md's open items (16 px text, 48 px tap targets) | A | 1a | done |
| 1d | Basic offline: precache with `globPatterns` widened to `.json/.woff2/.glb` + a CI check, "Ready offline" (O2), "Open this once with internet" (O1) | A | 1a | done |
| 1▸ | Impeccable critique + polish (Phase 1) | A | 1a–1d | done |

## Phase 2: Outdoor campus ▸

| ID | Sub-phase | Lane | Depends on | Status |
|---|---|---|---|---|
| 2a | `scripts/fetch-osm.ts`: pinned OSM snapshot committed to `data-src/campus/osm/`, plus the Zod schemas in `shared/data` | B | 1a | done |
| 2b | Data compiler v1: `data-src` → `public/data/campus.json` + buildings (full vs block tier), compile report 🧪 | B | 2a | done |
| 2c | Massing-model scene from DESIGN.md (black ground, green haze, see-through city, labels), tap a building for its card (S3b); settle D13's palette on real phones outdoors and remove the palette switch | A | 1c, 2b | in progress |
| 2▸ | Impeccable critique + polish (Phase 2) | A | 2a–2c | not started |

## Phase 3: Rooms + search ▸

| ID | Sub-phase | Lane | Depends on | Status |
|---|---|---|---|---|
| 3a | Room-code parser: prefixes, aliases (`C`→`ST`, `VE`→`VL`), format variants, floor = number ÷ 100, combined entries (D18) 🧪 | B | 1a | done |
| 3b | STRC room list typed from the lobby directory → `rooms.json`; build fails on duplicate codes; floor labels 🧪 | B | 2b, 3a | done |
| 3c | Search screen (S2): strict matching, "Did you mean" (uFuzzy), Recent, building matches | A | 1c, 3a | not started |
| 3d | Room card (S3) with the floor band and floor chip; share link `?to=` and opening it 🧪 | A | 2c, 3b, 3c | not started |
| 3▸ | Impeccable critique + polish (Phase 3) | A | 3a–3d | not started |

## Phase 4: Outdoor routing

| ID | Sub-phase | Lane | Depends on | Status |
|---|---|---|---|---|
| 4a | Walkway graph: OSM paths, entrances (with `verified`), gates, street crossings; build fails if a room can't be reached 🧪 | B | 2b | done |
| 4b | Routing: A* (ngraph) plus Stairs / Elevator / Auto costs 🧪 | B | 4a | done |
| 4c | Direction text: turn angles, landmarks, crossings, "ST311 is on 3F" 🧪 | B | 4b | done |

## Phase 5: "Where are you?" + route player ▸

| ID | Sub-phase | Lane | Depends on | Status |
|---|---|---|---|---|
| 5a | Where are you (S4): type a room (D23), building list + map tap, floor chips, Change spot, I'm outside | A | 3c | not started |
| 5b | Route preview (S5): From → To chips, route options, the route line on the map | A | 4b, 5a | not started |
| 5c | ↺ All-steps list (S8), which is also the text-only mode (S11); built before the 3D player | A | 4c | not started |
| 5d | Step player (S6): Next/Back, camera follow, X, "Change where I am", Arrived (S9), Find next room | A | 5b, 5c | not started |
| 5▸ | Impeccable critique + polish (Phase 5) | A | 5a–5d | not started |

## Phase 6: Floor pipeline

| ID | Sub-phase | Lane | Depends on | Status |
|---|---|---|---|---|
| 6a | `tools/floor-extract` built properly from the spike: corners, colour split, wall merge | B | 1a | done |
| 6b | Verification spike, then the fit onto OSM outlines (ARCHITECTURE §4 step 4, unproven) | B | 2a, 6a | done |
| 6c | ↺ Floor builder (walls from a floor file), moved up from Phase 7 so the floor preview works | A | 2c | done |
| 6d | Dev-only floor preview (P1) + the `checked: true` step; STRC end to end, all 4 floors | B | 6b, 6c | in progress |

## Phase 7: Indoor view ▸

| ID | Sub-phase | Lane | Depends on | Status |
|---|---|---|---|---|
| 7a | Cutaway: split the entered building out of the merged mesh, clipping slice, floor rail | A | 6c | not started |
| 7b | Automatic outdoor ↔ indoor switch at entrances; enter animation (a cut under reduced motion) | A | 7a | not started |
| 7▸ | Impeccable critique + polish (Phase 7); extend DESIGN.md with the indoor materials | A | 7a–7b | not started |

## Phase 8: Indoor routing ▸

| ID | Sub-phase | Lane | Depends on | Status |
|---|---|---|---|---|
| 8a | Hallways, doors, stairs and elevators (`servesFloors`), bridges; build checks: door within 3 m of a hallway, valid floors, every room reachable 🧪 | B | 6d | not started |
| 8b | Join indoor and outdoor at entrances; Stairs / Elevator / Auto across floors; indoor direction text 🧪 | B | 4c, 8a | not started |
| 8c | Indoor steps (S7) in the player; "indoor map coming" (O5); "(approximate)" (O6) | A | 5d, 7b, 8b | not started |
| 8▸ | Impeccable critique + polish (Phase 8) | A | 8a–8c | not started |

## Phase 9: Data rollout (alongside Phases 6–8, with the `floor-extract` skill)

Each building: lobby directory → `data-src/rooms/<building>.csv`, every floor extracted and cleaned up, then the
owner checks it in the floor preview and marks it `checked: true`.

| ID | Sub-phase | Lane | Depends on | Status |
|---|---|---|---|---|
| 9a | Andrew (20 floors) | B | 6d | not started |
| 9b | Gokongwei, Velasco, St. Miguel | B | 6d | not started |
| 9c | Yuchengco, St. Joseph, St. La Salle | B | 6d | not started |
| 9d | Razon, Mutien-Marie | B | 6d | not started |

## Phase 10: Offline polish → private beta ▸

| ID | Sub-phase | Lane | Depends on | Status |
|---|---|---|---|---|
| 10a | Offline hardening: update prompt (O4, never mid-route), `storage.persist`, cleared-storage state (O3), iOS hint; left over from 1d: web app manifest + icons, O2's percentage (needs our own service worker), "Ready offline" in a second tab open during a first save; airplane-mode and week-unused tests on iPhone and Android | A | 1d, 5d | not started |
| 10b | ⓘ sheet (S10): Report a problem via the pre-filled Google Form (D24; the team creates the form), credits, beta label, version | A | 1c | not started |
| 10c | Performance + accessibility: quality tiers, reduced motion, WCAG AA over the map | A | 8c | not started |
| 10d | Private beta: unlisted link, `noindex` checked, testers invited | A | 10a–10c, 9a–9d | not started |
| 10▸ | Impeccable critique + polish (Phase 10) | A | 10a–10c | not started |

## Phase 11: On-site check, Facilities, public launch

| ID | Sub-phase | Lane | Depends on | Status |
|---|---|---|---|---|
| 11a | On-site checks: entrances and stairs verified, every directory compared against its evacuation maps, PRD §5 success tests (20-room set, 10 s, airplane mode) | B | 10d | not started |
| 11b | Facilities' approval; the coverage gate (the launch build turns tier warnings into failures) | B | 11a | not started |
| 11c | Public launch: remove `noindex`, full-app `/impeccable polish`, README via `readme-writer` | A | 11b | not started |

## Notes

- **Visual system:** Phase 2 settles D13's palette, which changes only the map's colours; the interface tokens are
  fixed in DESIGN.md, so Phase 1's screens stay valid. Phase 7 adds indoor materials without changing existing
  tokens. A dark interface (Waze-style night mode) is not planned; if it is added, re-run `/impeccable polish` on
  every earlier phase.
- **Not on this roadmap:** GPS (D14) and everything in PRD §4 "Later".
- **The prototype** (`prototypes/map-home/`) is a reference for look and gestures, not code to copy: it loads
  three.js from a CDN, which the real app must not do.
