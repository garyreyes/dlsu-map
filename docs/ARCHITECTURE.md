# DLSU 3D Campus Navigator: Architecture

> **Status:** draft for review, written 2026-10-19 from `docs/PRD.md` and the architecture Q&A.
> This file is the **single place the technical stack is recorded.** `docs/PLAN.md` §1 is now history; where they
> differ, this file wins. Reasoning for each fork is in `docs/DECISIONS.md` (D15–D21, proposed).

## 1. What the app does

A phone-browser 3D map of DLSU Manila. A student types a room code in **To**, sets **From** by tapping the map, and
gets a route: across campus to the right entrance, then inside the building floor by floor to the room. It works
offline after the first open. There is no backend: the app is static files plus one compiled map data bundle.

## 2. Tech stack

| Layer | Choice | Why (forks only) |
|---|---|---|
| Language | TypeScript, strict. `tsc` 7.0 for type-checking, 6.0 API for ESLint/editor | D1 |
| Runtime (dev/build) | **Node.js 24 LTS** (installed 2026-10-19) | Needed for Vite and the data build |
| Build | Vite 8 | |
| UI | React **~19.3.1** (pinned) | React Three Fiber breaks on 19.4 (D3) |
| 3D | three.js 0.186 + @react-three/fiber 9.8 + drei 10.7 (`CameraControls`, `Text`), three-mesh-bvh | |
| Styling / UI pieces | Tailwind 4, shadcn/ui pattern + Radix, react-modal-sheet, sonner, Lucide or Phosphor icons | |
| State / validation | Zustand 5 / Zod 4 | |
| Search | Our room-code parser + **uFuzzy** for "Did you mean" + **cmdk** for the To/From lists | Sentence parser dropped (D16) |
| Routing | ngraph.graph + ngraph.path (A*) | |
| Offline | vite-plugin-pwa (Workbox), `globPatterns` widened to `.json/.woff2/.glb` | D10 |
| **Floor extraction (dev-only)** | **@techstark/opencv-js + sharp**, in `tools/floor-extract/` | Proven by the spike (D17). Never shipped |
| Geo (build-time) | @turf/turf, proj4 | |
| Tests | Vitest (unit), Playwright (end-to-end) | |
| Lint / format / hooks | ESLint 10 + typescript-eslint `strictTypeChecked` + react-hooks, Prettier, Husky + lint-staged | D2 |
| Hosting | Cloudflare Workers static assets, `_headers` for CSP; preview URL per PR | D5 |
| Database / auth / ORM | **None.** Data is versioned files compiled to JSON. No accounts | D11, PRD §6 |

**Removed from PLAN.md:** MapLibre + Terra Draw tracer (replaced by D17), the sentence parser and on-device AI
model (D16), GPS / `watchPosition` / compass (D14 moved to later).

## 3. Entities

All map data is **authored as files in `data-src/`**, validated with Zod, and compiled into `public/data/`. Nothing
is entered at runtime, so "constraints" and "indexes" live in the compiler, not a database.

### 3.1 Authored entities

| Entity | Key | Required fields | Source |
|---|---|---|---|
| **Building** | slug: `strc`, `andrew` | name, `prefixes[]` (e.g. `["AG"]`), aliases, OSM footprint, floor count, `floorLabels` (e.g. `{1:"G"}`), `tier: "full" \| "block"` | OSM snapshot + `data-src/campus/buildings.json` |
| **Floor** | `<building>-<NN>`: `strc-03` | building, number, label, walls, hallway lines, `extractedFrom` (photo name), `checked` | `tools/floor-extract` + my cleanup |
| **Room** | **canonical code**: prefix + number (+ letter): `ST311`, `AG1104`, `ST315A` | building, floor, name, label point, door point. Outline is optional | Lobby directory → `data-src/rooms/<building>.csv`; positions from the floor file |
| **Opening** | generated | floor, kind (`main`/`side`/`back`/`door`/`exit`), point, `verified` | Floor file; entrances also from OSM |
| **Vertical** | `<building>-<name>`: `strc-east-stairs` | kind (`stairs`/`elevator`), `servesFloors[]`, one point per floor | Floor files, labelled during cleanup |
| **Hallway** | generated | floor, centerline | The green evacuation-route line (extracted) |
| **Walkway / Road / Crossing / Gate** | OSM id or generated | geometry, name; crossings name the street | OSM snapshot + official campus map (D6) |
| **Bridge** | generated | two (building, floor) ends, `verified` | OSM `building:part=bridge` |

### 3.2 Relationships

```text
Building 1---* Floor 1---* Room
                Floor 1---* Hallway, Opening
Vertical *---* Floor              (servesFloors[] is the join; checked by the compiler)
Bridge   joins (Building A, Floor) <-> (Building B, Floor)
Building 1---* Opening(kind=main|side|back) ---> Walkway network ---> Gate
```

### 3.3 Room-code rules (D18)

- **Every room number is its own Room.** The directory entry `C404/406 · Biology Lab` makes two rooms, `404` and
  `406`, both named "Biology Lab". If the evacuation map draws them as one space, they share a label position.
- **Parsing:** `^(prefix)\s*-?\s*(\d{3,4})([A-Z]?)$`, case-insensitive. **Floor = number ÷ 100**, rounded down
  (`G304` → 3, `AG1104` → 11). `C-309`, `c309` and `C 309` are the same code. `ST404/406` is read as `ST404`.
- **Strict** (PRD §7): a code not in the room table is rejected with "Did you mean…" suggestions from uFuzzy.
- **Prefixes** (owner's list, 2026-10-19): `SM` St. Miguel · `EY` Yuchengco · `VL` (alias `VE`) Velasco · `ER` Razon ·
  `SJ` St. Joseph · `G` Gokongwei · `LS` St. La Salle · `AG` Andrew · `ST` (alias `C`, as printed on its lobby
  directory) STRC · `MM` Mutien-Marie. The canonical form is the first prefix (`C311` is stored and shown as
  `ST311`).
- **Connon and Henry Sy have no room codes** (no classes there) and are block tier for now (D20).

### 3.4 Compiler constraints (the build fails if any is broken)

- Room codes are unique across the campus. Prefixes are unique across buildings.
- Every room's floor exists, and its floor number matches `number ÷ 100`.
- Every room is reachable from every main entrance (graph check).
- Every door is within 3 m of a hallway line.
- Every `servesFloors` value is a real floor of that building.
- Every `tier: "full"` building has a room list and a `checked: true` floor file for every floor (**public launch
  gate only**; the beta build warns instead).

### 3.5 Compiled output (what the phone downloads)

| File | Contents | Lookup structure ("index") |
|---|---|---|
| `campus.json` | Buildings, outdoor meshes' source data, outdoor graph, data version hash | — |
| `rooms.json` | Every room: code → building, floor, name, position | Map keyed by canonical code; uFuzzy haystack prebuilt |
| `buildings/<slug>.json` | One building's floors, walls, hallways, verticals, indoor graph | Loaded when the route enters the building |

All are precached for offline use. Budget: under 15 MB total.

### 3.6 Runtime-only state (memory, never stored)

- **Trip:** From (building + floor + spot, or gate), To (room or building), Stairs / Elevator / Auto.
- **Route:** list of RouteSteps (icon, text, distance, camera target, floor).

## 4. Data pipeline

```text
Lobby directory photo ──(typed by Claude, checked by owner)──► data-src/rooms/<building>.csv
Evacuation-map photo  ──► tools/floor-extract ──► draft floor ──(Claude cleanup + labels)──► data-src/floors/<b>/<NN>.geojson
OSM main API (npm run fetch-osm, by hand, D27) ──► data-src/campus/osm/snapshot-<date>.geojson
data-src/campus/buildings.json (by hand: slug, OSM ids, names, prefixes, tier) ─┘
                                   all of the above ──► scripts/compile-data.ts ──► public/data/*.json + report
```

**Floor extraction (D17), per floor:**

1. Find the plan's 4 outer corners in the photo.
2. Straighten, then split by colour: black = walls, saturated green = hallway route, red = ignored.
3. Keep long straight runs (drops text and symbols) and merge each double-line wall into one.
4. Fit the plan onto the building's OSM footprint (**not yet proven**: needs the OSM snapshot first).
5. Cleanup: add missed walls, delete stair-tread "walls", place room labels, stairs, elevator, doors.
6. The owner checks the 3D preview, then the file is marked `checked: true`.

Spike evidence (STRC 4F and 2F): about 4 s per floor; hallway line clean on both; most walls found; door gaps
appear by themselves. See `docs/spikes/wall-extract/`.

**Who does what:** Claude runs steps 1–5 in a Claude Code session; the owner photographs (lobby directory + every
floor, straight-on, whole sign in frame) and does step 6.

## 5. Rendering (unchanged from PLAN §5)

One merged mesh for outdoor buildings, `frameloop="demand"`, the massing-model look (D13), and the clipping-plane
cutaway for the building you're inside. **Walls come from the floor file**, extruded to floor height. The building
being entered is split out of the merged mesh so only it gets cut.

## 6. Layer boundaries

No server, so "outbound calls" means fetching our own `/data/*.json`. The rules:

| Layer | Lives in | Rule |
|---|---|---|
| **UI** | `features/*/components/*.tsx` | Renders and handles taps. No parsing, routing or fetching |
| **Logic** | `features/*/*.ts` (e.g. `parse-room-code.ts`, `build-steps.ts`) | Pure functions, unit-tested. No React, no fetch |
| **Data access** | `shared/data/` | The **only** place that fetches `/data/*.json` and validates it with Zod |
| **App shell / routing** | `src/app/` | Thin: URL ↔ state sync, providers. Calls features, no logic |

Features import only from `shared/` or another feature's `index.ts`. No auth or payment SDKs exist, so no wrapper
modules are needed.

## 7. Folder structure

```text
dlsu-map/
  src/
    app/                 App shell, providers, deep-link URL ↔ state
    features/
      campus-scene/      Outdoor merged meshes, tap picking, camera
      indoor-view/       Floor builder (walls from floor files), clipping cutaway, floor rail
      search/            parse-room-code.ts, fuzzy index, To/From lists (cmdk)
      location-picker/   "Where are you?" tap flow: building → floor → spot, gates
      routing/           Graph loader, A*, stairs/elevator cost, direction text
      route-player/      Step carousel, Next/Back, follow camera
      offline/           Service worker registration, update + offline toasts, iOS hint
    shared/
      data/              Zod schemas (shared with the compiler), loader, types
      geo/               Projection, polygon/line helpers
      three/             Materials, extrusion/ribbon builders, clipping helper
      ui/                Sheet, Button, Toast wrappers
      config/            Prefix table, floor labels, cost constants, palette tokens
  data-src/
    campus/              buildings.json, walkways, roads; osm/snapshot-<date>.geojson
    rooms/<building>.csv Room lists from lobby directories
    floors/<building>/<NN>.geojson
    photos/              Evacuation maps + directories (gitignored, never shipped)
    LICENSE              ODbL
  scripts/
    fetch-osm.ts         Pinned OSM snapshot (run locally)
    compile-data.ts      data-src → public/data, report, coverage table
  tools/
    floor-extract/       Productionised spike: photo → draft floor (dev-only)
  public/
    data/  fonts/  icons/  models/  _headers
  tests/e2e/             Playwright
  docs/                  PRD, ARCHITECTURE, PLAN, DECISIONS, spikes/
```

**Where new code goes:** a pure rule → the feature's `.ts` file; something on screen → that feature's
`components/`; anything that reads `/data` → `shared/data/`; a tunable number → `shared/config/`.

## 8. Security baseline

No accounts, backend, database or user data, so most of the usual risks don't exist. What does apply:

- [ ] **No third-party requests at runtime.** Self-hosted fonts on every drei `<Text>`, no drei `<Environment
      preset>`. A Playwright test fails on any request to another origin.
- [ ] **CSP and security headers** in `public/_headers` (D5). `Permissions-Policy: camera=(), microphone=(),
      geolocation=()` while GPS is out of v1.
- [ ] **Beta link (D19):** `X-Robots-Tag: noindex` and a disallow-all `robots.txt` until the public launch, plus a
      visible "Beta, not an official DLSU app" label.
- [ ] **Secrets:** only the Cloudflare deploy token and account id, stored in GitHub Actions secrets. Never in the
      repo. `.env*` is gitignored.
- [ ] **DLSU material stays out of git:** `data-src/photos/`, `docs/reference/`, and `docs/spikes/*/out/` are
      gitignored. Traced floor files *are* committed (accepted risk, D21).
- [ ] **Supply chain:** `package-lock.json` committed, `npm ci` in CI, Dependabot with the 3D stack grouped,
      CI fails on peer-dependency conflicts.
- [ ] **Location privacy:** v1 never asks for location. When GPS returns (D14), positions stay in memory only.

### Environment variables

| Variable | Local | CI (GitHub Actions) | Cloudflare | Notes |
|---|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Optional (manual deploy) | **Required** (secret) | — | Deploy only |
| `CLOUDFLARE_ACCOUNT_ID` | Optional | **Required** (secret) | — | Deploy only |

The app itself reads no environment variables at runtime.

## 9. Open decisions

1. **Floor labels per building.** STRC calls its ground floor "G". Confirm for each building from its directory.
2. **Fit onto OSM footprints** (pipeline step 4) is unproven until `scripts/fetch-osm.ts` has run.
3. **Palette** (D13): decided in the design-direction step, not here.

**Resolved 2026-10-19:** STRC accepts both `ST` and `C` (§3.3). Traced floor files are committed to the public repo
as an accepted risk (D21). Connon and Henry Sy are block tier for now (D20).

## 10. Build phases (high level; `roadmap-planner` splits these later)

1. **Skeleton:** tooling, CI, Cloudflare previews, headers, basic PWA, empty 3D scene.
2. **Outdoor campus:** OSM snapshot, compiler, massing-model scene, 10 full + block-only buildings.
3. **Rooms + search:** directory CSVs, room-code parser (strict), To/From fields, "Did you mean".
4. **Outdoor routing:** walkway graph, entrances, crossings, step directions.
5. **From picker + route player:** tap flow, Next/Back steps, follow camera, deep links.
6. **Floor pipeline:** `tools/floor-extract` from the spike, OSM fit, STRC end to end.
7. **Indoor view:** walls from floor files, cutaway, floor rail, enter animation.
8. **Indoor routing:** hallways, verticals, bridges, joined to the outdoor graph.
9. **Data rollout:** all 10 full buildings photographed, extracted, cleaned, checked (can run alongside 6–8).
10. **Offline polish → private beta** (unlisted link).
11. **On-site verification, Facilities, public launch.**
