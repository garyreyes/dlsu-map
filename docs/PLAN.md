# DLSU 3D Campus Navigator: Plan v2

> **Status (2026-10-19):** history. The plan is approved, but its stack, scope and phases were replaced by
> `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/user-flows.md` and `docs/ROADMAP.md` (decisions D15–D27). Keep this
> file for the rendering and data-pipeline reasoning; where it disagrees with those files, they win.

This plan amends `docs/HANDOVER.md`. Where the two disagree, this file wins once approved.
Versions below were checked on the npm registry on 2026-10-18.

**Room codes in every example (`B305`, `G304`, …) are placeholders.** Official prefixes aren't confirmed yet
(section 9). Examples use `B305` = Andrew and `G304` = Gokongwei throughout.

**Core idea:** build only the parts that are specific to DLSU: the campus data, the room-code parser, the
cutaway look, and the route-step UX. Use existing MIT-licensed libraries for everything else: camera,
graph search, fuzzy search, sheets, drawing tools, and PWA.

---

## 0. What changed vs. the handover (TL;DR)

| # | Change | Why |
|---|---|---|
| 1 | **Write data as GeoJSON in `data-src/`, then compile it** into optimized runtime JSON with a build script | You can trace on top of real OpenStreetMap footprints, edit in QGIS or geojson.io, and run validation once at build time instead of on the phone |
| 2 | **Generate the nav graph automatically** from hallway and walkway *centerlines* | You draw lines, not hundreds of nodes and edges by hand. Room doors snap to the nearest hallway |
| 3 | **Build the tracer on MapLibre + Terra Draw** (both permissive), not from scratch | Image overlay with 4-corner alignment, snapping, and polygon/line/point editing come for free |
| 4 | **Merge the outdoor buildings into 1 mesh** using vertex colors and face→building lookup. The building you're inside is split out (section 5) | About 1 draw call instead of 16+. Tap-picking still works |
| 5 | **`frameloop="demand"`**: only render a frame when something changes | A map is still most of the time, so this saves a lot of battery on phones |
| 6 | **Use a clipping-plane "dollhouse slice"** for the indoor cutaway | One GPU feature gives the Sims cut, hides upper floors, and animates the enter transition |
| 7 | **Type-or-tap "Where are you / Where to"**: a rule-based English/Taglish parser plus a precise tap picker. QR stickers become optional | Works offline with no approvals needed (D7–D9) |
| 8 | **Keep ESLint + Prettier + Husky** (Biome idea withdrawn after testing), and run **TS 7 for `tsc` with TS 6 aliased for tools** | Type-aware lint caught bugs Biome missed. See `DECISIONS.md` D1/D2 |
| 9 | **Cloudflare (Workers static assets) instead of GitHub Pages** | Real HTTP headers for CSP, and a preview URL per PR for testing on real phones. See D5 |
| 10 | **PWA basics move to Phase 1**, polish stays in Phase 6 | Service-worker problems are cheaper to find early |
| 11 | **`react-modal-sheet` instead of building sheets** (not `vaul`) | vaul's last release was Dec 2024. react-modal-sheet is active (Mar 2026) |
| 12 | **Outdoor first, indoor later:** ship a full outdoor campus with building-to-building routing as v1, then add interiors, starting with Andrew | Campus is closed, so evacuation maps can't be photographed yet. Outdoor data needs no site visit (D12) |
| 13 | **"Massing model" look** instead of toon shading: one pale tone for all buildings, a flat colored ground, thin line paths | Matches the chosen style reference, and is cheaper to render (D13) |
| 14 | **GPS for the outdoor leg only (proposed):** a live avatar that walks along the route Waze-style when GPS is good, snapped to the route; indoors stays a "mall directory" view where you tap "You are here" | GPS works without internet but not indoors, so the split is outdoor vs indoor, not online vs offline (D14) |

---

## 1. Tech stack (pinned)

| Layer | Choice | Version | License | Status |
|---|---|---|---|---|
| Language | TypeScript strict: `tsc` = **7.0.2** (as `@typescript/native`), tools get **6.0.3** (as `typescript`) | 7.0 / 6.0 | Apache-2.0 | Keep (dual install, D1) |
| Build | Vite | 8.3 | MIT | Keep |
| UI | React | **19.3** (R3F needs `<19.4`) | MIT | Keep |
| 3D | three.js | 0.186 | MIT | Keep |
| 3D in React | @react-three/fiber | 9.8 | MIT | Keep |
| 3D helpers | @react-three/drei | 10.7 | MIT | Keep |
| Camera | `camera-controls` via drei `<CameraControls>` | 3.1 | MIT | **Add** (smooth fly-to, fit-to-box, good touch handling) |
| Picking speed | three-mesh-bvh | 0.9 | MIT | **Add** (fast raycasts on the merged mesh) |
| State | Zustand | 5.0 | MIT | Keep |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) | 4.3 | MIT | Keep |
| UI primitives | shadcn/ui pattern (copy-in) + Radix | — | MIT | **Add** |
| Bottom sheet | react-modal-sheet (+ `motion`) | 5.6 | MIT | **Add** |
| Search palette | cmdk | 1.1 | MIT | **Add** |
| Fuzzy match | @leeoniya/ufuzzy | 1.0 | MIT | **Add** (tiny, tolerates typos like `GK304`) |
| Toasts | sonner | 2.0 | MIT | **Add** ("Ready offline", "Map updated") |
| Icons | Phosphor or Lucide | — | MIT / ISC | **Add** |
| Validation | Zod | 4.6 | MIT | Keep |
| Graph + A* | ngraph.graph + ngraph.path | 1.6 | MIT | **Decided** (handover left it open) |
| Geo utilities (build-time) | @turf/turf, proj4 | 7.4 / 2.22 | MIT | **Add** (split lines, snap doors, project lon/lat→meters) |
| Tracer map | maplibre-gl + terra-draw | 6.14 / 1.37 | BSD-3 / MIT | **Add** (dev tool only, never shipped) |
| PWA | vite-plugin-pwa (Workbox) | 2.0 | MIT | Keep (supports Vite 8) |
| Unit tests | Vitest | 5.0 | MIT | Keep |
| E2E smoke | Playwright | 1.64 | Apache-2.0 | **Add** (search → route → offline reload) |
| Lint/format | ESLint 10 + typescript-eslint `strictTypeChecked` + react-hooks + Prettier | 10 / 8.71 | MIT | Keep (D2) |
| Git hooks | Husky + lint-staged | 9.1 / 17.6 | MIT | Keep |
| Perf overlay (dev) | r3f-perf | 7.2 | MIT | **Add** |
| Hosting | Cloudflare Workers static assets + `_headers` | — | — | **Change** (D5) |
| Later | Capacitor | — | MIT | Keep as optional |

**Rejected options:** MapLibre for the outdoor app view. It would need offline tiles (large), and its 3D is weaker for
the Sims style, so R3F stays for the app. Unity/Godot are rejected per the handover. Navmesh libraries
(`recast-navigation-js`, `three-pathfinding`, both MIT) are rejected for v1: a graph is easier to test and makes it
easier to write directions like "turn left at…". Revisit if hallways get complex.

---

## 2. "Don't reinvent": problem → existing solution

| Problem | Use | Instead of building |
|---|---|---|
| Smooth camera fly-to, follow, pinch/rotate | drei `<CameraControls>` (`setLookAt`, `fitToBox` with `transition`) | Custom tweening |
| Adaptive quality | drei `<PerformanceMonitor>` + `<AdaptiveDpr>` | Manual FPS sniffing |
| Crisp labels | drei `<Text>` (troika SDF) | Canvas textures |
| Soft ground shadow | drei `<ContactShadows frames={1}>` (renders once) | Real-time shadows |
| Soft "weight" where walls meet the ground | Vertex colors darkened near each wall's base, baked when extruding (D13) | Real-time ambient occlusion (too heavy on phones) |
| Merging static meshes | `BufferGeometryUtils.mergeGeometries` | Many separate meshes |
| Shortest path | `ngraph.path.aStar` | Our own A* (we still unit-test our graph *builder*) |
| Typo-tolerant search | uFuzzy over a prebuilt index | Custom Levenshtein |
| Search UI with keyboard + recents | cmdk | Custom listbox |
| Swipeable bottom sheet with snap points | react-modal-sheet | Gesture code |
| Drawing polygons/lines over a photo | Terra Draw on MapLibre + MapLibre `image` source (4 corners). The reference layer underneath is our own OSM snapshot GeoJSON, so no map tile server is needed | Click-to-draw canvas editor |
| Line splitting / snapping | Turf `lineSplit`, `nearestPointOnLine` | Geometry math |
| Offline caching + update prompt | vite-plugin-pwa `registerType:'prompt'` + `useRegisterSW` | Hand-written service worker |
| Avatar, trees, benches | **Kenney** or **Quaternius** low-poly packs (CC0), shrunk with gltf-transform (`prune`, `dedup`, `quantize`). No meshopt/Draco: they need a WebAssembly decoder and a looser CSP, and models this small don't need them | Modeling in Blender |
| Real building footprints | OpenStreetMap buildings around DLSU (ODbL, see section 9) | Guessing from the stylized map |

---

## 3. Reference projects (inspiration; check each license before copying code)

| Project | License | What to borrow |
|---|---|---|
| **mapbox-gl-indoor** (map-gl-indoor) | MIT | Level-switcher UX: it appears only when the viewport intersects a building; floors filter by `level` |
| **Bruno Simon's folio-2019** | MIT | Bouncy camera feel and a small avatar exploring (not its toon colors; D13 sets the look) |
| **pmndrs/drei storybook + R3F examples** | MIT | Ready patterns for CameraControls, ContactShadows, Text, PerformanceMonitor |
| **Open-Location-Stack/floorplan-editor** | check LICENSE | Same stack as our tracer (React + Vite + TS + MapLibre + Biome). Image-overlay corner alignment, IndexedDB autosave, IMDF-style export |
| **kagiura/zephyrus (NUS "Skylark")** | no license shown, so **look only** | Closest sibling: a student-built campus PWA with indoor maps and an IMDF admin editor |
| **indoorequal.org** | **AGPL-3.0, look only, don't copy code** | Mature indoor viewer. Study its level/legend UX |
| **Apple IMDF / OGC IMDF spec** | Open standard | Naming for data: `venue → building → level → unit → opening → amenity`. We use an "IMDF-lite" so a real export is possible later |
| Google Maps / Apple Maps (UX only) | — | Search pill, peek/half/full bottom sheet, route preview card, step carousel, indoor floor rail |
| The Sims "walls down" mode (UX only) | — | Cutaway with low walls, a warm floor color, and a soft outline on the selected room |

---

## 4. Data pipeline

```text
data-src/  (what you edit; committed)          scripts/compile-data.ts           public/data/  (generated)
  campus/buildings.geojson   ──┐               1. Zod-validate every Feature      campus.json        (outdoor + building index + version hash)
  campus/walkways.geojson    ──┤               2. Project lon/lat → local meters  buildings/<id>.json (all floors of one building)
  campus/roads.geojson       ──┼──► compile ──► 3. Split centerlines into graph   search-index.json  (rooms, aliases, amenities)
  floors/<bldg>/<NN>.geojson ──┤               4. Snap doors/exits to nearest line
src/shared/config/room-codes.ts ┘              5. Link verticals across floors
                                               6. Emit graph + report (orphans, dupes, unreachable rooms)
```

- **Room-code table lives in one place:** `src/shared/config/room-codes.ts`. The compiler and the app both import
  it, so they can never disagree.
- **Coordinates:** write in WGS84 (lon/lat) so it lines up with OSM. The compiler projects to local meters
  (origin at a fixed campus corner, x = east, z = south, y = up), as in the handover.
- **Feature types, IMDF-lite:** `building`, `level`, `unit` (room, `type` as in the handover), `opening` (door/exit),
  `vertical` (stairs/elevator with `servesFloors`), `amenity` (cr, fire-exit, water, etc.), `hallway`
  (LineString centerline), `walkway`, `road`, `crossing`, `bridge` (links two buildings' floors).
- **The compile report is a CI gate:** the build fails if any room is unreachable, any door is more than 3 m from a
  hallway, or any vertical has a floor that doesn't exist. This catches tracing mistakes automatically.
- **Runtime:** the app loads `campus.json` at start, then `buildings/<id>.json` when needed. Everything is precached.
  A* runs on the merged graph (a few thousand nodes, well under 5 ms).
- **Evacuation-map photos** live in `data-src/photos/`, which is **gitignored**. We share them through a shared
  folder outside the repo, not Git LFS (LFS's free bandwidth runs out fast, and D11 means no paid tier). They are
  **never shipped** in the PWA.

### 4.1 Coverage: outdoor first, then interiors building by building (D12)

16 buildings come to roughly **100 floors** (Andrew alone has 20), and the campus is currently closed, so no
evacuation maps can be photographed. The app is therefore built to be useful with **zero** indoor data, and
interiors are added one building at a time:

- **v1 (outdoor):** every building, walkway, covered walk, road, gate and crossing, from OSM plus the official
  campus map. Routes go door to door between buildings and end at the target's entrance, with text like
  "Enter Gokongwei by the main entrance. G304 is on 3F: take the elevator or stairs to 3F."
- **Then interiors, Andrew first.** Trace its entrance floor and one typical classroom floor first. Tall buildings
  often repeat the same layout floor after floor, so the tracer can **copy a floor** and only the room numbers get
  edited.
- **A building without indoor data** keeps working exactly like v1.
- The compile report prints a **coverage table** (building → floors traced), and search results label rooms in
  untraced buildings ("G304 · Gokongwei 3F · indoor map coming").

---

## 5. Rendering approach

- **Outdoor:** extrude every footprint, give each building a vertex color, and merge into **one** mesh plus one for
  walkways and one for roads. Keep a `faceIndex → buildingId` table for taps, accelerated with three-mesh-bvh.
  The target is under 15 draw calls outdoors, far below the 100 budget.
- **Entering a building splits it out of the merged mesh.** The merged mesh is rebuilt without that building
  (16 small extrusions, cheap), and the building's own indoor meshes take its place. Without this, the cutaway
  plane below would slice every building on campus, not just the one you're in.
- **Look: a "massing model" (D13).** Every building is the same pale tone and reads by light alone (roofs
  brightest, sunlit walls mid, shaded walls darkest), on a flat colored ground with paths as thin bright lines.
  No windows, textures or outlines.
  - `MeshLambertMaterial` (cheapest lit material) + one `HemisphereLight` + one `DirectionalLight`. No real-time
    shadows.
  - Wall bases are darkened through vertex colors when extruding, which fakes ambient occlusion for free. Add
    `<ContactShadows frames={1}>` if it still looks weightless.
  - **Surrounding city blocks** (OSM footprints within about 300 m, plus Taft Avenue and the LRT line) are drawn in
    the same tone, slightly muted, as one extra non-tappable mesh. They make the campus recognizable from above.
  - **Color carries meaning only:** a single accent color marks the route, the selected building and "you are
    here". The palette is three tokens in `shared/config/` (D13).
  - **Default camera** matches the official campus map's orientation (Taft Avenue along the bottom), since that's
    how students already picture the campus. A small north arrow shows the real direction.
- **Render loop:** `frameloop="demand"`. CameraControls, route animation, and the D-pad call `invalidate()`.
- **Indoor "dollhouse slice":**
  1. Each floor is built from its data: a floor slab, room polygons in the building tone (the destination room in
     the accent color; room types are shown by icons, not colors), and walls extruded to the full floor height.
  2. One `THREE.Plane` (`<Canvas gl={{ localClippingEnabled: true }}>`) sits at `floorY + 1.2 m`. Everything above
     it is cut away, including the roof, upper floors, and the tops of walls. That gives the Sims look with no special
     wall geometry.
     **Only the active building's materials get the plane.** The avatar (about 1.7 m tall, taller than the cut),
     room labels, route ribbon, outdoor meshes and UI use unclipped materials. The route ribbon is drawn for the
     current floor only.
  3. **Enter transition:** animate the plane from the roof down to `floorY + 1.2` over about 600 ms while the camera
     tilts in. This is the signature moment of the app.
  4. Wall caps: draw the backfaces in a darker tone (`side: DoubleSide`) so cut walls read as solid.
  5. Floors below show as flat outlines only (no transparency, which avoids sorting cost and overdraw).
- **Labels:** drei `<Text>` only for the current floor's rooms, hidden below a zoom threshold. Show only the selected
  room when zoomed out.
- **Route line:** a ribbon mesh (flat triangle strip) on the ground with a scrolling dash shader. The dash animation
  only runs while a route is active.
- **Avatar:** a CC0 low-poly figure (Kenney/Quaternius) or a 3D pin. Keep it under 2k triangles. Quantize it with
  gltf-transform; three.js reads that natively with no decoder.
- **Quality tiers:** `PerformanceMonitor` drops DPR 2 → 1.5 → 1 and hides the surrounding city blocks on the lowest
  tier.

---

## 6. UX

### 6.1 Main screen (map-first, one sheet)

```text
┌───────────────────────────────┐
│ ( 🔍  Where to?  e.g. B305  ) │ ← search pill → full-screen cmdk palette
│ [📍 Andrew Hall · 3F  ▾]      │ ← "You are here" chip (tap to change)
│                               │
│                          ┌──┐ │
│        3D CAMPUS /       │5F│ │ ← floor rail (indoor only, thumb side)
│        INDOOR SLICE      │4F│ │
│                          │3F│●│
│                          │2F│ │
│                          └──┘ │
│                         [ ⌖ ] │ ← recenter on me / route
├───────────────────────────────┤
│ ▔▔▔▔                          │ ← react-modal-sheet: peek / half / full
│ G304 · Gokongwei Hall 3F      │
│ ~4 min · 230 m · via elevator │
│ [        Start  ▶        ]    │ ← 56px primary button, the one obvious action
│ Route options ▾               │ ← collapsed: Stairs/Auto/Elevator, Exit
└───────────────────────────────┘
```

Before any search, the sheet shows a single hint, "Search a room, like G304", plus Recents. That hint replaces a
tutorial.

### 6.2 Flows

1. **First open:** no intro cards. The map opens with the search pill at the top and the "Search a room" hint in
   the sheet. If the user searches without setting a location, the app asks "Where are you?" at that
   moment, which is the only time it matters.
2. **Ask bar (type or keyboard-mic):** *"nasa B305 ako, papunta G304"* → rule-based parser (D9) → **confirm
   screen**: `From [chip] → To [chip]`, then **Go**. Either chip opens the pickers below to correct it.
3. **Where are you?** (tap flow, D8)
   - **Pick building** (color tiles or tap the map) → **floor** → it defaults to the main entrance (ground floor) or
     the elevator lobby (other floors).
   - Optional precision chips: `Elevator` · `Stairs (North/South…)` · `Entrance: Main/Side/Back` ·
     `Near room…` · `Tap on map`.
   - **Outside:** pick a **gate** (Gate 1 South … Agno Gate, from OSM), tap the map, or "I just left ___".
   - **Deep link / QR** (optional, D7): opens with `from` already set.
4. **Where to?** cmdk palette with three sections: **Recents**, **Matches** (rooms, buildings, amenities like "CR",
   "elevator"), and a **Did you mean** list from uFuzzy when parsing fails.
5. **Route preview:** the camera does `fitToBox(route)` and the sheet shows a summary. Changing anything under
   **Route options** re-routes instantly:
   - **Stairs / Auto / Elevator** (this route only). Costs are in seconds (D34, which replaces the meter-equivalents
     first written here): stairs 20 s a floor, elevator 3 min wait + 5 s a floor. **Auto** takes the elevator for 3
     or more floors.
   - **Exit:** main by default, or another exit of the building.
6. **Step mode:** the sheet turns into a step carousel (swipe or Next/Back). Each step is an icon, one line of text,
   and a distance. The camera flies to each step. Indoor and outdoor views switch automatically at entrance and exit
   steps.
7. **Explore mode (optional, fun):** a Game-Boy-style D-pad that walks the avatar along the route, with haptic ticks
   on Android (`navigator.vibrate`).

### 6.3 Direction text (generated, not hand-written)

- Collapse straight runs, then classify the turn angle at each node: straight under 30°, slight 30–60°, turn 60–135°,
  sharp over 135°. Only junctions are steps, and jogs under 15 m apart merge (D35).
- Attach the nearest labelled feature as a landmark: "Turn left after **CR**", "Pass **B310** on your right".
- Special node types produce special text: verticals ("Take the elevator to **5F**"), exits ("Exit via the
  **main entrance**"), crossings ("Cross **Taft Ave** at the crosswalk"), bridges.

### 6.4 Accessibility and comfort

- **Avoid stairs** is a saved setting, separate from the per-route Stairs/Elevator choice. It removes *every* step
  from routing: stairwells, outdoor steps, and stepped skybridges. Routes then use elevators and ramps only, and if
  no step-free route exists the app says so instead of quietly using stairs.
- `prefers-reduced-motion`: replace camera flights with cuts and skip the slice animation.
- **Text-only directions** always work. If WebGL fails or is too slow, the app falls back to a 2D list with
  floor/turn icons.
- Tap targets of at least 48 px, text of at least 16 px, WCAG AA contrast for text over the map (labels get a
  backing plate if the ground color is strong), and the floor rail on the right for thumbs.

---

## 7. Innovation shortlist (and when)

| Idea | Effort | Phase |
|---|---|---|
| **Ask bar:** rule-based English/Taglish parser + confirm chips (D9 Tier 1) | M | 3 |
| Phrase test set (~100 real student phrases) as a release gate | S | 3 |
| Deep links (`?from=` / `?to=`), which also give shareable "meet me at G304" links; per-room QR stickers only if Facilities approves (D7) | S | 5 |
| Opt-in on-device model (WebLLM, Apache-2.0 model, JSON-only output), only if the parser scores < 90% (D9 Tier 2) | L | after 10 |
| Dollhouse-slice enter animation | M | 8 |
| Auto-built graph + compile report as CI gate | M | 2/4/9 |
| **Time-of-day elevator cost** (e.g. a higher wait just before class start times), so "Auto" prefers stairs at peak times. Constants live in config, no live data | S | 10 |
| "My classes": paste a class schedule *text* → saved locally → one-tap "Route to next class" (no account, no upload). Works in v1 too, since routes end at the right building and floor | M | after 6 |
| "Find nearest CR / water / elevator" from current location | S | 9 |
| Visual landmark photos per step (only if they stay within the 15 MB budget) | M | later |

---

## 8. Revised folder structure (for approval)

```text
dlsu-map/
  src/
    app/                 App shell, providers, URL ↔ state sync (deep links)
    features/
      campus-scene/      Merged outdoor meshes, picking, camera rig
      indoor-view/       Floor builder, clipping slice, floor rail
      search/            Room-code parser, uFuzzy index, cmdk palette
      location-picker/   "Where are you?" flows, QR deep-link handling
      routing/           Graph loader, A* wrapper, cost config, direction text
      route-player/      Step carousel, follow-cam, D-pad, avatar
      offline/           SW registration, update/offline toasts, iOS install hint
    shared/
      data/              Zod schemas (shared with compiler + tracer), loader, types
      geo/               Projection, polygon/line helpers
      three/             Materials, extrusion/ribbon builders, clipping helper
      ui/                Sheet, Button, SegmentedControl, Toast wrappers
      config/            Tunables, room-code prefixes/aliases, palette
  data-src/              Hand-edited GeoJSON source of truth (ODbL, D4)
    campus/              buildings, walkways, roads; osm/snapshot-<date>.geojson
    floors/<building>/<NN>.geojson
    photos/              Evacuation-map photos (gitignored, never shipped)
    LICENSE              ODbL
  scripts/
    fetch-osm.ts         Saves a pinned OSM snapshot (run by hand, D4)
    compile-data.ts      data-src → public/data (+ report, coverage table)
  public/
    data/                Generated, precached
    fonts/               Self-hosted fonts for UI and drei <Text> (D5)
    icons/  models/      PWA icons, CC0 glTF (avatar, trees)
    _headers             CSP + security headers (D5)
  tools/
    tracer/              Dev-only MapLibre + Terra Draw tracer (own Vite entry)
  tests/
    e2e/                 Playwright smoke tests
  docs/
    HANDOVER.md  PLAN.md  DECISIONS.md  ARCHITECTURE.md  DATA-GUIDE.md (how to trace a floor)
    reference/           Official campus map + style reference images (gitignored, D6/D13)
  .github/workflows/ci.yml   eslint · prettier --check · tsc · vitest · compile-data · build · playwright · preview deploy
  .github/dependabot.yml     3D stack grouped (D3)
  .husky/  eslint.config.js  .prettierrc  vite.config.ts  tsconfig.json  wrangler.jsonc
  README.md  SUMMARY.md  LICENSE (MIT, code)  ATTRIBUTION.md (© OpenStreetMap contributors)
```

Inside each feature, **logic and UI are separate files**. For example, `search/` has `parse-room-code.ts` and
`parse-ask.ts` (pure functions, unit-tested) and `SearchPalette.tsx` (UI only, calls the parser).

Rules from the handover still apply: one responsibility per file, no routing logic in 3D components, and data
access only via `shared/data`. Added rule: **feature folders only import from `shared/` or a feature's `index.ts`.**

---

## 9. Risks and gotchas

**Resolved 2026-10-18. Details and evidence are in `docs/DECISIONS.md`:**

- TypeScript 7 vs tooling → dual install: `tsc` = 7.0, tools = 6.0 (D1). Tested on the full stack.
- Lint → ESLint + Prettier kept (D2). React → pinned `~19.3.1`, with the 3D stack grouped in Dependabot (D3).
- OSM license → code MIT, all campus data ODbL, pinned snapshot, on-map credit (D4). OSM already has all 16
  buildings, 4 skybridges, 9 gates, and some elevators.
- Hosting → Cloudflare Workers static assets with `_headers` CSP and per-PR previews (D5).
- New: drei `<Text>` downloads fonts from a CDN unless given a self-hosted `font`. That breaks offline use and the
  CSP, so always pass one (D5).
- New: OSM counts the ground floor as `level=0`. The compiler needs a per-building floor-offset table (D4).

**Still open:**

- **GPS (D14):** accuracy near tall buildings and under covered walks is unknown until tested on site. The `_headers`
  `Permissions-Policy` must allow `geolocation=(self)` or GPS fails silently. iPhone needs a separate, tap-triggered
  permission for the compass. Stop `watchPosition` whenever no route is active, to save battery.
- **Room-code prefixes:** "B = Andrew" may be wrong. The handover rightly says not to guess. The most reliable source
  is the room column in the official enlistment and class-schedule system, which shows the exact strings students
  will type. Build the parser to be table-driven with many aliases per building.
- **The precache leaves files out by default.** Workbox's default `globPatterns` is `**/*.{js,wasm,css,html}`,
  and it skips any file over 2 MiB, both silently. Our `.json` data, `.woff2` fonts and `.glb` models would not be
  saved offline. Phase 1 sets `globPatterns` to include them and raises `maximumFileSizeToCacheInBytes`. CI checks
  that every file in `dist/data/` is in the generated precache manifest.
- **Indoor data rights:** see D4. Building is fine; a **public launch** waits on Facilities' OK.
- **iOS Safari** may clear PWA storage after weeks of no use, and has no install prompt. Call
  `navigator.storage.persist()`, show the "Add to Home Screen" hint, and re-validate the cache version on every
  launch.
- **Service worker in dev** causes stale-cache confusion. Enable it only in `preview`/production builds (`devOptions`
  off by default).
- **Clipping planes** affect every material that opts in. Keep the plane on a shared material set in `shared/three/`
  so UI overlays aren't clipped by accident.
- **Building entrances** aren't confirmed while the campus is closed. Use OSM `entrance=*` points where they exist,
  otherwise estimate from the official map and tag them `verified: false`. Directions to an unverified entrance
  say "main entrance (approximate)" until someone confirms it on site.
- **Official map vs OSM** (D6): the official map lists buildings that aren't in the handover's 16 (Retreat House,
  Legal Aid Clinic, Bahay Kanlungan, and more). Decide which ones v1 shows.

---

## 10. Revised phases (stop for review after each)

**Part A: outdoor v1** (needs no campus access)

| Phase | Deliverable | Changed? |
|---|---|---|
| 1. Skeleton | Vite + React + TS (dual 7/6, CI asserts `tsc -v` is 7.x) + R3F; ESLint, Prettier, Husky, Vitest, CI; **Cloudflare preview per PR + CSP headers**; self-hosted font; **basic PWA precache with `globPatterns` fixed + CI check**; Zod schemas; `ARCHITECTURE.md`; empty scene with CameraControls on mobile | + hosting/PWA moved earlier |
| 2. Outdoor campus | OSM footprints, walkways, covered walks, roads, gates, skybridges, surrounding blocks → `data-src/campus/*.geojson`; `compile-data.ts`; merged scene in the massing-model look (D13), palette compared on real phones; tap a building to see its name and floor count | + compiler, + look |
| 3. Search + Ask | Room-code parser + tests (resolves to **building + floor**, no interiors needed), uFuzzy index, cmdk palette, **English/Taglish ask parser + phrase test set + confirm chips**, highlight building/floor | + Ask bar |
| 4. Outdoor routing | Graph from walkway centerlines, gates, building entrances (`verified` flag), street crossings (Taft, Fidel Reyes/Agno), A* tests, route ribbon, directions ending in "G304 is on 3F" | **New split** (was part of Routing) |
| 5. Location + player | Tap picker for building/gate (D8), deep links (QR optional), step carousel, follow-cam; **"Use my location" chip, live GPS follow mode with route snapping, off-route re-route, GPS-weak fallback to steps, walking avatar (D14)**, tested with DevTools location override and replayed GPS tracks | QR demoted, + GPS (D14) |
| 6. Offline polish → **v1 release** | Update prompt, "Ready offline" toast, iOS hint, `storage.persist`, airplane-mode tests on iOS + Android (including GPS follow in airplane mode) | Moved up: v1 ships here |

**Part B: interiors** (starts when the campus reopens and evacuation maps can be photographed)

| Phase | Deliverable | Changed? |
|---|---|---|
| 7. Tracer | MapLibre + Terra Draw tool over the OSM snapshot, 4-corner photo alignment, hallway centerlines, **copy floor**; trace Andrew's entrance floor + one typical floor; time it to estimate the rest (§4.1); `DATA-GUIDE.md` | Rebuilt on libraries |
| 8. Indoor view | Floor builder, clipping slice + enter animation, floor rail, auto switch (Andrew) | + slice animation |
| 9. Indoor routing | Hallway graph, verticals/`servesFloors`, skybridges, joined to the outdoor graph at entrances; landmark directions; nearest CR; precision chips in the picker (D8); D-pad | Split from Routing |
| 10. Polish | Visual pass, quality tiers, a11y audit, time-of-day elevator cost, reduced-motion | + small extras |

---

## 11. Decisions I need from you

1. **Approve the folder structure** in section 8 (the handover requires this before code).
2. **Confirm D1–D13** in `docs/DECISIONS.md` (or push back on any of them).
3. **Pick the palette** for the massing-model look (D13, options A/B/C).
4. **Which extra buildings** from the official map v1 should show (D6).
5. Start collecting **real phrases** classmates would type (English, Filipino, Taglish), even 20–30 to begin with.
6. **Get the room-code prefixes** from the enlistment/class-schedule system. That's online, so it doesn't need the
   campus to be open.
7. Create a free **Cloudflare account** before Phase 1 (we connect it together, no secrets in the repo).
8. **Review D14** (live GPS avatar outdoors, mall-directory view indoors). It reverses "no GPS" for the outdoor leg.

---

## Sources

- [mapbox-gl-indoor (MIT)](https://github.com/mapbox-gl-indoor/mapbox-gl-indoor) · [OSM wiki entry](https://wiki.openstreetmap.org/wiki/MapGL_Indoor_Plugin)
- [Bruno Simon folio-2019 (MIT)](https://github.com/brunosimon/folio-2019)
- [Open-Location-Stack/floorplan-editor](https://github.com/Open-Location-Stack/floorplan-editor)
- [kagiura/zephyrus (NUS Skylark)](https://github.com/kagiura/zephyrus)
- [indoorequal.org (AGPL-3.0)](https://github.com/indoorequal/indoorequal.org)
- [GitHub topic: imdf](https://www.github.com/topics/imdf)
- [OGC Indoor Mapping Data Format](https://docs.ogc.org/cs/20-094/) · [Apple IMDF](https://register.apple.com/resources/imdf/)
- [Terra Draw](https://www.jsdelivr.com/package/npm/terra-draw)
- [vite-plugin-pwa](https://npmjs.com/package/vite-plugin-pwa)
- npm registry (`npm view`) for all versions, licenses, peer dependencies, and publish dates, checked 2026-10-18
