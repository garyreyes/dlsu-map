# DLSU 3D Campus Navigator: v2 roadmap

The v2 build queue: D55–D61 split into sub-phases, each one `feature-planner` pass. Agreed 2026-10-25. What changes in
the code is in `docs/V2-PLAN.md`; who owns which files is in `docs/SPLIT-v2.md`. Status words and marks are the same
as `docs/ROADMAP.md` (🧪 = test first; **Lane** A Gary, B Charles).

## Before v2

| Item | Status |
|---|---|
| Charles answers the seven requests (#98) | done (2026-10-24) |
| D55–D61 agreed | done (2026-10-25) |
| Fog at 2.5× to 5× (D56, #100) | done (2026-10-25) |

## v2-0: the shared contract

| ID | Sub-phase | Lane | Depends on | Status |
|---|---|---|---|---|
| v2-0 | Map settings store: `src/shared/settings/` types, defaults, `parseMapSettings` 🧪, the saved zustand store (V2-PLAN §1). No UI yet | A (B reviews) | — | done |

## Lane A: what the student sees

| ID | Sub-phase | Lane | Depends on | Status |
|---|---|---|---|---|
| v2-A1 | Search card rising over a frozen map (D55); user-flows §3.3 and DESIGN.md's search spec updated; e2e that opens search | A | — | not started |
| v2-A2 | Three map palettes (D57): `MAP_PALETTES`, every map layer reads the saved mode, contrast checks over all three 🧪 | A | v2-0 | not started |
| v2-A3 | Map options button and sheet: colour mode, 2D/3D, Solid/See-through; 2D low blocks; compass hidden in 2D (D58) | A | v2-0, v2-A2 | not started |
| v2-A4 | See-through (D60): the manual setting, `fadeStore.ts`, goal and selected building never fade | A | v2-A3 | not started |

## Lane B: the camera

| ID | Sub-phase | Lane | Depends on | Status |
|---|---|---|---|---|
| v2-B0 | Bugs #87 (S4 sheet width) and #88 (retry a failed building file 🧪) | B | — | not started |
| v2-B1 | Follow math, `follow.ts`: look-ahead target, walking-up heading, 1–3 s from distance 🧪 | B | — | not started |
| v2-B2 | The camera follows the glide (D59): `useCameraFollow.ts`; a pan or compass tap pauses it until the next step; Back cuts | B | v2-B1 | not started |
| v2-B3 | Drone view (D61): outdoor steps at 8°, fitted to the stretch; S5 top-down, long side vertical | B | v2-B2 | not started |
| v2-B4 | Going inside: tilt 8° → 40° at the door as the floor opens; climbs keep 600 ms | B | v2-B3 | not started |
| v2-B5 | 2D camera (D58): polar 0, north up, tilt and twist off outside the player; indoor steps straight down in 2D | B | v2-0, v2-B3 | not started |
| v2-B6 | Fade what hides the route (D60): during a route, fill `fadeStore` with the buildings between the camera and the route | B | v2-B3, v2-A4 | not started |
| v2-B7 | The walked part of the route in grey (D59 point 5), in `RouteLine.tsx` | B | v2-A2, v2-B2 | not started |

## Closing v2

| ID | Sub-phase | Lane | Depends on | Status |
|---|---|---|---|---|
| v2▸ | Impeccable critique + polish over everything v2 touched, in all three colour modes and both views; phone test on iPhone and Android | A | all above | not started |

## Notes

- **Read across:** A1, v2-0, B0 and B1 can all start today. A1 needs nothing; B1 is pure math.
- **Paused until after v2:** the polish passes 2▸, 3▸, 5▸ and 10▸, and 10d (private beta).
- **Floors 9a–9d wait** on the official floor plans requested from the school. When they arrive, check STRC, Velasco
  and St. Joseph against them and re-trace only what differs.
- **Still open from v1:** "Report a problem" (D24, waits on the Google Form); CADS has no location in the campus data.
