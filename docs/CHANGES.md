# Changes

What changed and when, newest first. One entry per finished change: the date, what changed, and anything a later
session needs to know. Search this file; it isn't required reading (the reading order is in `CLAUDE.md`).

**Archive policy:** once this file passes about 1,000 lines, move the oldest entries into
`docs/CHANGES-archive-<first date>-to-<last date>.md` and keep this file recent.

---

## 2026-10-21: 6d STRC floors cleaned up

- All 4 STRC floor files cleaned up against their photos (now 128, 106, 91 and 97 walls): stair treads and stringers
  deleted (stairs come back as their own thing in 8a), outer walls closed on both ends, the second line of double
  outer walls dropped, light-grey walls the extraction missed added (room dividers, hallway walls along 108–112,
  411–414), lift shafts boxed in. 4F's route also had boxes around its exit signs, so it is redrawn as the hallway
  line plus one branch to each stair.
- Outline gap, 90th percentile: 1F 1.7 → 0.5 m; 2F–4F 0.5–0.6 m. No floor is flagged any more. Still
  `checked: false`: the owner checks them in the dev preview (P1), which needs Lane A's 6c.
- The ground-floor sign shows 102 as its own room, apart from 104/106, as the owner found at the doors.

## 2026-10-21: 6c, the floor builder

- `loadIndoor(slug)` in `src/shared/data/load.ts` loads `data/buildings/<slug>.json` and checks it against
  `indoorSchema`, with the same four failure reasons as `loadCampus`. A slug that couldn't be a building is `invalid`
  without a request, and so is a file for another building.
- `features/indoor-view` builds one floor in the campus frame: each wall segment is a 0.2 m thick box from the floor's
  base to base + height (D37, proposed), and hallway lines lie flat 2 cm above the base. Wall lines with more than two
  points give one box per segment. Lane B's floor preview (6d) uses `useIndoor(slug)` and
  `<FloorModel indoor floor palette>` from `@/features/indoor-view`. A floor that isn't traced yet draws nothing.
- `ribbonPositions` moved from `campus-scene` to `src/shared/three/ribbons.ts` so both features draw lines the same
  way.
- Test first: the loader's URL and every failure reason, and the builder's exact heights, thickness, north = -z,
  segment counts, and faces pointing outward (`load.test.ts`, `floor-geometry.test.ts`). The sample's STRC floor
  lands exactly on STRC's outline in the built `campus.json`.
- Not in the student app yet: the cutaway, the floor slab and the floor rail come in 7a.

## 2026-10-21: 6d started: STRC draft floors

- The first floor files: `data-src/floors/strc/01.json`–`04.json`, straight from `floor-extract` (126, 101, 85 and
  124 walls), `checked: false`, `turn: 180` (owner: the guard room is at the Taft end). Not cleaned up yet: stair
  treads still read as walls, some stubs and the 1F east end's outer walls are missing (1F's outline gap is 1.7 m at
  the 90th percentile, so the build notes it). Here now so Lane A's floor builder (6c) can build against real data.
- `public/data/buildings/strc.json` is built from them (12 KB, gitignored). Corners and the turn are in PROJECT_FACTS.
- Left in 6d: cleanup of each floor, the dev-only preview (P1, needs 6c), the owner's check, then `checked: true`.

## 2026-10-21: Squares with holes, duplicate walk links, STRC C102

- **Squares** (`scripts/compile/walk.ts`, follow-up from 4a): a `highway=pedestrian` area drawn as an OSM
  multipolygon was skipped, and a hole in one (a planter, a kiosk) was walked straight through. Now every polygon of
  a square is walked, around each hole's edge too, and a line across must miss every hole: checked at 9 points and
  against each hole edge (`segmentsCross` in `geometry.ts`), so a thin planter still blocks it. Central Plaza is a
  plain polygon, so the real network is unchanged (510 points, 576 links).
- **`campusSchema`** now rejects two links between the same two points: the router would quietly keep only one cost.
  The compiler never wrote one.
- **STRC C102** is back as "Room" (name not known yet, owner): the rooms schema needs a name, and a blank one would
  show an empty room card. STRC has 62 rooms again.
- Tests first: 6 failing, then passing.

## 2026-10-21: 2c part 1, the campus in 3D

- The map now draws the campus from `campus.json` as D13's massing model: every building one pale colour, shaded by
  light, the bottom 6 m of each wall darkened; the city see-through and tinted toward the ground; roads, streets and
  footpaths as thin lines; the LRT viaduct as a deck over Taft. Building names sit on white plates that hide rather
  than overlap and never sit under the pill or sheet; buildings without interiors only get a label when zoomed in.
- Home is worked out from the data: the camera stands square to Taft Avenue on the main campus's side (112° on the
  current snapshot), framing every campus building. The stand-in `HOME_AZIMUTH` and `HOME_DISTANCE` are gone.
- Test first: wall geometry and shading, the triangle → building lookup PR 2 taps through, the home heading, and label
  placement (`features/campus-scene/*.test.ts`).
- Zod's eval probe no longer trips the CSP: `src/shared/data/zod.ts` turns it off before any schema is built, and
  every schema file imports `z` from there (`tests/zod-entry.test.ts` checks). The hosting e2e test now waits for a
  building label, so it covers `campus.json` loading too.
- D13's outdoor test: preview links take `?palette=b` or `?palette=c` (A, black, is the default). The parameter goes
  in part 2, once the palette is picked.
- The OSM credit's bigger tap area works now (a missing space had broken two Tailwind classes).
- The 3D chunk grew from about 960 kB to 1,068 kB (Zod and the scene code moved into it).

## 2026-10-21: Room lists checked at the doors

- The owner checked the doors behind the room-list guesses. STRC: C402 confirmed; C102 dropped, since it is a
  different room from the 104/106 testing lab and its name isn't known yet (61 rooms now). Velasco: 201B added beside
  201A, though the sign leaves it out (72 rooms now); VH-106 is one door. St. Joseph: both calls were right.
- Tests changed first (4 failing), then the CSVs. PROJECT_FACTS "Room lists" updated.

## 2026-10-21: D36 agreed

- Gary and Charles agreed D36 (floors stretched onto the OSM outline, `fit.turn` by hand). Marked agreed in DECISIONS;
  SUMMARY row added.

## 2026-10-21: 6b fit floors onto OSM outlines

- `scripts/compile/fit.ts`: fits a floor file (sign coordinates) onto its building's OSM outline (D36). The outline's
  own 4 corners when it has them (points on a side bending under 5° dropped), else the smallest rectangle around it;
  then `fit.turn`, then a stretch along length and width. Which buildings get which is in PROJECT_FACTS.
- `scripts/compile/indoor.ts`: floor files → `public/data/buildings/<slug>.json` (gitignored, rebuilt each compile),
  each floor on the building volume standing at its height, with a note per floor on how far it sits from the
  outline. Any error fails the build and writes nothing; `compile-data` reads `data-src/floors/*/*.json`.
- Review fixes (tests first): storey height comes from the building's own outline, not a taller part (Connon's
  floor 5 sat 2.7 m too high); a floor with no walls fails the build; so does a `checked: true` floor whose outline
  gap is past 1.5 m, since the outline moved under it. Unchecked floors still only get a note.
- `floor-extract floor <photo>`: turns the extract draft into a first floor file. It never overwrites one, since a
  floor file holds cleanup work. No floor files are committed yet; the first ones come with 6d.

## 2026-10-21: D28–D32 agreed

- The team agreed D28 (preview links only), D29 (floor extraction without OpenCV), D30 (16px text, 48px taps), D31
  (entrances from OSM pins) and D32 (two Taft sidewalks). Marked agreed in DECISIONS; SUMMARY rows added.
  ARCHITECTURE's header no longer calls D15–D21 proposed (they were agreed on 2026-10-19).

## 2026-10-21: Floor shape agreed before 6b

- 6b spike: four drafts fitted onto their OSM outlines in all 8 placements. Signs are 7–16% off OSM's proportions,
  and the outline can't tell a sign from the same sign turned 180° (numbers in PROJECT_FACTS). D36 *proposed*
  (owner's answers): stretch each floor onto the outline, `fit.turn` set by hand and checked in the preview, the
  compiler applies the fit.
- `src/shared/data/floor-source.ts`: the floor file, `data-src/floors/<building>/<NN>.json`, in sign coordinates
  (0–1). `src/shared/data/indoor.ts` + `indoor.sample.json`: what the compiler will write to
  `public/data/buildings/<slug>.json` for the floor builder (6c): each floor's walls and hallways in meters, with its
  base, height and `checked`.
- ARCHITECTURE §3.1, §3.5, §4 and §7 and the SPLIT meeting point updated: floor files are `.json`, not `.geojson`.

## 2026-10-21: D35 agreed

- Gary agreed D35 (the step rules) when approving #35. Marked agreed in DECISIONS; SUMMARY row added; PLAN §6.3 no
  longer says proposed.

## 2026-10-21: 4c direction text

- `src/features/routing/directions.ts` and `turns.ts`: every route now carries its steps (D35). A step is where the
  student has a choice: a turn at a junction, a crossing, a door, a floor change. Bends 10° or more that are under
  15 m apart merge into one turn by their overall change of direction; a turn names the way, then "the covered walk",
  then a building within 20 m. "(approximate)" on unchecked doors (O6); "ST311 is on 3F: take the stairs up to 3F"
  on the last floors leg, with the building's floor labels.
- The walk graph keeps each link's way (of the cheapest link, when two join the same points), so the directions name
  the way the route actually used. The router's buildings now include `name`, `short`, `floorLabels` and `volumes`.
- Real campus, checked by hand: Gate 1 → ST311 is Start · left onto the Taft sidewalk · left onto the covered walk ·
  right onto the covered walk · Enter STRC · ST311 is on 3F. Over 190 trips: at most 6 walk steps, turns at least
  16.9 m apart, shown distances within 5 m a step of the real walk.
- Tests: 46 new in `directions.test.ts` (written first, every turn size and step kind shown reachable) and the real
  campus in `tests/routing.test.ts`. Nine planted bugs each fail tests, among them left/right swapped (23 fail), no
  merging (21) and no junction rule (1).
- **Fixed from the review** (each with a test that failed first): a bend into the door right after a junction turn
  merged with it and dropped the turn; two streets crossed back to back (Taft, then Dagonoy) were one step; a step on
  the same spot as the next showed 5 m, now 0. Merging chains, which the review queried, is intended and now pinned.
- PROJECT_FACTS "Routing": Claude's own calls in the directions, and what the real campus gives.

## 2026-10-21: Step shape agreed before 4c

- `src/shared/data/route.ts`: `Route.steps`, a list of `Step`s (`start`, `turn`, `cross`, `enter`, `floors`), each
  with one line of text, its leg, and for walk steps the camera point and the rounded distance to the next step.
  `Turn` is the six turn sizes for icons. Added as a new field; nothing in 4b's shape changed.
- `route.sample.ts`: the samples now carry steps, plus `sampleTurnSteps` with one of every turn and a crossing, so
  Lane A can build the step card (S6) and the list (S8) now.
- The router returns `steps: []` until the next PR (`4c-direction-text`) fills them. Its tests compare legs and totals
  only; the steps get their own tests.
- **D35 proposed** (owner's answers): only junctions are steps, jogs under 15 m merge, and a turn names the way, then
  "the covered walk", then a building within 20 m. **D34 agreed** (Gary approved #33); SUMMARY and PLAN §6.2 updated.
- PROJECT_FACTS: the npm lockfile `"peer": true` churn and the fix used in 4b.

## 2026-10-21: 4b routing

- `src/features/routing/`: `createRouter(campus, rooms)` returns the `Router` agreed in `route.ts`. It turns the walk
  network into a graph weighted in seconds (D34) and finds the cheapest walk with ngraph's A* over every usable door
  (mains when leaving from G). Floors legs pick stairs or elevator (Auto: elevator for 3+ floors). The time shown is
  real walking time plus Taft waits and floor changes; the ×1.5 street and ×1.2 steps factors only steer the choice.
- Taft's 45 s wait is charged once per crosswalk, not per OSM piece: the real network has 8, each one link.
- Tests: hand-drawn campuses with hand-worked seconds, and the real campus (`tests/routing.test.ts`): every gate
  reaches every full building, all 280 rooms are reachable from Gate 1, and A* matches a plain Dijkstra from every gate
  to every door. Five planted bugs (path not reversed, factor in the time shown, waits past the curb, Auto off by one,
  an overestimating heuristic) each fail them.
- Reviewed by the `reviewer` agent: nothing material. Its low findings are fixed (a duplicate link in a crossing run,
  unknown-before-same-room, two more tests) or recorded as known limits in `docs/PROJECT_FACTS.md` "Routing".

## 2026-10-21: Route shape agreed before 4b

- `src/shared/data/route.ts`: the meeting point for routes (docs/SPLIT.md). `Router(from, to, mode)` returns a
  `RouteResult`: legs in order (floors down, the outdoor walk, floors up), with the line to draw, meters and seconds,
  or one of three reasons it can't (`same-room`, `unknown-place`, `no-route`). `route.sample.ts` has samples for 5b.
- `src/shared/config/routing.ts`: the costs, all in seconds. Proposed **D34** records them and the door rule.
- `docs/ROADMAP.md`: 4b in progress.

## 2026-10-20: 1▸ Phase 1 critique and polish

- **Critique** (`/impeccable critique`, dual-agent; snapshot in `.impeccable/critique/`): 26/40, 3 P1s, no P0.
  Detector clean in source, built HTML and 4 in-page views. The live overlay can't run under the CSP (expected).
- **O1 only when the app can't start** (owner's call, revising 1d): opened with no signal and nothing downloaded.
  If signal drops after the app opened, it stays on screen with "Saving paused. It finishes when you're back
  online.", and the save is retried in place when signal returns.
- **Silent failures now say so** under the pill: "Not saved for offline…" (failed with signal), and "This browser
  can't save the map…" (no service workers, or registering refused, as in private modes).
- **Map failed, split by cause** (`shared/ui/MapProblem`), styled like O1:
  - "The map didn't download" with "Try again". The button shows only with signal, and it checks the site answers
    (`canReachSite`) before reloading, so Wi-Fi with no internet can't land on the browser's error page.
  - "This phone can't show the 3D map / You can still search for rooms and buildings." No button.
- **Quick fixes:**
  - The search pill is first in tab order.
  - The sheet's hint row lost its magnifier, so it no longer reads as a second search box, and its focus ring is no
    longer clipped.
  - The not-official note drops "Beta.", which the pill already says.
  - The OSM credit's tap area is 48px.
  - Search input focus is a green underline on the bar, not a ring round the field.
  - New `--radius-control` token (22px).
- **Left for later:** the white-to-black first paint and `theme-color` (2c, with D13's palette); Try-list code chips
  (3c).
- **Found on the way:** Zod 4's `eval` probe is blocked by the CSP (PROJECT_FACTS, "Zod and the CSP"). 2c needs
  `jitless`.
- Tests: 469 unit (status logic and `canReachSite` written first), 19 e2e. Checked against breakage: removing the
  retry fails the "Saving paused" test.

## 2026-10-20: D33 agreed

- Gary approved D33 (a dash on the Velasco, St. Joseph and St. Miguel signs is a range) on #29. Marked agreed in
  `docs/DECISIONS.md` and added to `SUMMARY.md`. `docs/PLAN.md` is history and has nothing D33 changes.

## 2026-10-20: Velasco, St. Joseph and St. Miguel room lists

- Typed three more lobby directories into `data-src/rooms/`: `velasco.csv` (71 rooms), `sj.csv` (78) and `miguel.csv`
  (69), so search has 280 rooms across four buildings. No compiler change.
- These signs use a dash as a range (`VH-304-309`); proposed **D33** types each range out with `/` and a note, and
  leaves STRC's reading as it was. Owner calls (Velasco 106 and 201A, St. Joseph 601/602 and 208/209) and the
  prefix rules are in `docs/PROJECT_FACTS.md` "Room lists".
- `tests/compile-rooms.test.ts` checks each building's per-floor counts (hand-counted on the photos), the prefixes,
  24 spot rooms and the mezzanine. A range typed as "and" fails it (checked).

## 2026-10-20: floor-extract skill for Claude Code

- Committed `.claude/skills/floor-extract/SKILL.md`, the step-by-step for turning one evacuation-map photo into a
  draft floor with `tools/floor-extract` (6a). Anyone using Claude Code in this repo now gets it as a skill.
- `.gitignore` now ignores `.claude/settings.local.json` (personal permissions); `.claude/skills/` stays shared.

## 2026-10-20: 4a walk network from OSM, with Taft sidewalks, gates and entrances

- `npm run compile-data` now builds `campus.json`'s `walk`, `gates` and `entrances` (`scripts/compile/walk.ts`,
  `sidewalks.ts`, `attach.ts`, `campus-walk.ts`). OSM paths and small streets are walked on their centre line; Taft
  gets one sidewalk per carriageway, joined only at its crosswalks (D32); other main roads are left out. The biggest
  connected piece is kept and the dropped pieces are reported.
- **Gates:** 9 in `data-src/campus/gates.json`, one OSM node each, confirmed by Charles: Gates 1, 2, 3, 4A, 4B, 5A,
  5B, 6 and Agno Gate. Leveriza Gate and two unnamed gates are left out on purpose.
- **Entrances:** 17 pins in `data-src/campus/entrances.json`, dropped by Charles on openstreetmap.org (D31), all
  `verified: false` until 11a. Andrew, Gokongwei, Velasco, Yuchengco and La Salle Hall have two main doors; St.
  Joseph has a main door in the middle and two side doors. Each pin snaps onto its own building's wall and joins
  the nearest path by a `door` link.
- **The build now fails** if a full building has no main entrance, if a pin is more than 15 m from its building or
  more than 2 m inside it, if a door link would pass through a building or cross Taft, or if a main entrance can't
  be reached from every gate.
- **OSM edit + re-fetch:** Yuchengco's south-east door had no path on its side. Charles mapped the covered walkway
  from Connon into Yuchengco in OSM (ways 1570063350–1570063352), and `snapshot-2026-10-20.geojson` was
  re-downloaded the same evening. The only other changes in it are the outline points that edit added to Connon and
  Yuchengco.
- `node scripts/walk-svg.ts` draws the network to `out/walk.svg` (gitignored) to check it by eye. Real-data tests
  in `tests/compile-data.test.ts`: 510 points, 576 links, 9 gates, 17 entrances, no errors.

## 2026-10-20: Walk network shape agreed before 4a

- `campus.json` gains `walk`, `gates` and `entrances` (`src/shared/data/campus.ts`), the meeting point between the
  4a compiler, routing (4b) and Where are you (5a). `walk` is flat points, ways (`path`, `steps`, `street`,
  `sidewalk`, `crossing`, `door`, with a name and `covered`) and `[from, to, way]` links. Gates have a stable `id`
  and a name; entrances have a building, `main`/`side`/`back` and `verified`. Both point into `walk.points`.
- The schema checks every index: no link to a missing point or way, no link from a point to itself, no gate id used
  twice, no entrance to an unknown building. The compiler emits an empty network until 4a fills it.
- D31 (entrances from pins on openstreetmap.org) and D32 (Taft sidewalks that meet only at crosswalks), proposed.

## 2026-10-20: 1d basic offline (precache, "Ready offline", "Open this once with internet")

- **Precache** (`vite.config.ts`, vite-plugin-pwa 2.0 from the `1d-deps` PR): every built file is saved on the first
  open, including the map data, which Workbox's default patterns would have skipped silently. The size limit is
  raised to 5 MiB per file. Any app URL opens offline (`navigateFallback`). The page open during the first save
  switches to the copy at once (`clientsClaim`). Updates wait for every tab to close (`registerType: 'prompt'`).
  There's no service worker in `npm run dev`. Today's copy is 7 files, about 1.5 MB.
- **O2** (`features/offline`): "Saving for offline…" under the search pill, then "✓ Ready offline" for 3 s, only on
  the first save. From 768px it sits to the pill's right, clear of the side panel (found in the audit). **O1**: with
  no saved copy and no signal, "Open this once with internet to save the map" replaces the app, then reloads by
  itself when signal returns. It has no button: a reload there would land on the browser's offline page. The state
  logic is pure (`status.ts`, 16 tests covering every state).
- **CI check** (`tests/e2e/offline.spec.ts`): every file in `dist/` must be in the precache list, apart from a named
  few. Also: an airplane-mode reload loads the map and data, the open page uses the copy right after "Ready offline",
  and O1 appears and recovers. Checked against breakage: Workbox's default `globPatterns` fails two tests, and
  `clientsClaim` off fails one.
- **Agreed and moved to 10a:** O2's percentage (needs our own service worker; user-flows O2 updated), the web app
  manifest and icons, and "Ready offline" in a second tab open during a first save. No CSP or `_headers` change.

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
