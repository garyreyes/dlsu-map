# DLSU 3D Campus Navigator: Project Summary

> **Status:** plan approved on 2026-10-19 (D15–D24 agreed); Gate 0 done; 1a, 2a and 3a are in. Next are
> 1b–1d (Lane A) and 2b (Lane B), per [`docs/ROADMAP.md`](docs/ROADMAP.md).
> **Looking for:** a second pair of eyes on the plan. See [How you can help](#how-you-can-help).

Detailed docs: [`docs/PRD.md`](docs/PRD.md) (what and for whom) · [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
(stack, data, folders) · [`docs/user-flows.md`](docs/user-flows.md) (every screen) ·
[`docs/ROADMAP.md`](docs/ROADMAP.md) (build order) · [`docs/SPLIT.md`](docs/SPLIT.md) (who does what) ·
[`docs/DECISIONS.md`](docs/DECISIONS.md) (every decision, with evidence).

Room codes in examples are real formats: `ST311` is in STRC (its lobby directory prints it as `C311`), `AG1104` is
in Andrew. The prefix table is in `docs/ARCHITECTURE.md` §3.3.

---

## What it is

A free 3D map of De La Salle University (Manila) for your phone that gets you to any room.

- Type a room code like **`ST311`** and see the building and floor at once: "ST311 · Surface Physics Lab · STRC 3F".
- Say where you are (type the room you're in, or tap a building and floor) and get a route: across campus to the
  right entrance, then **inside the building floor by floor** (stairs or elevator).
- Inside a building the view becomes a **cutaway**: the roof and upper floors are sliced off so you see the current
  floor from above.
- Works **fully offline** after the first open, because campus Wi-Fi and signal are unreliable, especially indoors.
- Runs in the phone's browser on **iPhone and Android**. No app store, no account.

## Why

Freshmen have about 15 minutes between classes and often don't remember which building, and which floor, the next
room is in. Existing maps show buildings, not floors or rooms, need signal, and don't explain what a room code like
`C311` means.

---

## How it works (for users)

1. **Open the link once** with any connection. The app and campus map save to the phone, and "✓ Ready offline"
   confirms it. Optional: Add to Home Screen.
2. **Type where you're going** in the search bar: a room code (`ST311`, `st 311`, `C-311` all work) or a building
   name. A code that isn't in the list is rejected with "Did you mean…", never guessed.
3. **Say where you are**, asked only when it's needed:
   - **Type the room you're in** (`AG1104`), or
   - **Tap a building, then a floor.** Ground floor starts at the main entrance, other floors at the elevator lobby.
   - **Outside?** Pick a gate (Gate 1–6, Agno) or "next to a building".
4. **Check the route preview** (*From → To*, time, distance) and tap **Start**.
5. **Follow the steps** with Next/Back: "Exit STRC by the main entrance", "Take the east stairs to 3F". The view
   switches between campus and building cutaway by itself. **Route options** (collapsed): Stairs / Elevator / Auto.
   Auto takes the elevator for 3+ floors.

There's no intro tutorial. The first screen just says "Type a room, like ST311". Where you are is never stored and
never leaves the phone.

**v1 covers the whole campus outdoors plus full indoor maps of 10 buildings** (D15, D20): St. La Salle, Yuchengco,
St. Joseph, Velasco, St. Miguel, Andrew, STRC, Razon, Gokongwei and Mutien-Marie. The other buildings are shown as
named blocks.

---

## How it's built (for developers)

### Stack

All open source with permissive licenses, mostly MIT. Full table: `docs/ARCHITECTURE.md` §2.

| Part | Choice |
|---|---|
| App | **TypeScript** + **React 19.3** (pinned) + **Vite 8**, styled with **Tailwind 4** |
| 3D | **three.js** via **React Three Fiber** + **drei** |
| State / validation | **Zustand** / **Zod** |
| Route finding | **ngraph.path** (A* over hallways, walkways, stairs, elevators) |
| Search | Our room-code parser, a one-typo check for "Did you mean", plain lists (D38) |
| Offline | **vite-plugin-pwa** (service worker caches everything) |
| Floor extraction (dev only) | **opencv-js + sharp**: evacuation-map photo → draft floor plan |
| Quality | **Vitest**, **Playwright**, **ESLint + Prettier**, Husky, one GitHub Actions gate (`gates`) |
| Hosting | **Cloudflare** (free, static files only), a preview link per pull request |

There is no backend, database, account system or analytics. The app is static files plus a compiled map data bundle.

### Where the map data comes from

- **Buildings outdoors:** real footprints from **OpenStreetMap**, saved as a fixed snapshot in the repo and never
  downloaded while the app runs.
- **Place names and walkways:** the official DLSU campus layout map. It's not to scale, so positions come from OSM.
- **Room codes and names:** each building's **lobby directory**, photographed and typed into a CSV.
- **Floor plans:** each floor's **fire evacuation map**, photographed, turned into a draft by a script, cleaned up by
  Claude, then checked by a person in a 3D preview (D17). The photos never go into the repo or the app.
- **A data compiler** checks everything and **fails the build** on duplicate room codes, impossible floors, or any
  room that can't be reached.

### How it looks

- **The interface works like Google Maps:** a full-screen map, a floating search bar, one bottom sheet, round map
  buttons. One fixed green marks the selection, the found floor and "you are here". No Google or DLSU marks.
- **The map is a "massing model"** (D13): every building one pale colour shaped by light, on a flat ground with thin
  paths. The ground is deep green with warm white buildings (D13, settled 2026-10-21). Details: `docs/DESIGN.md`.
- **Signature:** the found room's floor drawn as a green band around the building, with a floor chip.

### Key techniques

- **One mesh for all outdoor buildings** (about 1 draw call), and the app **only redraws when something changes**.
  Both help phone battery and frame rate.
- **Cutaway view:** one GPU "clipping plane" slices only the building you're in, just above the current floor.
- **A text-only mode** (the full step list) always works, including on phones where 3D fails.

A phone-testable prototype of the map home screen is in `prototypes/map-home/`. It's a design reference, not app
code (it loads three.js from a CDN, which the real app must not do).

---

## Key decisions (short version)

Full reasoning and evidence: [`docs/DECISIONS.md`](docs/DECISIONS.md). D15–D24 were agreed by the team on
2026-10-19, D25–D27 and D33 on 2026-10-20, D28–D32 and D34–D37 on 2026-10-21, D38–D42 on 2026-10-22.

| # | Decision | Why |
|---|---|---|
| D1 | Install **TypeScript 7** for type-checking and **TypeScript 6** for tools | TS 7 has no plugin API yet, so ESLint needs 6 |
| D2 | **ESLint + Prettier** (not Biome) | In testing, ESLint caught real bugs Biome missed |
| D3 | **Pin React to 19.3.x**, upgrade the 3D libraries together | React Three Fiber breaks on React 19.4 |
| D4 | **OpenStreetMap** footprints. Code is MIT, map data is ODbL with an on-map credit | Real positions; licenses handled properly |
| D5 | **Cloudflare** hosting with a strict security policy (CSP) | GitHub Pages can't set security headers or give preview links |
| D6 | **The official campus map** for place names, streets and orientation only | It's not to scale |
| D7 | **QR stickers are optional**, deep links stay | Stickers need university approval |
| D8 | **Tap flow** for "Where are you?" with smart defaults | Fast for most users, precise when needed |
| D9 | ~~Rule-based sentence parser~~ | Replaced by D16 |
| D10 | **Web app (PWA)**, not an app store download | Free, iPhone and Android, offline after first open |
| D11 | **Zero cost.** Only Claude Code is paid | Free tiers only, no credit card on any service |
| D12 | ~~Outdoor first, interiors later~~ | Replaced by D15: the campus is accessible |
| D13 | **"Massing model" map look** on a green ground (palette settled 2026-10-21) | Matches the style reference, cheap to render |
| D14 | **Live GPS outdoors**: moved to *later*, not v1 | Keeps v1 simpler |
| D15 | **v1 includes full interiors** | Campus is accessible; one complete product |
| D16 | **Plain From / To fields**, no sentence parser or AI model | Explicit fields remove the guessing |
| D17 | **Floors extracted from photos by script**, cleaned up by Claude | A spike did a floor in about 4 s |
| D18 | **Every room number is its own room** (`ST404/406` → `ST404`, `ST406`); floor = number ÷ 100 | One code, one answer |
| D19 | **Private beta on an unlisted link** with `noindex` and a beta label | Floor plans wait on Facilities' OK |
| D20 | **Ten full buildings**; the rest are named blocks | Interiors only where classes are held |
| D21 | **Traced floor files are committed** to the public repo (accepted risk) | History and CI checks on the hardest data |
| D22 | **One CI gate (`gates`) for every contributor**; `main` protected since 2026-10-19 | No one can merge a red build |
| D23 | **From can be typed as a room code** as well as tapped | Students know their current room's code |
| D24 | **Beta reports via a pre-filled Google Form**, never including From | Testers lack GitHub; no backend |
| D25 | **Sign-only prefixes are suggested** (`VH501` → "Did you mean VL501?"), never accepted | Students type what the sign says |
| D26 | **A room's floor is where its directory or map puts it**; number ÷ 100 is only a guess | Mezzanines exist |
| D27 | **OSM snapshot from the main API**, converted by our own tested code | Every Overpass server failed |
| D28 | **Preview links only**: production stays dark until the private beta | A normal deploy would publish the beta link months early |
| D29 | **Floor extraction without OpenCV**: sharp plus our own tested TypeScript | Only three OpenCV functions were used; 10 MB to load them |
| D30 | **Reading text 16px, taps 48px**; only the Beta tag and OSM credit at 14px | PRODUCT.md's floor holds everywhere a student reads |
| D31 | **Building entrances from pins on openstreetmap.org**, snapped to the outline | OSM has no doors for the 10 full buildings |
| D32 | **Taft gets two sidewalks** that meet only at crosswalks | Routes must never cross Taft mid-block |
| D33 | **A dash on Velasco, St. Joseph and St. Miguel signs is a range** (`VH-304-309` = 304 to 309) | Rooms in between are on no other line |
| D34 | **Routes cost seconds**: walk 1.3 m/s, +45 s per Taft crossing, stairs 20 s a floor, elevator 3 min + 5 s a floor | One number weighs walking, waiting and floors; the time shown is real time |
| D35 | **Steps only where there's a choice**: turns at junctions, jogs under 15 m merged; a turn names the way, the covered walk, or a building within 20 m | A step every few meters on OSM's zigzags is noise |
| D36 | **Floors are stretched onto the OSM outline** by the compiler; which way round (`fit.turn`) is set by hand | Signs are 7–16% off OSM's proportions, and the outline can't tell a sign from itself turned 180° |
| D37 | **Indoor walls are 0.2 m thick boxes**, centred on the traced line, ends run on 0.1 m | Solid from the angled camera and when 7a's clipping plane cuts a floor open; no hairline end-on |
| D38 | **Search lists completions while typing**; a building with no room list says so; Go opens only an exact match; a one-typo "Did you mean" (no uFuzzy, no cmdk) | `AG110` never flashes red on the way to `AG1104`; neither library worked for codes |
| D39 | **Floors are labelled whole**, and `verticals.json` lists each stair and elevator's `servesFloors` | A forgotten room fails the build, not a student; signs draw shafts on floors they skip |
| D40 | **A `?to=` link opens what Go would open**, read once then cleaned from the address bar; Share copies the link without a share sheet | No silent guesses from a link; Back and reload behave like any other pick |
| D41 | **Routes go inside**: the trip's building files per call, indoor turns named by a room door within 5 m, the last step gives the side | Loads only two buildings; hallways have no names; door counting is unreliable |
| D42 | **Where are you opens by itself only under a room card**; Change spot waits for 8c; until 5b the steps list stands in for the route preview | Browsing the map never asks; `From` has no spot yet; testers get real routes now |

### Things we chose *not* to do

- No GPS in v1, and no indoor positioning (Wi-Fi/Bluetooth beacons). Your location never leaves the phone.
- No accounts, backend, database, analytics or trackers.
- No cloud AI, API keys or sentence parser.
- No app store release (fees), no custom domain (yearly fee), no paid map services.
- No Unity/Godot or native apps: one web codebase for both platforms.

---

## Build plan

11 phases, split into 38 steps in [`docs/ROADMAP.md`](docs/ROADMAP.md). Two people build in parallel lanes
([`docs/SPLIT.md`](docs/SPLIT.md)): **A**, what the student sees (screens, 3D, hosting), and **B**, what the app
knows (data, room codes, routing, floor plans).

| Phase | What gets built |
|---|---|
| 0. Gate 0 | Plan and D15–D24 agreed, GitHub CLI on both laptops, Cloudflare account. No code |
| 1. Skeleton | Project setup, Cloudflare previews, security headers, app shell, basic offline |
| 2. Outdoor campus | OSM snapshot, data compiler, the massing-model scene, palette settled (green) |
| 3. Rooms + search | Room-code parser, STRC room list, search with "Did you mean", room card |
| 4. Outdoor routing | Walkway graph, A*, step directions |
| 5. Where are you + route player | "Where are you?", route preview, step list, Next/Back player |
| 6. Floor pipeline | Floor extraction from photos, fit onto OSM outlines, STRC end to end |
| 7. Indoor view | Cutaway, floor rail, automatic outdoor ↔ indoor switch |
| 8. Indoor routing | Hallways, stairs, elevators, bridges, joined to outdoor routes |
| 9. Data rollout | All 10 full buildings photographed, extracted and checked (alongside 6–8) |
| 10. Offline polish → private beta | Update prompt, ⓘ sheet, performance, accessibility, unlisted beta link |
| 11. Public launch | On-site checks, Facilities' approval, launch |

---

## Open questions

- **Floor labels per building:** STRC calls its ground floor "G" (rooms 1xx). Confirm for each building from its
  directory.
- **Fitting floor plans onto OSM outlines** is unproven until the OSM snapshot exists (Phase 6).
- **Facilities:** may we publish floor plans traced from the evacuation maps? Needed before the public launch, not
  before the beta.
- **Who takes which lane** in `docs/SPLIT.md` is proposed, not agreed.

## How you can help

1. **Review the plan.** Anything confusing, risky, or over-engineered? Open a GitHub issue.
2. **Confirm room codes** from your own class schedule, especially for buildings not yet photographed.
3. **Photos:** lobby directories and evacuation maps, straight on with the whole sign in frame. Share them through
   the team's shared folder, never the repo.

---

*Map data © OpenStreetMap contributors (ODbL). This is a student project, not an official DLSU app.*
