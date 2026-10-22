---
target: Phase 7 indoor view
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-10-22T10-39-36Z
slug: src-features-indoor-view
---
# Critique: Phase 7 indoor view (7▸), 2026-10-22

Method: dual-agent (A: design review, Opus · B: detector + browser, Sonnet). Route: Gate 2 → ST311, 8 steps; 6–7
indoors on G, 8 on 3F. 390×844.

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | Rail says the floor; plan never shows the goal room or the indoor path |
| 2 | Match system / real world | 2 | "On your left", "east stairs" on a view turned to the band, not the walk |
| 3 | User control and freedom | 3 | Back, ✕, swipe all work; no way to look at another floor |
| 4 | Consistency and standards | 2 | Going inside zooms *out*; rail looks like Google's tappable level picker |
| 5 | Error prevention | 3 | No silent guesses; stale 3F chip during exit slide |
| 6 | Recognition over recall | 1 | Goal floor and goal room exist only in the text |
| 7 | Flexibility and efficiency | 2 | Swipe and arrows; pinch capped at 90 m |
| 8 | Aesthetic and minimalist | 3 | Quiet and on-palette, but minimal tips into "nothing there" |
| 9 | Error recovery | 2 | "Indoor map still saving" (user-flows §3.7) not built; silent fallback to band |
| 10 | Help and documentation | 2 | Untraced rail rows differ by grey alone, no cue |
| **Total** | | **22/40** | **Acceptable** |

## Design specificity

LLM: on-system at campus scale; generic and illegible inside. The cutaway keeps the massing world so strictly (one
colour, no fills, no labels) that it drops what a plan needs. Detector: CLI clean on `src/indoor-view`, `src/`,
`index.html` (0 findings). Live overlay (dev, no CSP) reported `overused-font` (Roboto 100%) and a
`flat-type-hierarchy` note on every view, outdoor and indoor alike: app-wide and pre-existing, not Phase 7. Fallback
checks: no unnamed buttons, rail labels 16px and AA. OSM credit contrast/size and Beta contrast are false positives
(translucent plate, pseudo-element hit area).

## Priority issues

1. **[P0] The indoor camera frames the building plus neighbours; the plan is ~70×135 CSS px.** `useCameraFlights.ts`
   ~107 uses `buildingView` (`SELECT_CONTEXT` 2, fit at 58°, aimed at ground). Fix: an `indoorStepView` aimed at the
   step's spot at floor height, ~20–25 m radius fit at `STEP_POLAR`, facing the walk; own `MIN_DISTANCE` if needed.
2. **[P0] Nothing marks the destination or path indoors.** Band stands down, route line is outdoor only. Fix: draw
   the indoor leg as the green ribbon on the cut floor (D43's trigger was 7a); mark the goal room; dot at step start.
3. **[P1] The slide reads as ~60–100 ms.** Ease `(1-2^(-10p))/(1-2^-10)`: 50% at 60 ms, 97% at 300 ms. Fix: gentler
   ease-out over 600 ms, with the closer framing so the climb fills the screen.
4. **[P1] Rail looks tappable, isn't, and hides the goal floor.** Fix: mark the goal floor (outlined chip) and drop
   the pill look on non-current rows so it reads as a gauge, not buttons (keeps display-only).
5. **[P2] Interior contrast.** Walls and slab both #f2eee5; hallway 2.75:1; city blocks wash over the cut; the
   STRC label covers the plan. Fix: darker walls (~80%), hide the label while cut, fade city near the cut.

## Persona red flags

- Casey: can't pinch one-handed; floor change needs a second look.
- Jordan: taps the rail, nothing happens; doesn't know grey floors mean no map; expects a pin on ST311.
- Freshman, late: glance shows a dot on a pale sliver; the 3D adds almost nothing indoors.

## Minor

Selection tint lost on the cut stump; rail jitters ~15px with sheet height; DESIGN.md keeps dark tokens the app
doesn't use; "approximate" has no map counterpart; untraced floors checked from code only.

## Questions

- Should the indoor view get its own named exception to Shaped-by-Light, like the floor band?
- Should entering feel like a change of scale, the campus fading to haze?
- Does the rail answer the wrong question: "which floor" vs "how many more, which stairs"?
