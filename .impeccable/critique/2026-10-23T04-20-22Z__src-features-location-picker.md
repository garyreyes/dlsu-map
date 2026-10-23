---
target: S4, S5, S7 indoor steps (8▸)
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-10-23T04-20-22Z
slug: src-features-location-picker
---
# Critique: S4 Where are you, S5 Route options, S7 indoor steps (8▸)

Method: dual-agent (A: design review, opus · B: detector + browser, sonnet). Phone 390x844 and 360x780.

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of status | 3 | Building picked in S4 not highlighted; still-saving band shows G while the step says 3F |
| 2 | Match real world | 3 | "approximate", "CADS", step 1 "Start at the elevator" then stairs |
| 3 | User control | 3 | Change spot is a hidden mode; chips look the same |
| 4 | Consistency | 3 | Goal ring and you-are-here dot are both green circles; start icon reused |
| 5 | Error prevention | 3 | 8px sideways shift; two exits both "Main entrance" |
| 6 | Recognition over recall | 2 | Spot and exit names never shown on the map; no "To" label in S4 |
| 7 | Flexibility | 3 | Type, tap, map tap, swipe, arrow keys |
| 8 | Aesthetic / minimal | 3 | Sheet at 73% of screen at S4 start (DESIGN.md half = 54%) |
| 9 | Error recovery | 3 | Still-saving gives no guidance for walking inside |
| 10 | Help | 2 | "approximate", "Change spot", spot names unexplained |
| **Total** | | **28/40** | **Good** |

Detector: CLI 0 findings. Overlay: overused-font (Roboto via the system-ui stack; intended, false positive) and
flat-type-hierarchy 14–22px (Operate mode, low weight). Overlay missed the S4 overflow because it sits in
react-modal-sheet's content scroller, not the document.

## Priority issues

- [P1] S4 sheet scroller 8px wider than its box (-mx-2 bleeds in WhereAreYou scroll(), HitList ul, OutsideRow); a
  sideways drag sets scrollLeft 8 and clips every line's first letter. Fix: overflow-x clip + touch-action pan-y on
  the sheet scroller (shared/ui/Sheet.tsx); e2e check. harden/adapt.
- [P1] S7 cut floor: green hallways, green 1.1m line, green hollow goal ring next to the green dot. Neutral hallways,
  wider line, a different goal mark (tinted room or label pin), fade outdoor ribbon indoors. colorize/polish.
- [P1] Still-saving path contradicts itself: "directions stop at its door" yet steps continue; band chip G vs text
  3F. Show the goal floor; reword; "follow signs to 3F". clarify/harden.
- [P2] Recognition: spot and exit names unplaceable; "CADS"; separate Quickest chip duplicates a door; picked
  building not tinted. clarify/layout.
- [P2] S4 start: 12 options, I'm outside below the fold, sheet over half snap, no "To" label. distill/layout.

## Minor

Step 9 says 3F twice; "G" orphaned on step 2; CutRoute header comment describes a disc; DESIGN.md says indoor legs
not drawn; Beta tag clips 2px; Change spot 44px < D30 48px; chip hairline ~1.3:1; no focus move on S4 step change;
compass overlaps pill by ~9px with Route options open at 360.
