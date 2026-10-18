# Handover: DLSU 3D Campus Navigator

> **This is the original brief, kept for history.** It was written as instructions for Claude Code.
> [`PLAN.md`](PLAN.md) updates it, and PLAN.md wins wherever they differ (stack versions, hosting, data format,
> folder structure, phases). Start with [`../SUMMARY.md`](../SUMMARY.md) if you're new.

You (Claude Code) are building a mobile-first, offline-capable 3D campus map for De La Salle University (Manila). A student types a room code like `B305` and the app shows a route to it, outdoors across campus and indoors floor by floor, in a stylized "Sims-style" view.

**Before writing any code:** read this whole file, propose the folder structure (section 6), and wait for my approval. Then build in the phases in section 10, one phase at a time, and stop for review after each.

A stylized campus map image is attached alongside this file. Use it for building names, rough relative placement, and walkway layout. It is **not to scale**.

---

## 1. Goals

1. Search a room code (e.g. `B305`) and get a route to it.
2. Outdoor 3D campus: buildings as simple stylized blocks, walkways, roads.
3. Indoor "Sims-style" view: when inside a building, hide the roof and upper floors and show the current floor as a cutaway with low walls and labeled rooms.
4. Works **fully offline** after the first load. Campus Wi-Fi is unreliable, especially indoors.
5. Smooth on mid-range iOS and Android phones (target 60 fps, acceptable 30 fps on low-end).
6. No GPS. Location is chosen by the user (see section 4).

## 2. Non-goals (for now)

- No live GPS or indoor positioning (no Wi-Fi/BLE beacons).
- No user accounts, no backend, no database.
- No photorealism. Clean, low-poly, stylized look.

---

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) | Typed data models for buildings/floors/graph |
| Build | Vite | Fast, small bundles, good PWA plugin |
| UI | React 18+ | Component model for search, pickers, panels |
| 3D | three.js via **React Three Fiber** + **@react-three/drei** | Mature WebGL, works on iOS Safari and Android Chrome |
| State | Zustand | Small, simple global state (current location, route, view mode) |
| Styling | Tailwind CSS | Fast mobile UI |
| Offline | **vite-plugin-pwa** (Workbox) | Precache app + all campus data; installable to home screen |
| Validation | Zod | Validate campus JSON at load and in tests |
| Pathfinding | Custom A* over a typed graph (or `ngraph.path`) | Small graph; keep it testable |
| Tests | Vitest | Unit tests for pathfinding, room-code parsing, data validation |
| Lint/format | ESLint + Prettier, Husky pre-commit | From day one |
| Hosting | Vercel, Netlify, or GitHub Pages (HTTPS) | Free static hosting; HTTPS is required for service workers |
| Optional later | Capacitor | Wrap the same app for App Store / Play Store if needed |

Do **not** use Unity/Godot/native apps. One web codebase must run on both iOS and Android and be shareable via a link or QR code.

---

## 4. Core UX flows

### 4.1 "Where are you?" (no GPS)
The user sets their location in one of these ways:
1. Pick a building (tap it on the 3D map or choose from a list), then pick a floor.
   - Avatar is placed at that floor's **default start point** (usually the elevator lobby).
2. Optional override: tap a spot on the floor plan, or choose "I'm near room ___".
3. If outside: pick "Outside" and tap a spot on the campus map, or pick the building they just left (avatar starts at that building's main exit).

### 4.2 "Where to?"
- Type a room code (`B305`) or pick a building/room from search.
- Parse the code into building + floor + room (see section 5.4).
- Show an error with suggestions for unknown codes.

### 4.3 Route
A route is a chain of segments:
`start point → (stairs | elevator) → floor of exit → building exit → outdoor walkways → target building entrance → (stairs | elevator) → target floor → room door`

- Same-building and same-floor routes skip the unneeded segments.
- Default exit = the building's **main** exit, but let the user pick another exit.
- Toggle: **Stairs / Elevator / Auto** (Auto = elevator if floor difference > 3).
- Show the route as a glowing line on the ground plus step-by-step text directions ("Take the elevator to 3F", "Exit via the main entrance", "Turn left at the hallway").

### 4.4 Following the route
- "Next / Back" buttons step through directions; the camera follows.
- Optional **Game Boy-style D-pad** to walk the avatar along the route manually.
- Entering a building switches to the indoor cutaway view automatically; leaving switches back.

### 4.5 Views
- **Outdoor:** isometric/perspective camera over campus, pinch-zoom, rotate, pan.
- **Indoor:** current floor only, roof and floors above hidden, floors below faded/hidden. Floor switcher (1F, 2F, ...) on the side.

---

## 5. Data model

All campus data is static JSON under `public/data/` (or `src/data/`), validated with Zod. Geometry is **generated procedurally from this data**, not hand-modeled.

Use one local coordinate system in **meters**, origin at a fixed campus corner, x = east, z = south, y = up.

### 5.1 `campus.json`
```jsonc
{
  "version": "2026-10-01",
  "buildings": [
    {
      "id": "andrew",
      "name": "Br. Andrew Gonzalez Hall",
      "code": "B",                 // room-code prefix (see 5.4)
      "footprint": [[x,z], ...],  // polygon, meters
      "floors": 20,               // TODO: confirm
      "floorHeight": 3.5,
      "color": "#2f5d3a",
      "exits": [
        { "id": "andrew-main", "pos": [x,z], "floor": 1, "main": true },
        { "id": "andrew-side", "pos": [x,z], "floor": 1, "main": false }
      ]
    }
  ],
  "walkways": [ { "id": "w1", "path": [[x,z], ...], "width": 3 } ],
  "roads":    [ { "id": "r1", "path": [[x,z], ...], "width": 8 } ]
}
```

### 5.2 Per-floor files: `floors/<buildingId>/<floor>.json`
```jsonc
{
  "building": "andrew",
  "floor": 3,
  "defaultStart": "andrew-3-elevlobby",
  "rooms": [
    { "id": "305", "label": "B305", "type": "classroom", "polygon": [[x,z], ...], "door": [x,z] }
  ],
  "walls":    [ { "from": [x,z], "to": [x,z] } ],
  "verticals": [
    { "id": "andrew-elev-a", "type": "elevator", "pos": [x,z], "servesFloors": [1,2,3,4,5] },
    { "id": "andrew-stair-n", "type": "stairs", "pos": [x,z], "servesFloors": [1,2,3,4,5] }
  ],
  "amenities": [ { "type": "cr", "pos": [x,z] }, { "type": "fire-exit", "pos": [x,z] } ],
  "nodes": [ { "id": "andrew-3-elevlobby", "pos": [x,z] } ],
  "edges": [ ["andrew-3-elevlobby", "andrew-3-hall-1"] ]
}
```
Room types: `classroom`, `lab`, `office`, `cr`, `stairs`, `elevator`, `lobby`, `other`.

### 5.3 Navigation graph
- Built at load time by merging: outdoor walkway nodes, building exits, every floor's nodes, room doors, and vertical connectors (stairs/elevators link the same connector across floors).
- Edge cost = distance in meters. Vertical edges: stairs ≈ 15 m-equivalent per floor, elevator ≈ fixed 30 m-equivalent wait + 3 per floor (tunable constants in one config file).
- Road crossings are edges flagged `crossing: true` so directions can say "Cross the street".
- Respect `servesFloors` for stairs and elevators.

### 5.4 Room codes
- Format: `<prefix><floor><room>`, e.g. `B305` = Andrew, 3rd floor, room 05. Floors ≥ 10 use two digits (`B904` vs `B1004`).
- Prefix table lives in one config file, with alias support (e.g. lowercase, spaces, "AG305").
- **Known issue:** several buildings start with "B" (Br. Andrew, Br. Bloemen, Br. Connon, Br. John). `B` = Br. Andrew for now. **TODO: confirm official DLSU prefixes for every building** and fill the table. Do not guess; leave unknowns as `TODO`.

---

## 6. Proposed folder structure (organize by feature)

```
src/
  app/                 App shell, routes, providers
  features/
    campus-scene/      Outdoor 3D: building extrusion, walkways, roads, camera
    indoor-view/       Floor cutaway rendering, floor switcher
    search/            Room-code parser, search UI, suggestions
    location-picker/   "Where are you?" flows
    routing/           Graph builder, A*, direction text generation
    route-player/      Next/Back stepping, D-pad, avatar movement
    offline/           PWA registration, update prompt, data version check
  shared/
    data/              Zod schemas, data loader, types
    ui/                Buttons, sheets, panels
    config/            Tunable constants, room-code prefixes, colors
public/
  data/                campus.json, floors/**
tools/
  tracer/              Dev-only floor-plan tracing tool (see section 9)
ARCHITECTURE.md        What lives where and why (create this)
```
Rules: one responsibility per file; 3D components don't contain routing logic; data access only via `shared/data`.

---

## 7. Rendering and performance (mobile budget)

- Generate buildings by extruding footprints (`ExtrudeGeometry` or custom). Merge static outdoor geometry into as few meshes as possible.
- Target < 100 draw calls outdoors, < 150 indoors.
- Cap device pixel ratio at 2 (`dpr={[1, 2]}`), lower to 1.5 on weak devices if frame time is high.
- Use simple materials (`MeshLambertMaterial` / `MeshToonMaterial`), no real-time shadows by default; fake soft shadows with a baked contact-shadow decal or drei `ContactShadows` rendered once.
- Text labels: drei `Text` (SDF) or HTML overlays only for nearby/selected items, not all rooms at once.
- Load only the active building's floors into the scene; unload others.
- Visual style: match the attached map (greens, soft cream walkways, rounded friendly UI). Avatar is a simple stylized low-poly figure or a pin.
- Test on a real iPhone (Safari) and a mid-range Android (Chrome) every phase.

---

## 8. Offline (PWA)

- `vite-plugin-pwa` with `registerType: 'prompt'`. Precache the app shell **and every file in `public/data/`**.
- After first load on Wi-Fi/data, everything works with zero network.
- Show a small "Ready for offline use" toast once caching finishes.
- Data versioning: `campus.json.version`; when a new build is deployed, prompt "Map updated, reload?".
- Web app manifest with icons, `display: standalone`, theme color green. Add an in-app "Add to Home Screen" hint for iOS (Safari has no install prompt).
- Keep total precache small (aim < 15 MB) so first load is fast on mobile data.

---

## 9. Floor-plan tracing tool (dev-only)

Source floor plans are **photos of the fire evacuation maps** posted on each floor (they show rooms, CRs, stairs, fire exits). They are not to scale.

Build `tools/tracer/` as a simple browser tool (not shipped to users):
- Load a photo as a background; set scale by clicking two points and entering the real distance.
- Rotate the image to match campus orientation.
- Click to draw room polygons, walls, doors, hallway nodes/edges, stairs, elevators, CRs, fire exits.
- Set room id/label/type in a side panel.
- Export/import the floor JSON (section 5.2). Validate with the same Zod schema.

Photos will be named like `andrew_03F.jpg`.

---

## 10. Build phases (stop for review after each)

1. **Skeleton:** Vite + React + TS + R3F, lint/format/pre-commit, Vitest, Zod schemas, `ARCHITECTURE.md`. Empty scene with camera controls on mobile.
2. **Outdoor campus:** `campus.json` with all buildings as rough boxes placed from the attached map; walkways and roads. Tap a building to see its name.
3. **Search:** room-code parser + tests; search bar highlights the target building/floor.
4. **Tracer tool:** build section 9; trace one floor of Br. Andrew as a sample.
5. **Indoor view:** cutaway floor rendering for the sample building; floor switcher; auto switch when "entering".
6. **Routing:** graph builder + A* + tests (same floor, multi-floor, building to building, stairs vs elevator, `servesFloors`); route line + text directions.
7. **Location picker + route player:** "Where are you?" flow, default start points, Next/Back, D-pad.
8. **Offline PWA:** precaching, update prompt, install hint. Test in airplane mode on iOS and Android.
9. **Polish:** visuals, performance pass, accessibility (large tap targets, readable text, color contrast).

---

## 11. Engineering standards

- TypeScript strict; no `any` without a comment explaining why.
- ESLint + Prettier, enforced by a pre-commit hook.
- Unit tests for the risky logic: room-code parsing, graph building, A*, data validation.
- CI (GitHub Actions): lint + typecheck + test + build on every PR.
- Conventional commits (`feat:`, `fix:`, `refactor:`, `chore:`), small commits.
- Security: this is a static site with no backend and no secrets. Do not add analytics, trackers, or any API keys. Add a basic Content Security Policy. Never commit `.env` files.

---

## 12. Open questions / TODO for me (the student)

- [ ] Official room-code prefix for every building.
- [ ] Floor counts per building (and basements/mezzanines).
- [ ] Which elevators/stairs serve which floors.
- [ ] Main and side exits per building; which are actually open.
- [ ] Bridges or connections between buildings.
- [ ] Real footprints/scale (trace from OpenStreetMap or satellite view; the attached map is stylized).
- [ ] Photos of evacuation maps for each floor, named `<building>_<NN>F.jpg`.
- [ ] Ask Facilities/Physical Plant office for official floor plans (PDF/CAD) if possible.

## 13. Buildings on the attached map

Br. John Hall, St. La Salle Hall, Br. Connon Hall, Yuchengco Hall, Faculty Center, William Hall, St. Joseph Hall, Henry Sy Sr. Hall, Velasco Hall, Br. Bloemen Hall, St. Miguel Hall, St. Mutien Marie Hall, Science and Technology Research Center, Enrique M. Razon Sports Center, Gokongwei Hall, Br. Andrew Gonzalez Hall.
