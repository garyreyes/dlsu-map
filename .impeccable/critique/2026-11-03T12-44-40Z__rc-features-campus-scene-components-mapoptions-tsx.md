---
target: the map options card
total_score: 22
max_score: 36
na_heuristics: 9
p0_count: 0
p1_count: 2
timestamp: 2026-11-03T12-44-40Z
slug: rc-features-campus-scene-components-mapoptions-tsx
---
# Critique: the map options card (v2▸)

Method: dual-agent (A: design review · B: detector + browser), synthesised in the main session, which re-checked
the A screenshots for both P1s.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | On a phone the card covers the campus, so See-through, Hide and most of 2D change out of sight |
| 2 | Match System / Real World | 2 | "Surroundings", "Buildings: Solid / See-through" are our words, not a freshman's |
| 3 | User Control and Freedom | 3 | Esc, outside tap, X and the button all close it; focus returns. No reset to defaults |
| 4 | Consistency and Standards | 3 | Same Segmented and MapButton as the rest; `role="dialog"` but behaves as a popover |
| 5 | Error Prevention | 3 | Nothing destructive; the card can stay open while the sheet under it changes |
| 6 | Recognition Rather Than Recall | 2 | Colour is three words, not three swatches; no option previews what it does |
| 7 | Flexibility and Efficiency | 2 | 2D, the most-used switch, is two taps; the button never shows a non-default is on |
| 8 | Aesthetic and Minimalist Design | 3 | Clean and low-chrome; the title row spends ~56 px before the first control |
| 9 | Error Recovery | n/a | Nothing here can fail visibly |
| 10 | Help and Documentation | 2 | "See-through" and "Hide" the surroundings are unexplained |
| **Total** | | **22/36** | **Acceptable (61%)** |

## Design Specificity Verdict

**LLM assessment:** a well-made, deliberately conventional Google-Maps layers card (PRODUCT.md asks for the
convention). Token use, 48 px targets and the one-green rule are all held. But nothing in it is this product: the
Colour row is the one place the three real map palettes could show themselves, and it shows three words on identical
white pills. It's a settings form set down on a map.

**Deterministic scan:** `detect.mjs` on MapOptions, Segmented, MapButton, IconButton and MapButtons: 0 findings. The
in-page overlay reported two page-wide items: "overused font: Roboto 100%" (a false positive by brief: DESIGN.md picks
the phone's own system stack on purpose; headless Chrome on Windows resolved it to Roboto) and "flat type hierarchy:
14 / 16 / 17 px" (page-wide and mostly by design, D30's sixteen-pixel floor; inside the card it agrees with the
review: the 17 px title barely stands above the 16 px row labels, so its row earns little).

**Visual overlays:** injected in headless Chrome only; no user-visible tab.

## Overall Impression

Solid parts, wrong size for a phone. The card promises "the map behind stays visible so each change can be seen as it
lands" (DESIGN.md), and on a 375 px phone it covers the middle of the campus, the very thing three of its four rows
change. Over a half sheet or on a short screen it is also cut to two rows with no sign more exist. The biggest
opportunity is a compact card that leaves the campus in view.

## What's Working

- **Segments:** 48 px segments in the Pale Leaf track, one selected look (white + Float), identical to Route options,
  so nothing is new to learn, and thumb-sized.
- **Anchoring and dismissal:** opens up and left from the button, never over the sheet; non-modal; Esc is swallowed
  so it doesn't also close the sheet below; focus goes back to the button (`useDismiss`, MapOptions.tsx 26–48).
- **Structure for screen readers:** `aria-expanded`/`aria-controls` on the button, a labelled dialog, grouped
  segments with `aria-pressed`, the title focused on open.

## Priority Issues

- **[P1] On a phone the card hides what it changes.** At 375×812 it spans the left gutter to the button and about
  145–620 px down: the campus is under it. With Hide or See-through chosen, only Razon shows at the right edge.
  *Why:* a change you can't see looks like a change that didn't work; it breaks DESIGN.md's own "Not modal" promise.
  *Fix:* make the card much shorter: drop the title row (the button names it and toggles it; keep a close for
  screen readers), put each label beside its control instead of above, and let the card hug the right side so the
  campus centre stays clear. *Command:* `/impeccable layout`.
- **[P1] Short screens and half sheets cut the card to two rows, mid-control.** `maxHeight` is button bottom minus the
  top inset, so a half sheet (07) leaves Colour and half of View; 375×600 (08) cuts Buildings in half and hides
  Surroundings. No fade or scroll cue; the scroll is nested over a map that pans. *Why:* two of four settings vanish
  exactly when a card or route is open. *Fix:* the compaction above, plus a bottom fade when it overflows.
  *Command:* `/impeccable layout`, then `/impeccable adapt`.
- **[P2] Colour doesn't show colour; labels are shorthand.** Green / Black / Grey are words; "Surroundings" and
  "Buildings: Solid / See-through" need a try to understand. *Fix:* a small ground-and-building swatch in each Colour
  segment from `MAP_PALETTES` (an optional swatch slot in `Segmented`); plainer labels (row names are in DESIGN.md and
  D57/D58/D60/D64, so the owner picks). *Command:* `/impeccable clarify`, `/impeccable colorize`.
- **[P2] The button never shows a setting is changed, and 2D is two taps.** *Fix:* a small green dot on the layers
  button when any setting differs from the default. A separate 2D button would reverse D58's placement, so it's a
  question, not a fix. *Command:* `/impeccable polish`.
- **[P3] Dialog role without dialog behaviour; changes aren't announced.** `role="dialog"`, no `aria-modal`, closes
  on blur (MapOptions.tsx 117–122). *Fix:* a labelled `region`/group instead, and a polite live line ("Map set to
  2D"). *Command:* `/impeccable harden`.

## Persona Red Flags

- **Casey (one hand, walking):** taps 2D, sees the card, not the map; the X sits at the card's top right, about
  two-thirds up the screen, away from the thumb (the layers button toggles it too, but nothing says so).
- **Jordan (first-timer):** "Surroundings" means nothing until tried, and the try happens under the card, so it
  seems to do nothing.
- **Sam (screen reader):** no announcement when a choice lands; Tab out of the "dialog" closes it.
- **The freshman between classes:** rarely opens it, which is right; if they do, for 2D, the campus disappears
  under the card and they hunt for the close.

## Minor Observations

- The 17 px title is the card's only non-scale size and adds little.
- Unselected segment text (Mid Ink on Pale Leaf) is flat next to the selected one; fine, but low-energy.
- The 160 ms fade and rise is right, and gone under reduced motion.
- Desktop (1280) is fine: the card floats over open map. P1s are phone problems.
- Not tested below 375 px: "See-through" in a narrower card may wrap.

## Questions to Consider

- If "see each change land" is the promise, what does a card half this height look like?
- Which of the four rows are for the freshman, and which for testers? Would Surroundings live better in the ⓘ sheet?
- The product's identity is a massing model in three palettes. Why does the palette control show none of them?
