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
- **PowerShell may refuse `npm`** ("npm.ps1 cannot be loaded because running scripts is disabled"): Windows' default
  execution policy blocks npm's PowerShell shim. Either type `npm.cmd run dev`, or once run
  `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`. (Charles's laptop, 2026-10-21)
- Stopping a backgrounded `npx vite` (an AI tool's background task, or closing its Git Bash) can leave its `node`
  running and holding the port. Find it with `netstat -ano | grep :<port>` and stop it with `taskkill //PID <pid> //F`.
  (2026-10-21)

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
- **Agno Gate is the way in, Agno Gate Exit the way out** (Charles, 2026-10-23). Agno Gate Exit
  (`node/14311322337`, mapped by Charles) is on the same covered walk, about 9 m before Agno Gate. It isn't in
  `gates.json`: gates are only starting points ("I'm outside"), and students come in by Agno Gate. It belongs in
  the app once routes can lead off campus. (2026-10-23)
- **Velasco's covered walk joins the Agno covered walk** by a 15 m uncovered footpath between Velasco and Miguel
  (`way/1570964367`, mapped by Charles, 2026-10-23). Without it, Velasco → STRC went out by Gate 3 along Taft and back
  in (253 m); now 162 m through Agno Gate, and `tests/routing.test.ts` holds it there. Its turn reads "Turn right at
  Velasco": an unnamed path is named after the nearest building (D35). (2026-10-23)
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
  just differ for St. Joseph. Hence `fit.turn` by hand. All 4 STRC signs are drawn the same way round, odd
  rooms along the top and "YOU ARE HERE" at the left end. (2026-10-21)
- **STRC is `turn: 180`** (owner, 2026-10-21): the ground-floor guard room, at the sign's left end, is at the east
  (Taft) end, where the main-entrance pin is. So the odd rooms are on the south side. Both turns fit the outline
  equally (median 0.1–0.3 m on every floor), so this came from the owner, not the fit.
- **STRC corners as read** (photo pixels, tl tr br bl): 1F 597,995 3471,1006 3474,1690 594,1707; 2F 168,664
  1856,681 1872,1092 142,1073; 3F 97,676 1795,657 1808,1066 91,1085; 4F 409,1058 3610,1096 3603,1849 405,1847.
  Re-running `extract` with these reproduces the drafts. (2026-10-21)
- **Velasco corners as read** (photo pixels, tl tr br bl; the outermost line, which runs through the exit doors):
  1F 582,815 3389,885 3374,1700 565,1650; 2F 589,979 2925,1085 2920,1710 584,1769; 3F 699,986 3109,1025 3105,1631
  696,1617; 4F 651,866 3289,925 3285,1637 637,1635; 5F 361,819 3586,850 3602,1775 349,1770. On 2F–4F the
  bottom-right corner is the end wall extended (the last room is set in); 5F is the envelope of its two blocks.
  **2F–5F need `--dark 0.88 --red-sat 40`**: washed-out photos (paper V ~155, walls 0.76–0.85 of it, route S
  44–58). Untuned, 2F found 58 walls and read the route as walls. (2026-10-21)
- **Velasco is `turn: 180`** (owner checked all 5 floors in P1, 2026-10-21): the sign's "Assembly Area" inset has
  Taft on the left and Henry Sy above, while OSM has them east and south; and both main-entrance pins land on the
  lobby's exits only that way round (the lobby is 38–44% from the west end, the pins 36–39%). (2026-10-21)
- **Velasco 5F's sign draws parts of it narrower; the floor isn't** (owner, 2026-10-21: "same as the floors
  below"). Traced as drawn, it sat 2.3 m from the outline at the 90th percentile. So after cleanup its plan y was
  stretched by a one-off transform: west block (plan x < 1372) from 0–847 and middle block (1372–1984) from 52–900
  to the east block's bottom, 941; then the top of x 526–1870 from 52 to 0 (lobby and elevator left as drawn). Each
  wall moves with the block its midpoint is in. Now 0.3 m. Re-tracing 5F means redoing this. (2026-10-21)
- **Velasco's south main-entrance pin moved** about 5.4 m east and 1.7 m north, to the lobby's south door where the
  sign draws it (owner's call, 2026-10-21): it was 5.6 m from the G hallway, past 8a's 5 m. Still `verified: false`.
- **P1 Floor preview:** `npm run dev`, then open `/preview.html` (`?building=strc&floor=2` jumps straight there). It
  reads the compiled `public/data/`, so re-run `npm run compile-data` (or restart `npm run dev`) after editing a floor
  file. Read-only: the owner says which floors look right and Claude sets `checked: true` in a PR (owner's choice,
  2026-10-21). It probes every full-tier building's floor file, so the console shows a 404 per building with none yet;
  that is expected. Headless screenshots: Playwright's own browsers aren't installed here, so use
  `chromium.launch({ channel: 'msedge' })`. (2026-10-21)
- **Cleanup is a review → edit loop** (`floor-extract review`, `edit`; the steps are in the `floor-extract` skill).
  Edit specs stay in `tools/floor-extract/out/`, not in git: the floor file's diff already shows one wall per line.
  `edit` on a checked floor sets it back to `checked: false` (owner's check was of the old walls; 2026-10-21).
  `floor-extract shots <building>` starts and stops its own Vite, so it never leaves a dev server on a port.
  (2026-10-21)
- **Helpers for labelling and fit** (2026-10-22, from St. Joseph): `walls <floor file>` lists walls in plan px with
  their index, `walls … --gaps y0,y1` the door gaps along one wall band, and `far <floor file>` the outline points
  more than 1.5 m from every wall, in plan px (it reads the compiled `public/data/campus.json`, so run
  `compile-data` first). `crop` also writes `crops.png`, the four corners in one picture. An `edit` spec's
  `deleteInside` boxes delete every wall wholly inside them (roof hatching, stair treads).
- **Labelling a floor (8a):** an `edit` spec's `rooms` and `verticals` are in plan px and replace the floor's whole
  list. Doors go in the gap of the corridor wall in front of the room; read the gaps from the walls dumped in plan px,
  not by eye, and check them against `review` (on STRC 4F, the wall line runs on past what was traced, so gaps that
  look open in the dump can be drawn shut on the sign). A stair point sits in the stairwell; where the route doesn't
  go in (STRC 1F) or an elevator sits right at 3 m (STRC 2F, 3F), a short hallway stub is added. Edit specs are in
  `tools/floor-extract/out/<photo>/labels.json`. (2026-10-21)
- **STRC's elevator serves G–4F** (owner, 2026-10-22). The 4F sign draws its shaft as a plain closed room, with no ✕
  as on 1F–3F, at the same spot on the sign (about 0.95 across, 0.65 down). Don't read a missing ✕ as a skipped floor;
  ask. STRC's stairs are `east-stairs` (the sign's left end, since STRC is `turn: 180`) and `west-stairs`.
- **Velasco's stairs and elevator** (labelled 2026-10-22): `east-stairs` (the sign's left end, `turn: 180`),
  `main-stairs` (just past the lobby, on the far side from the elevator), `west-stairs` (the right end) and
  `elevator` (the ✕-box in the notch above the lobby). All four are drawn on every floor, so `servesFloors` is G–5F
  for each, read off the signs rather than checked on site. The small stairs drawn inside rooms (beside 109 and in
  101 on G, over 302 on 3F, beside 402 on 4F) are left out: no route needs them, and the G ones may be the mezzanine's.
- **Velasco's G Mezz rooms (VL151, VL153) aren't placed** (owner, 2026-10-22): no sign draws the mezzanine. The
  compiler's whole-floor check skips a room with its own `floor_label`, so a route to one stops at Velasco's door
  with `noIndoorMap` (O5). Place them once someone finds the mezzanine's stairs.
- **St. Joseph corners as read** (photo pixels, tl tr br bl): G 575,1242 3170,1271 3170,1590 575,1594 (the long
  top wall extended; both top ends step in); 2F 612,1042 3406,1099 3400,1449 612,1386; 3F 410,1079 3311,1127
  3311,1473 410,1428 (from the 6b spike); 4F 344,1100 3449,1179 3430,1547 344,1477; 5F 729,1149 3044,1190 3030,1465
  731,1453; 6F 578,1231 3284,1230 3284,1554 578,1554. On 2F–6F the bottom corners extend the main block's bottom
  line. No tuning needed. 4F's "corrugated roof" hatching above the corridor reads as about 200 walls: delete
  everything in that band outside the two stair boxes. 2F's 206A sits in a wing below the main block that OSM's
  outline doesn't have, so it is placed at the foot of the 206B passage, on the floor's edge. (2026-10-22)
- **St. Joseph's turns** (2026-10-22): 2F–6F are `turn: 180` (90th percentile 0.9–1.4 m, against about 3 m at 0),
  so the sign's left end is south. G's sign is drawn the other way round, so G is `turn: 0` and its right end is
  south. The room numbers agree: 101, 201, 301… are all at the south end.
- **St. Joseph G got a 20 px strip on the campus side** after cleanup: plan height 352 → 372, every y scaled by
  352/372, so the walls sit 0.8 m further from the outline's west edge. OSM's outline has the upper floors' stair
  towers 2.3 m out on that side, and G's sign has no towers. 90th percentile 1.8 → 1.3 m. Re-tracing G means
  redoing this. (2026-10-22)
- **St. Joseph's stairs, and no elevator** (owner, 2026-10-22; corrected 2026-10-23): `south-stairs` (the sign's
  left end on 2F–6F, G's right end), `north-stairs` (the other end) and `lobby-stairs` (G–2F, from the lobby). The
  small X box in the corner beside `south-stairs`, drawn like an elevator, **is stairs, not an elevator** (owner,
  2026-10-23), so St. Joseph has no elevator: Elevator mode climbs by stairs and says "No elevator in St. Joseph".
  The two middle stairwells on 2F–6F (2F labels them DECK) are **emergency only** (owner, 2026-10-22), so they
  aren't verticals: above 2F only the end stairs are used. Their short hallway stubs stay as dead ends. Stairs can
  change at 2F: the lobby stairs, then an end stair.
- **St. Joseph's south side-entrance pin moved** about 7 m north, to the TO CHAPEL passage between 104 and 101
  where the G sign draws the exit (owner, 2026-10-22). Still `verified: false`.
- **P1 labels are canvas-texture sprites** with the system font: drei `<Text>` would fetch its default font from a
  CDN (D5), and there is no self-hosted font yet. P1's test route (`src/dev/floor-preview/test-route.ts`) is the
  cheapest by D34's seconds, stairs or elevator alike; 8b's router replaces it. (2026-10-21)
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
  Mechatronics Lab, and **102 is a different room**, named just “Room” until someone reads its door.
- **STRC's signs print 8 rooms its directory leaves out:** 101, 103, 108, 209, 212, 308, 403 and 412. They are in
  `strc.csv` as "Room" so a typed code routes (owner, 2026-10-21); read their names off the doors next visit. And the
  other way round: **C107B** isn't on the 1F sign, so it shares 107's room place and door; **C315A/B** share the one
  315 the 3F sign draws. The directory's pairs **214/219, 404/406, 407/409** are separate rooms on the signs (214 and
  219 face each other across the hallway) and are placed as drawn. (owner, 2026-10-21)
- **Owner calls on the other signs** (2026-10-20, all checked at the doors 2026-10-21): Velasco lists **VH-106** twice
  (CNC Lab, MEM CIM Lab), one door with both names; **VH-201A-206** is 201A, **201B** (a separate room beside it) and
  202–206. St. Joseph's **601/602A/B** wrap is split as "Chemical Room" and "Devt. Biology Research Room" (601 is next
  to 602), and **J-208/209** (printed under J-202/203) is the same Comparative Anatomy Lab.
- **Velasco's signs against its directory** (owner, 2026-10-22, when labelling; none checked at the doors yet):
  - Sign-only rooms **201C, 403A, 403B** are in `velasco.csv` as "Room".
  - **303C** is the small room right of 303B. **313 and 314** are one room. **513** is the right part of the room the
    5F sign labels 512 (split where both its door gaps are). 5F's second "503", bottom right, is **505**.
  - 4F, the owner's "best reading": **401** spans the sign's 401A and 401B. **403** is the space the sign labels 403,
    and 403A and 403B open off it. **404A/B** share the one 404, and **410A/B** the one 410. **407** is the narrow room
    between 412 and 411, and **408** the small one behind 411. **413 and 414** are placed apart, as drawn.
  - Check 407 and 408 on site first: by number they'd sit between 409 and the main stairs, but that block is drawn
    like the restroom block on the floors below.
- **St. Joseph's signs against its directory** (owner's "best reading", 2026-10-22; none checked at the doors yet):
  - Sign-only rooms **102, 115, 117, 313, 411, 412, 413** are in `sj.csv` as "Room". 102 was once read as skipped by
    the directory's J-101/103; the G sign draws it.
  - G: the sign's **"F04"**, bottom row by the TO CHAPEL exit, is **105** (Safety Office). **101 and 103** are placed
    apart, at opposite corners as drawn, though the directory gives them one office. **114/118B** (NSTP) goes in the
    sign's 118.
  - 5F: **510** spans the sign's 510A and 510B. **513** is the far end of the sign's 512, past its second door.
  - 6F: **613** spans the sign's 613A–613D. **602A/B, 608A/B and 611A/B** each share the one room the sign draws.
  - Directory pairs the signs draw apart (202/203, 208/209, 210/211, 302–306, 303/307, 308/309, 311/312, 503/505/508,
    603/604, 605/607) are placed apart, as on STRC.
- `tsconfig.node.json` maps `@/*` so scripts can typecheck src files that use the alias. Type imports only: Node
  doesn't resolve `@/`, so a value import through it would crash `compile-data` (CI's build step catches
  it). (2026-10-20)

## Search (3c)

- **Recent** lives in `localStorage` under `dlsu-map.recent`: a JSON array, newest first, at most 5, of
  `{"kind":"room","code":"ST311"}` or `{"kind":"building","slug":"andrew"}`. Canonical codes only, never From.
  Anything unreadable is dropped on read (`recent.ts`); a room no longer in `rooms.json` simply stops showing.
  Changing the format means a new key, or `parseRecent` dropping the old entries. (2026-10-21)
- **uFuzzy can't suggest room codes:** with `intraMode: 1` it returned nothing for `ST350`, `ST904`, `VL599`, even
  with digits allowed in words, and `uFuzzy.IntraMode` exists only in its `.d.ts` (reading it crashes at load). Hence
  the one-typo check in `search-results.ts` (D38). (2026-10-21)
- **`loadCampus()` and `loadRooms()` share their first good load** (search and the map both call them at start). A
  failure isn't kept, so the next call retries. Passing a fetch always loads afresh (tests). (2026-10-21)
- **An overlay that opens another on close uses `closeThen`** (`useBackToClose`): `history.back()` lands later, so
  opening the next overlay straight after `close()` would let Back pop the wrong one. (2026-10-21)
- **Overlay history entries carry their depth** (`dlsu-depth`), and an overlay closes on Back only when history drops
  below its own entry. Every overlay hears every `popstate`, so one opened inside another's Back (search closing,
  then a card and Where are you opening) would otherwise be taken for the one that closed. Keep `history.state` when
  calling `replaceState`, as `useDeepLink` does. (2026-10-22)

## Routing

- **Assumptions for a building without a file** (not confirmed, 2026-10-21): every full-tier building has an
  elevator. With a building file (8b), the file's `verticals` say. Stairs cost the same going down as going up (20 s
  a floor) everywhere.
- **Indoor routing (8b, D41) calls Claude made** (2026-10-22): the mode not asked for isn't forbidden but costs an
  extra hour per use in the search only, so Elevator falls back to stairs only where the elevator can't go (a skipped
  floor), and Stairs to the elevator only where no stairs go; the time shown never includes it. A trip that starts at
  a stop and rides at once has no "Start at" step: its first step is the ride. Floors a climb passes without
  stopping make one floors leg. The router keeps what it builds from each building file per file object (a
  `WeakMap`), so Lane A should keep the loaded objects rather than re-parse them per route.
- **P1's test route** (`src/dev/floor-preview/test-route.ts`) is still its own small search with the same costs; it
  was a stand-in for 8b and could now call the router.
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
- **The app loads building files once per trip** (5b, `useRoute` with `tripBuildings`): a room's building at either
  end, and a building tapped on an upper floor; never a gate, a G tap or a building as To, which the router walks
  without a file. A building with no file yet (St. Joseph and Miguel today) is still asked for: wrangler and
  Cloudflare answer with `index.html`, `loadIndoor` reads `not-json`, and the route stops at its door (O5). A route
  option reuses the loaded files, so the router's per-file models are kept. (2026-10-22)

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
- **The 3D map is a lazy chunk** (`React.lazy` in `src/app/App.tsx`), so search works before the scene is ready
  (user-flows §3.2). Since 10c the build has three main chunks: the first load (`index` + `vendor`, 179 kB gzipped),
  `three` (three.js, R3F, drei, camera-controls; 249 kB) and `campus-scene` (the map's own code; 15 kB). The
  `vendor` group in `vite.config.ts` must stay: without it rolldown puts React in the three chunk and three.js
  lands in the first load. `scripts/check-size.mjs` fails the build past D49's budgets. (2026-10-22)
- **The scene's coordinates:** campus data is meters with x east and y north; the scene is x east, y up and z = -y,
  so north is -z and the map isn't mirrored. camera-controls' azimuth 0 puts the camera south of its target (+z), π/2
  east. `massing.ts` and `home-view.ts` pin both with tests. (2c, 2026-10-21)
- **Colour and light settings:** the canvas is `flat` (no tone mapping), so the unlit ground is exactly its palette
  colour. Light intensities are the prototype's values × π, because three.js's lighting has been physical since r155
  and the prototype was tuned on the old model. (2c, 2026-10-21)
- **Labels are DOM, not drei `<Text>`:** plates need the Float shadow and the system font, and DOM text needs no font
  download. `LabelProjector` (inside the canvas) writes each plate's position on every frame the canvas draws, with
  `style.setProperty`: a plain assignment through a ref trips `react-hooks/immutability`. (2c, 2026-10-21)
- **The route line's white edge writes no depth and is drawn before the green** (`RouteLine.tsx`): with both writing
  depth 2 cm apart, they fought at campus distances and the line read white. The faint stretch behind a building is
  the same ribbon again with `depthFunc: GreaterDepth`, so it draws only where something nearer already is. The
  see-through city writes no depth, so the line just shows tinted under it. (5b, 2026-10-22)
- **The camera frames a trip once per `MapTrip.here` object:** `useRoute` keeps the same object for every mode of one
  trip, so a route option redraws the line without a flight. A new trip, or reopening the preview, gets a new one.
  (5b, 2026-10-22)
- **The Canvas `dpr` must stay an array** (`[1, TIER_DPR[tier]]`): R3F only follows the screen's pixel ratio
  (browser zoom, another monitor) when `dpr` is an array or unset, and clamps the array to the device itself. A
  plain number is never watched again. (10c, 2026-10-22)
- **A frame-rate cap reads as a slow phone:** iPhone Low Power Mode caps the page at 30 fps, so the quality monitor
  steps down to the lowest tier (no city) even on a fast phone. Accepted: it also saves battery. (10c, 2026-10-22)
- **Clipping needs `localClippingEnabled`:** a material's `clippingPlanes` do nothing unless the renderer has it on.
  The campus Canvas sets it through `gl={{ localClippingEnabled: true }}` (`CampusMap.tsx`). Only the cut building's
  materials carry the plane (`BuildingCutaway.tsx`); the stump is cut by geometry instead (`stumpBlocks`). (7a,
  2026-10-22)
- **The cut's slide is driven off `performance.now()`, not R3F's clock delta** (`useCutSlide.ts`): with
  `frameloop="demand"`, the first frame after idle can carry a huge delta. To screenshot a frame mid-slide, Playwright's
  `page.clock.install()` before `goto`, then `pauseAt` and `runFor(ms)`; plain timed screenshots miss it, since the
  ease-out was about 80% done by 150 ms (the cubic one since 7▸ is about 58%). (7b, 2026-10-22)
- **An indoor step's camera target and dot height come from `floorBand`, not the floor file** (`floorHeight` in
  `useTripMarks.ts`): campus-scene doesn't load floor files. Today every traced floor's `base` equals the band's even
  storey split exactly (STRC, Velasco, SJ). A building whose first volume doesn't start at 0 m would put the dot off
  the cut slab by that offset. (7▸, 2026-10-22)
- **e2e specs that step through camera flights run with `reducedMotion: 'reduce'`:** CI draws the 3D in software, and
  each 650 ms flight made a walk through every step brush the 30 s test limit. (5d, 2026-10-22)

## Offline (1d)

- **Workbox's generated service worker reports no download progress.** vite-plugin-pwa's `onOfflineReady` fires once,
  when the first copy is complete. A percentage needs `injectManifest` (our own service worker), so O2 has none
  (D50). (2026-10-20)
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
- **vite-plugin-pwa's prompt-mode `updateSW(true)` doesn't reload by itself.** It only posts SKIP_WAITING; the reload
  happens on workbox-window's `controlling` event and only when `isUpdate`, which is fixed at register time. A tab
  open during the very first save had no controller then, so its Reload did nothing. `useUpdate` posts SKIP_WAITING
  to `registration.waiting` itself and reloads on `controllerchange`. (10a, 2026-10-23)
- **Reload in one tab reloads every other tab** that saw the waiting worker (the plugin's own `controlling`
  listener), even one mid-route. Accepted: phones rarely have two tabs of the app open. (10a, 2026-10-23)
- **Reload on Arrived writes `?to=<room code or building name>` into the URL first.** `useDeepLink` removes the link
  after reading it, so a plain reload would land on an empty map. From is lost on purpose (it is never stored, PRD
  §6). (10a, 2026-10-23)
- **App icons are rendered, not drawn by hand.** `npm run icons` renders `public/icons/icon.svg` to the four PNGs
  with Playwright's Chromium; the PNGs are committed so the build needs no browser. Change the SVG, rerun, commit
  both. (10a, 2026-10-23)
- **`context.route('**/sw.js')` doesn't see Chromium's service-worker update check,** so a test can't fake a new
  version through the network. `tests/e2e/update.spec.ts` rewrites `dist/sw.js` on disk instead and restores it
  after. That would leak a "new version" into specs running beside it, so it is its own Playwright project
  (`phone-update`, `dependencies: ['phone']`), run after the rest. (10a, 2026-10-23)

## Zod and the CSP

- **Zod 4 probes for `eval` when it builds a schema, and the CSP blocks it** (`script-src 'self'`; no
  `'unsafe-eval'`). `tests/e2e/hosting.spec.ts` reports it as "script-src blocked eval". Setting
  `z.config({ jitless: true })` before the first *parse* is too late: an object schema reads the setting when it is
  built, which happens on import. So `src/shared/data/zod.ts` sets it and every schema file imports `z` from there
  (`tests/zod-entry.test.ts` fails on a direct `'zod'` import in `src/`). Never relax the CSP for it. (2c, 2026-10-21)
- **Schema files import siblings with `.ts`** (`./zod.ts`, `./campus.ts`): the data compiler runs them in Node, which
  needs the extension. Vite doesn't mind either way. (2026-10-21)

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
