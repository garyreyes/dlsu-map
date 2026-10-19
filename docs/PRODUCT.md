# Product

<!-- impeccable:product-schema 1 -->

Impeccable's view of the product, translated from `docs/PRD.md` on 2026-10-19. The PRD stays the single source of
product truth; if they disagree, the PRD wins and this file gets updated. The stack is in `docs/ARCHITECTURE.md`.

## Platform

web

## Users

- **Primary: the freshman between classes.** A first-year DLSU Manila student with about 15 minutes between
  classes, already walking, one hand on the phone. They know the room code (it's on their schedule) but not which
  building or floor it's in. The job: get the building and floor *now*, then the way there.
- **Beta testers:** blockmates in the private beta. They try it and report wrong rooms or routes.
- **Maintainers (secondary, assumed):** the project team. They photograph lobby directories and evacuation maps,
  type room lists and check traced floors. They work in laptop tools and one dev-only preview page, not in the app.
- Transferees and visitors benefit too, but every decision is made for the freshman first.

## Product Purpose

A free, offline 3D map of DLSU Manila that takes a student from where they are to any room: across campus to the
right entrance, then inside the building floor by floor. Success (PRD §5): building and floor on screen within
10 s of opening with a code typed; 100% of a test set of rooms resolve correctly; search and routing work in
airplane mode after the first open, and still after a week unused; at public launch every building has its room
list and 3D interior.

## Positioning

Other maps of the campus show buildings, not floors or rooms, and need signal. This one knows every room from each
building's lobby directory and every floor from its evacuation map, routes indoors floor by floor, and works with no
signal at all. It does this with no account, no backend and no cost.

## Operating Context

- Used while walking between classes, in a hurry, often already late. Glance, act, put the phone down.
- Campus Wi-Fi and mobile data are unreliable, especially indoors. The app must work fully offline after one open.
- No GPS in v1. The student says where they are by typing their current room or tapping building → floor.
- Room codes are the shared language: `ST311` (STRC, also written `C311`), `AG1104` (Andrew). Floor = number ÷ 100.
  Prefix table: `docs/ARCHITECTURE.md` §3.3.
- Screens, transitions and every empty, loading and error state: `docs/user-flows.md`.

## Capabilities and Constraints

- **v1:** strict room-code search with "Did you mean", typed or tapped From, outdoor + indoor routing with
  Stairs / Elevator / Auto per route, step-by-step directions, 3D campus and building cutaways, offline after the
  first open, a text-only fallback when 3D fails. Full interiors for 10 buildings; the rest are plain blocks.
- **Later, not v1:** amenities ("nearest CR"), offices, food, events, "My classes", live GPS.
- **Never:** accounts, backend, analytics, trackers, cloud AI, app stores, indoor positioning.
- **Zero cost**, no credit card on any service.
- **Privacy:** where the student is (From) never leaves the phone and is never stored. Shared links and problem
  reports carry only the destination.
- **Data rights:** evacuation-map photos are DLSU's; never committed or shipped. Publishing traced floor plans
  needs DLSU Facilities' OK before the public launch.
- **Open:** each building's floor labels (STRC's ground floor is "G"); the 3D palette (see Brand Commitments).

## Brand Commitments

- **Name:** "DLSU 3D Campus Navigator" is a working name, not final.
- **Not official.** No DLSU seal, logo or official marks anywhere. It must never pass as an official DLSU app. The
  line "Student project, not an official DLSU app" stays visible in the app, and a "Beta" label stays visible until
  the public launch.
- **Interface convention (owner's choice, 2026-10-19):** the interface works like Google Maps: a full-screen map, a
  floating search bar on top, a bottom sheet, round map buttons. The quality bar is Google Maps, Apple Maps and Waze.
  It borrows the convention, never Google's identity: no Google logo, Google Sans or Google's map pin. The map
  itself keeps the D13 look below.
- **Green interface (owner's choice, 2026-10-19):** the interface colour is a fixed green ("since it's for DLSU"),
  on green-tinted neutrals, whichever map palette is shown. It's a colour, not a DLSU mark, so the "not official"
  rule still holds. This replaces D13 option B's gold accent: one green marks the selection in every palette.
- **Black map ground (owner's choice, 2026-10-19):** the default ground is near-black like Waze's dark mode, with
  soft grey paths and a dark green haze. It replaced D13's orange option; green and grey stay for comparison.
- **Credit:** "Map data © OpenStreetMap contributors" stays on the map (ODbL).
- **Voice:** plain English, short sentences, the words on room signs and schedules. No slang, no jokes in error
  messages.
- **Decided 3D look (D13, "massing model"):** every building one pale color, shaped by light alone (no windows,
  textures or outlines); a flat, saturated ground; streets and paths as thin bright lines; soft darkening where walls
  meet the ground; a high, angled camera over the surrounding city. Color has one job: a single accent marks the
  route, the selected building and "you are here". **The palette is open** (D13 lists three options to compare on
  real phones). The style reference is a licensed photo kept in `docs/reference/`, never committed or shipped.

## Evidence on Hand

- STRC's lobby directory and evacuation maps for G, 2F, 3F and 4F, photographed 2026-10-19 (`data-src/photos/`,
  gitignored).
- The floor-extraction spike's output on STRC 4F and 2F (`docs/spikes/wall-extract/`).
- OpenStreetMap footprints and names for the campus buildings.
- **Absent, never to be invented:** user testimonials, usage numbers, DLSU endorsement or approval, official logos,
  room lists for buildings not yet photographed.

## Product Principles

1. **Building and floor first, route second.** The answer most students need arrives before any route exists.
2. **Never guess silently.** Unknown codes are rejected with suggestions, and every route shows From → To before
   Start.
3. **No signal is the normal case,** not an error.
4. **Nothing about the student leaves the phone.**
5. **Say when it's uncertain:** "(approximate)" for unverified entrances, "indoor map coming" for untraced floors.

## Accessibility & Inclusion

- Tap targets at least 48 px, text at least 16 px, WCAG AA contrast for text over the 3D map (labels get a backing
  plate on strong ground colors).
- One-handed use: the floor rail and main buttons sit within thumb reach.
- `prefers-reduced-motion`: camera flights become cuts, and the slice animation is skipped.
- A text-only mode with floor and turn icons always works, including when WebGL fails or is too slow.
- Elevator routing on every route; a saved avoid-stairs mode is a Could (PRD §8).
