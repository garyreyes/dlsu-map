---
name: DLSU 3D Campus Navigator
description: A familiar map interface floating over a pale massing model of the DLSU Manila campus.
colors:
  surface: "#ffffff"
  surface-2: "#edf4ef"
  ink: "#17201b"
  ink-2: "#44534b"
  ink-3: "#5c6b63"
  line: "rgba(0, 64, 32, 0.13)"
  accent: "#00703c"
  on-accent: "#ffffff"
  accent-wash: "rgba(0, 112, 60, 0.1)"
  danger: "#b3261e"
  surface-dark: "#18201b"
  surface-2-dark: "#233028"
  ink-dark: "#ecf3ee"
  ink-2-dark: "#b2c0b8"
  ink-3-dark: "#95a59c"
  line-dark: "rgba(255, 255, 255, 0.12)"
  accent-ink-dark: "#58c48f"
  danger-dark: "#f2b8b5"
  map-a-ground: "#121614"
  map-a-building: "#e8edf3"
  map-a-path: "#56645d"
  map-a-road: "#77857e"
  map-b-ground: "#175f3c"
  map-b-building: "#f2eee5"
  map-b-path: "#5f9c7c"
  map-b-road: "#99c2ab"
  map-c-ground: "#c4c7c6"
  map-c-building: "#fbfbfa"
  map-c-path: "#ffffff"
  map-c-road: "#ffffff"
  map-a-haze: "#163326"
  map-b-haze: "#4f9a72"
  map-c-haze: "#cfe5d7"
  map-sun: "#fff4e6"
typography:
  display:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "28px"
    fontWeight: 750
    lineHeight: 1.15
    letterSpacing: "-0.01em"
    fontFeature: "\"tnum\" 1"
  step:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "22px"
    fontWeight: 650
    lineHeight: 1.25
  headline:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 650
    lineHeight: 1.4
  title:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.4
  search-input:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 500
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.4
  body-strong:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.4
  button:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 700
  label:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.4
  label-strong:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 700
  caption:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.4
  code-tag:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 700
  micro:
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    letterSpacing: "0.02em"
rounded:
  hairline: "2px"
  tag: "6px"
  label: "8px"
  row: "12px"
  sheet: "18px"
  segment: "20px"
  control: "22px"
  segmented: "24px"
  pill: "26px"
  full: "50%"
spacing:
  xxs: "2px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "24px"
components:
  search-pill:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    height: "52px"
  search-pill-set:
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
  beta-tag:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.accent}"
    typography: "{typography.micro}"
    rounded: "{rounded.tag}"
    padding: "2px 6px"
  icon-button:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.full}"
    size: "48px"
  icon-button-hover:
    backgroundColor: "{colors.surface-2}"
  map-button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    size: "48px"
  sheet:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.sheet}"
  side-panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.sheet}"
    width: "400px"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    height: "52px"
    width: "100%"
  button-secondary:
    textColor: "{colors.accent}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "48px"
  row:
    textColor: "{colors.ink}"
    rounded: "{rounded.row}"
    padding: "6px 8px"
    height: "56px"
  row-hover:
    backgroundColor: "{colors.surface-2}"
  code-tag:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-2}"
    typography: "{typography.code-tag}"
    rounded: "{rounded.tag}"
    padding: "2px 7px"
  chip:
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "48px"
  chip-selected:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
  field:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.row}"
    padding: "0 14px"
    height: "52px"
  segmented:
    backgroundColor: "{colors.surface-2}"
    rounded: "{rounded.segmented}"
    padding: "4px"
  segmented-option:
    textColor: "{colors.ink-2}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.segment}"
    height: "48px"
  segmented-option-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.row}"
    padding: "12px 16px"
  map-label:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.label}"
    padding: "3px 8px"
  map-label-minor:
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    padding: "2px 6px"
  map-label-selected:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
  floor-chip:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.label-strong}"
    rounded: "{rounded.label}"
    padding: "3px 8px"
  here-dot:
    backgroundColor: "{colors.accent}"
    rounded: "{rounded.full}"
    size: "18px"
---

# Design System: DLSU 3D Campus Navigator

<!-- Recorded from the shipped prototype in prototypes/map-home/ (index.html, scene.js, ui.js) on 2026-10-19,
after the finish review shipped it. The build is the source; where the direction contract differs, the build won. -->

## Overview

**Creative North Star: "The Architect's Model in a Familiar Map"**

The interface is the map app every student already knows: a full-screen map, a floating search pill on top, one
bottom sheet, round map buttons. It is executed straight, in the phone's own system face, with white floating chrome
on soft shadows. Nothing in the chrome needs learning. Under it sits something no other map of the campus has: a pale
massing model of DLSU Manila, every building one colour and shaped by light alone, on a flat ground with
thin paths, the city around it muted so the campus leads.

Colour does one job. A single fixed green marks the selection, the found floor, "you are here" and the one primary
action, in both themes and on every map palette. Everything else is green-tinted neutral. Density is a phone map's
density: one primary action per sheet, rows at least 56px tall, groups made by spacing and type weight rather than
boxes. The signature is the found floor drawn as a solid green band one storey tall around the building, with a
floor chip beside it.

The app ships the light interface only (1c); the dark tokens are kept for a later night mode (ROADMAP notes).
The map has three colour modes, Green (the default), Black and Grey (D57). The student picks one in the map options
sheet, and it is saved on the phone. The interface never changes with the map palette.

**Key Characteristics:**

- Google Maps convention, never Google's identity: no Google logo, Google Sans or Google pin.
- One interface green (#00703c) on green-tinted neutrals, fixed across themes and map palettes.
- White floating chrome with soft, low shadows; flat surfaces inside the sheet.
- D13 massing model: one pale building colour, unlit flat ground, thin bright paths, soft wall-foot darkening.
- Signature: the found floor as a solid accent band one storey tall, plus a floor chip.
- Motion confirms: a 260ms sheet snap and 650ms camera flights, both cuts under reduced motion.

## Colors

A restrained system: green-tinted neutrals for every surface and text role, one green for meaning, and a separate
map palette that the interface never borrows from.

### Primary

- **Campus Green** (`accent`): fills for the primary button, selected chips, the selected building's label, the
  floor chip, the floor band, the "you are here" dot and the Beta tag text. Fills keep this exact value in dark
  mode too, so the map accent never shifts.
- **Lit Campus Green** (`accent-ink-dark`): green *text and strokes* in dark mode only (search icon, floor words,
  links, caret, focus ring), where the fill value would be too dark to read. In light mode green text uses
  `accent` itself.
- **Green Wash** (`accent-wash`): the Beta tag's backing and text selection. Never a large fill.

### Neutral

- **Sheet White** (`surface`) and **Night Sheet** (`surface-dark`): the search pill, sheet, side panel, map
  buttons, map label plates and the search card.
- **Pale Leaf** (`surface-2`) and **Night Leaf** (`surface-2-dark`): input fields, the segmented control track,
  code tags, and the hover fill on rows and icon buttons.
- **Deep Ink** (`ink` / `ink-dark`): titles, room codes, set search text, map label text; also the toast fill.
- **Mid Ink** (`ink-2` / `ink-2-dark`): secondary text, idle search pill text, row subtitles, section labels,
  icon buttons, minor map labels.
- **Soft Ink** (`ink-3` / `ink-3-dark`): placeholders, row icons, "Also written" asides, the trip arrow.
- **Green Hairline** (`line` / `line-dark`): the sheet handle, chip and secondary-button strokes, the search bar's
  bottom rule.
- **Signal Red** (`danger` / `danger-dark`): rejected codes ("ST999 isn't in our list."), in 16px semibold.

### Map palettes

The 3D map has its own colours per mode (ground, building, path, road, haze), in `MAP_PALETTES` in
`src/shared/config/palette.ts`. Grounds are drawn unlit, so each swatch is exactly the colour on screen. The frontmatter
keeps the prototype's letters: `map-a-*` is Black, `map-b-*` Green, `map-c-*` Grey.

- **Green** (`map-b-*`, the default): deep green ground, warm white blocks, sage paths, lighter sage roads (lightened
  so the route reads on them, D62). Off-campus blocks lean 50% toward the ground.
- **Black** (`map-a-*`): near-black ground like Waze's dark mode, cool white blocks, soft grey paths and roads.
  Off-campus blocks lean 40%.
- **Grey** (`map-c-*`): light grey ground, near-white blocks, white paths. Off-campus blocks lean 32%.

Everything drawn on the map stays readable in all three: `contrast-pairs.test.ts` checks the label plates over every
map colour, the route (its green or walked grey, or its white edge, at 3:1 over ground, path, road and the cut
floor) and the cut floor's hallways. The one exemption is the dimmed outdoor route while a building is cut open,
faint on purpose (Grey is lowest at 1.49:1); the test keeps it at 1.4:1 or more.

### Named Rules

**The One Green Rule.** Campus Green means "this is yours": the selection, its floor, where you are, the next step.
It never decorates, and no map palette may change it or add a second accent.

**The Fill-Versus-Ink Rule.** Green fills stay `accent` in both themes; green text and strokes switch to
`accent-ink-dark` on dark surfaces. Never put `accent` text on a dark surface.

**The Two Worlds Rule.** Interface colours live in CSS tokens; map colours live in the palette table. The interface
never samples the map palette, and the map never uses interface neutrals except the accent.

## Typography

**Display Font:** the system UI stack (system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial)
**Body Font:** the same stack
**Label/Mono Font:** none; room codes use tabular figures (`tnum`) in the same face

**Character:** the phone's own face, so the app reads as a native map tool rather than a branded product. Hierarchy
comes from weight and size, not from a second family.

### Hierarchy

- **Display** (750, 28px, 1.15, -0.01em): the room code or building short name at the top of a card, like ST311.
- **Step** (650, 22px, 1.25): the step card's one line (S6), read at a glance while walking.
- **Headline** (650, 18px): sheet step headings, "Where are you?" and "Your route".
- **Title** (600, 18px): the room or building name under the code; the info sheet's app name.
- **Search input** (500, 18px): the search card's field; placeholder drops to 400 in Soft Ink.
- **Body** (400, 16px, 1.4): default text, fields, hints. **Body strong** (600, 16px): row titles, chips, segments.
- **Button** (700, 17px): the primary button only.
- **Label** (600, 16px): section labels in lists ("Recent", "Or pick a building", "Did you mean") in Mid Ink, and
  building labels on the map. **Label strong** (700, 16px): the floor chip.
- **Caption** (400, 16px): row subtitles, notes, asides.
- **Code tag** (700, 16px): building prefixes beside building rows.
- **Micro** (600, 14px, 0.02em): the Beta tag and the OSM credit only. They are marks, not reading text (D30).

### Named Rules

**The Code Is the Headline Rule.** On a room card the code is the largest thing on screen and the floor words are
the only green text. Building and floor arrive before anything else.

**The Tabular Code Rule.** Any room code or floor number sits in tabular figures so codes line up in lists.

**The Sixteen Floor Rule.** Everything a student reads is 16px or more, and every tap target is 48px or more (D30,
settled in 1c). The one exception is Micro (14px) for the Beta tag and the OSM credit. Don't add roles below 16px.

## Layout

The map is full-bleed and fixed; chrome floats over it.

- **Phones:** the search pill sits 10px below the top safe area with 16px side gutters (or the safe-area inset,
  whichever is larger). The sheet is pinned to the bottom, full width. Map buttons sit at the right gutter and the
  OSM credit at the left, both 12px and 8px above the sheet's visible top edge, and ride with it.
- **Sheet snaps:** *peek* shows only the first block (the hint, or the card head with its one primary button);
  *half* caps at 54% of the screen and keeps the map visible above it; *full* caps at 86% and is for reading (the
  info sheet). Home opens at peek, cards and route preview at half, info at full.
- **Wide screens (768px and up):** Google Maps' desktop convention. The pill and a 400px left panel stack at the
  left gutter, the panel starting 72px from the top, a full-radius card with no handle. Map buttons and the credit
  move to the bottom right, 24px up.
- **The map frames what's left.** The camera's view offset tracks the uncovered area (between pill and sheet on
  phones, right of the panel on wide screens), so a selected building lands in the visible map, never under chrome.
- **Rhythm:** a 4px base (4, 8, 12, 16, 20, 24). Rows are at least 56px with 14px icon gaps; section labels take
  8px above and 4px below; headlines take 20px above and 8px below.
- **Search card (D55):** on a phone, a Sheet White card rising from the bottom and sitting on the keyboard. Its
  top is fixed, leaving about a third of the visible height as a strip of map, dimmed and frozen; a tap there closes
  search. At the top of the card, a 64px bar with back and clear buttons and a hairline under it; results scroll
  below. On wide screens, a floating panel about 400px wide at the top left, under the pill. It slides up in about
  200ms; no motion with reduced motion.

## Elevation & Depth

A hybrid. The chrome floats on two soft shadow levels; everything inside the sheet is flat and grouped by space.
The map has its own depth model, made by light, not by shadows or outlines.

### Shadow Vocabulary

- **Float** (`box-shadow: 0 1px 2px rgba(16, 24, 20, 0.16), 0 3px 10px rgba(16, 24, 20, 0.12)`): the search pill,
  map buttons, map labels, the "you are here" dot, the toast, the desktop panel and the selected segment.
- **Sheet lift** (`box-shadow: 0 -1px 2px rgba(16, 24, 20, 0.08), 0 -4px 16px rgba(16, 24, 20, 0.1)`): the phone
  bottom sheet only; it casts upward.
- **Dark mode** deepens both to black at 0.3–0.4 alpha with the same offsets.

### Map depth

- **Light:** a hemisphere light (0.72, sky white, ground tinted 18% toward the palette ground) and one warm sun
  (#fff4e6, 0.46) from the upper left. Buildings use Lambert shading with no texture, windows or edge lines.
- **Wall-foot darkening:** the bottom 6m of every wall darkens to 70% and grades up to full, so blocks sit on the
  ground.
- **Ground:** unlit and flat, exactly the palette colour. A green haze (owner's choice) fades the distance and fills
  the sky: #163326 (dark green) over black, #4f9a72 over green, #cfe5d7 over grey. It tracks the camera (2.5 to 5
  times its distance, D56).
- **Campus leads:** every off-campus building is see-through (35% opacity, owner's choice) and tinted toward the
  ground, so campus buildings show through it and only campus buildings can hide the selection.
- **Camera:** 40° field of view, about 52° from straight down for the overview with Taft Avenue toward the bottom;
  a closer, lower angle (about 58°) for a selected building, from the first heading that sees its floor band; about
  8° (the drone view, D61) for an outdoor step and the route preview, fitted to the walk to the next step; 40° for an
  indoor step, about 22 m around its spot (D46). Pinch stops at 90 m, or
  35 m on an indoor step. **In 2D** (D58) the overview, a selected building and an indoor step look down from 1° off
  vertical; outside the player north is up. Outdoor steps and the route preview keep the drone view.

### Named Rules

**The Float-Only-Chrome Rule.** Shadows belong to things floating over the map. Inside the sheet, use space and
weight, not shadowed cards.

**The Shaped-by-Light Rule.** Map buildings get one colour and the lights. No outlines, windows, textures or
per-building colours. Two named exceptions: the selected building's 22% tint toward the accent, and the Indoor Cut.

**The Indoor Cut Rule.** A building cut open on a step is a floor plan, so it may separate its parts by tone: its
walls are a darker tone of its own tinted colour and its hallways a darker neutral (D46; neutral since 8▸, so
green means only "yours"). It carries Campus Green for the indoor line and the goal room's label pin.
Nothing outside the cut changes, and no new hue arrives.

## Shapes

Soft and round, in the phone-map idiom. Radii scale with the element's height so everything reads as pill or
near-pill.

- **Pills:** the search pill and the primary button (26px on 52px tall); chips and the secondary button (22px on
  44px); the segmented track (24px) with 20px segments.
- **Cards:** the sheet's top corners and the desktop panel (18px).
- **Rows, fields, toast:** 12px. **Map labels and the floor chip:** 8px. **Tags and the credit plate:** 6px.
- **Circles:** map buttons, icon buttons and the "you are here" dot (50%). The sheet handle is a 36 by 4px bar.
- **Strokes:** borders are rare: 1px Green Hairline on chips, the secondary button and the sample-room marker. The
  search pill, sheet and map buttons have none.
- **Icons:** 24px inline SVG line icons, 2px round-capped strokes in currentColor.

## Components

### Search pill

A white 52px pill floating at the top: search icon in green, "Where to?" in Mid Ink (the chosen code in Deep Ink,
semibold, once set), the Beta tag, and an info icon button. Tapping anywhere on the left opens the search card.
It is the screen's primary action at home.

### Buttons

- **Shape:** full pill (26px radius on 52px).
- **Primary:** Campus Green fill, white 17px bold label, full width, 8px above. One per sheet: Directions on a card,
  Start on the route preview. Pressed state darkens to 94% brightness. While what it acts on is still loading it
  stays in place, faded to 45%, so nothing moves when it's ready.
- **Secondary:** 48px pill, 1px hairline, green 16px semibold text, no fill ("Pick another building", "Back").
- **Icon button:** 48px circle, Mid Ink icon, Pale Leaf on hover (share, close, back, clear, info).
- **Map button:** 48px white circle with Float shadow, Deep Ink icon (recenter: "Show the whole campus"). Buttons
  stack in a column, 12px apart.
- **Compass:** a map button that appears above recenter only while the map is turned more than 4°. Its needle (green
  tip) points where the usual "up" (north in 2D) now is; tapping it turns the map back in 400ms, keeping zoom and tilt.
- **Focus:** a 2px outline in green ink, offset 2px, on every control.

### Chips

- **Style:** 48px pill, 1px hairline, 16px semibold Deep Ink text, no fill.
- **State:** selected (`aria-pressed`) fills Campus Green with white text. Used for floor choices in a grid
  (60px minimum columns) and for the From and To ends of a route, where a regular-weight Mid Ink "From"/"To" leads
  (16px like the rest, D30) and an arrow sits between the two. They wrap when the names run long.

### Cards / Containers

- **Corner Style:** 18px top corners on phones, all four on the desktop panel.
- **Background:** Sheet White.
- **Shadow Strategy:** Sheet lift on phones, Float on the desktop panel (see Elevation & Depth).
- **Border:** none.
- **Internal Padding:** 16px gutters (or safe area), 16px plus safe area at the bottom, a 24px handle zone on top.
- **Room card:** display code, name, "STRC · **3rd floor (3F)**" with the floor words in green, optional "Also
  written C311" aside, optional sample marker; share and close icon buttons at top right; Directions under it.

### Inputs / Fields

- **Style:** 52px Pale Leaf field, 12px radius, no stroke, leading search icon, 16px text, Soft Ink placeholder
  written as an example ("I'm in room… like AG1104").
- **Focus:** a 2px inset ring in green ink; the caret is green.
- **Error:** a Signal Red semibold line under the field that names the problem and the way out ("Room codes look
  like AG1104 or ST311.").

### Lists and rows

Full-width 56px rows that bleed 8px past the gutter so the hover fill aligns with the text: a Soft Ink icon, a
semibold title over a 16px Mid Ink subtitle, and for buildings a code tag at the end. Rows group under 16px Mid Ink
section labels; no dividers.

### Segmented control

A Pale Leaf track with 4px padding holding 48px segments. The selected segment turns Sheet White with Deep Ink text
and a Float shadow. Used for Stairs / Auto / Elevator inside the collapsed "Route options" disclosure, and for the
three rows of the map options card.

### Map options

The map's three saved choices (D57, D58, D60) behind one map button, so they stay out of the way until wanted.

- **Button:** a map button with a layers icon ("Map options"), the top of the right-gutter column, above the
  compass and recenter. It shows wherever the map buttons do, the route player included.
- **Card:** Sheet White, 18px radius, Float shadow, 16px padding, opening upward to the left of the button with its
  bottom edge level with it, so it never covers the sheet; 312px wide, never wider than the space left of the button,
  and scrolling if it would pass the top of the screen. A 17px semibold "Map options"
  title and a close icon button head it.
- **Rows:** three, 16px apart, each a 16px Mid Ink label over a segmented control: **Colour** (Green / Black /
  Grey), **View** (3D / 2D), **Buildings** (Solid / See-through). A choice applies at once and is saved; there is
  no Done. Buildings joins in v2-A4, with the fading it controls: a switch that does nothing yet isn't shown.
- **Closing:** the close button, Escape, a tap anywhere outside the card, or the map button again. Focus goes back
  to the map button. Its Escape closes only the card, never the sheet under it. It opens and closes with a 160ms
  fade and 4px rise; instantly under reduced motion.
- **Not modal:** the map behind stays visible so each change can be seen as it lands.

### Toast

A Deep Ink pill-ish box (12px radius) with Sheet White 15px text, centred 24px above the bottom safe area, max 420px
wide. It rises 8px and fades in over 160ms and leaves after 2.6s. It confirms ("Link copied") or explains a limit.

### Navigation

There is no navigation bar. The pill opens search; the sheet's step is the navigation; back and close are icon
buttons. The search card closes with its back arrow, Escape, or a tap on the dimmed map.

### Map labels

Building names sit on Sheet White plates with the Float shadow, 16px semibold, anchored above the roof. Minor
buildings use a 16px Mid Ink variant that only appears when zoomed in. The selected building's label turns Campus
Green. Labels hide rather than overlap: the floor chip and "you are here" are placed first and building labels give
way to them, and none may sit under the pill or sheet.

### Floor band (signature)

The found room's floor drawn as a solid Campus Green band one storey tall, set 0.6m outside the walls and inset
0.1m top and bottom so the storey lines stay visible. The floor chip (Campus Green plate, white 16px bold, "3F" or
"G") attaches to the right-most stretch of the band the camera can actually see. The building itself takes a 22%
green tint and the camera flies to a heading that shows the band.

**In 2D** (D58) every block is 3m tall, so no storey stands apart: the band wraps the whole low block instead, from
0.1m to 2.9m, and reads from above as a green outline. The floor chip still names the floor. A building cut open on
an indoor step keeps its real stump, so its floor plan sits where it always does.

### Floor rail (S7)

On a step inside a building, the building is cut open on the step's floor and the band stands down. A narrow white
pill with the Float shadow sits on top of the map buttons' column and lists the floors top to bottom in 16px: the
step's floor in the floor chip's look (Campus Green, white bold); the goal floor, where the route's stay in the
building ends, as the same chip outlined (2px Campus Green ring, green bold text, no fill), so the ring carries it,
not colour alone; other traced floors as plain Deep Ink text with no shape behind them, so nothing reads as a
button; floors not traced yet in Soft Ink. Over 9 rows, it shows a window around the step's floor with the top
floor, G, the goal floor and ⋮ for the gaps. It is read aloud as one image: "Floor G, 1 of 4. Going to 3F". Display
only: no tap targets, and the highlights move with Next and Back without animating (D46).

### Indoor cut (S7)

The building on an indoor step, cut 1.2 m above the step's floor so rooms read as a plan with low walls. The floors
above stand in their places for the slide to pass through; the building's blocks below the cut (the stump) keep
their wall-foot darkening. Values for the green palette (all derived in `cutTones` from the map palette):

- **Slab and stump:** building white leaned 22% toward Campus Green, about #bdd2c0 (the selection tint, kept while
  cut). Lambert, opaque.
- **Walls:** the slab's colour at 80%, about #97a89a, 0.2 m thick boxes on the traced lines, both sides drawn. No
  wall-foot darkening and no cut-face colour.
- **Hallways:** the building colour at 0.2 in linear RGB (`CUT_HALL_SHADE`), a mid-grey neutral with no green,
  about #75736e: 3.4:1 against the slab. 1 m wide, unlit, just above the slab. Green hallways ran together with
  the indoor line and the goal mark (8▸ critique, D53).
- **Rooms:** the space between walls; no fills or door marks in v1. The goal room gets a label pin at its door, a
  Campus Green plate with its code, like a selected building label. The data has no room outlines yet, so no fill.
- **Order:** the cut draws after the see-through off-campus blocks, so none wash over it; the building's name label
  hides while it is cut. The route line and the dot are never clipped.

### "You are here" dot

An 18px Campus Green dot with a 3px white ring and the Float shadow, placed at the chosen floor's height in the
middle of the chosen building, or on the ground at the gate. On an indoor step with a spot, it stands at that spot
1 m above the floor. It is placed before the floor chip, and building labels
give way to it. On the route preview the camera frames the whole trip (the walk, the From building or gate, and the
To building) from about 8° off straight down, turned so the route's long side runs up the screen with From at the
bottom (D61); a route option redraws the line without moving the camera.

### Route line

The route's outdoor walk as a flat 5.5m Campus Green ribbon on a 1.1m white edge each side, just above the paths:
the edge does for the line what the white ring does for the dot, so it reads on the deep-green ground. Where a campus
building stands in front of it, the line shows through at 45%, so the whole way stays traceable. While a building is
cut open, the outdoor ribbon fades to 45%, so it doesn't swamp the entrance. Indoor legs are drawn on the cut floor
(8c-1, D46): a 1.6 m Campus Green line on a 2.9 m white casing.

**The walked part is grey** (D59 point 5, v2-B7): in the player, the outdoor ribbon behind the "you are here" dot
takes the palette's `walked` grey (Green `#5f5f5f`, Black `#737373`, Grey `#686b6a`); the white edge stays white. The
grey grows with the dot as it glides, at the dot's pace, and goes back on Back. Nothing is grey on the route preview;
on Arrived the whole walk is. The see-through copy and the dimmed ribbon go grey the same way. The cut floor's indoor
line stays green for now.

### Step card (S6)

The sheet's whole job in the player is the next move. A quiet header row: "Step 3 of 9" in Mid Ink semibold, then ⋯
and ✕ icon buttons. Under it the step's 24px icon in Campus Green on a 44px Pale Leaf-green wash circle, beside the
step's line in the **Step** role and its distance in Mid Ink. At the bottom a 52px hairline pill holding a green ‹ sits
beside the full-width primary **Next** ("I'm here" on the last step), so Next is always under the thumb; Back fades to
45% on step 1. ⋯ folds two plain 56px rows (Change where I am, All steps) out under the header, with no popover box.
A sideways swipe on the card steps too.

On the map, an outdoor step is seen from about 8° off straight down (the drone view, D61), with the dot in the middle,
turned so the walk from there points up the screen (it looks 15 m ahead, past small jogs) and zoomed so the walk to
the next step fits, at least 40 m each way. On Next the camera rides the dot there (D59). An indoor step on a labelled
floor flies to its spot at the floor's height from 40°, about 22 m around it, turned the same way; without
a spot it frames the whole building. Either way the building is cut open on that step's floor (7a); until its floor
file is in, or on an untraced floor, the floor band shows instead. The cut slides over 600 ms with a cubic ease-out:
down from the roof going in, up to the roof coming out, and from floor to floor on stairs (D45, D46). Reduced motion
cuts. Through a door on Next, going in or coming out, the camera's tilt and distance move with the slide, the same
600 ms ease-out, while it rides the dot on at the walk's pace (D63). The "you are here" dot moves to each step (D44).

### Arrived (S9)

A 28px green check beside "You're at ST311" in the Display role, then the card's one line with the floor words in
green, an O5 line in Mid Ink when the building's indoor map is still coming, the primary **Find next room**, and a
centred secondary **Done**.

### Motion

- **Sheet snap:** 260ms `cubic-bezier(0.16, 1, 0.3, 1)`; the map buttons and credit ride the same curve. Dragging
  disables the transition.
- **Camera flight:** 650ms, exponential ease-out; recenter flies home. Map controls use 0.12 damping.
- **Cut slide:** 600ms, cubic ease-out (`1 - (1 - p)³`: half done at about 125ms), so the plane is seen passing the
  floors; an interrupted slide carries on from where the plane is.
- **Dot glide:** on Next and Back the "you are here" dot glides along the route's line to the step's spot, 600ms with
  the cut slide's ease-out: outside, through doors and around G as one level, and up or down at the stairs between
  floors of one building, alongside the cut's slide. It jumps into another building's upper floor (D52).
- **Gestures (phone):** one finger pans, pinch zooms, a two-finger twist turns the map with the fingers (as in Google
  Maps), and two fingers dragged up or down tilt it. In 2D (D58) the tilt is off, and so is the twist outside the
  player.
- **Toast:** 160ms ease-out fade and 8px rise.
- **Reduced motion:** every transition is removed and camera flights become cuts.

### States

- **Loading:** "Loading the campus…" centred in Mid Ink.
- **Map failed** (in the same place, so it never looks like loading): a 40px Soft Ink icon, a Headline, one Body
  line in Mid Ink, and a secondary button only when pressing it can help. Split by cause:
  - "The map didn't download" + "Try again". The button shows only with signal, and it checks the site answers
    before reloading.
  - "This phone can't show the 3D map" + "You can still search for rooms and buildings." No button.
- **Offline lines** under the search pill (or to its right from 768px): a Sheet White plate with the Float shadow,
  Mid Ink text, and a 16px icon. Green check for "Ready offline"; a Soft Ink cloud-off for the lines that stay
  (saving paused, not saved, can't save).
- **Empty search:** Recent rooms, or a Try list (ST311, AG1104, a building) on first use.
- **Rejected code:** a red reason ("[Building] has no 9th floor.") then "Did you mean" with three rooms. Unknown prefix:
  "No building uses QQ." then every building with its code.
- **Building without a room list:** its name and "Not searchable yet. It has no room list in the app."

## Do's and Don'ts

### Do

- **Do** keep exactly one primary button per sheet, Campus Green, full width, 52px.
- **Do** use `accent` for green fills in both themes and `accent-ink-dark` for green text on dark surfaces.
- **Do** put every map label on a surface plate with the Float shadow, so text reads on any ground colour.
- **Do** frame selections in the uncovered map area and fly to a heading that sees the floor band.
- **Do** show the building and floor first on any room result; the route comes after.
- **Do** keep tap targets at 48px for icon and map buttons and 56px for rows.
- **Do** cut every transition and camera flight under `prefers-reduced-motion`.
- **Do** keep "Map data © OpenStreetMap contributors" visible on the map and the Beta tag in the pill.

### Don't

- **Don't** use Google's identity: no Google logo, Google Sans or Google map pin.
- **Don't** use DLSU's seal, logo or official marks; the green is a colour, not a mark.
- **Don't** add a second accent, or let a map palette change the interface green.
- **Don't** give map buildings outlines, windows, textures or individual colours; light and the selection tint only.
- **Don't** wrap sheet content in shadowed cards or add dividers between rows; group with spacing and weight.
- **Don't** add entrance animations or motion that delays reading.
- **Don't** copy prototype-only scaffolding into the real app: three.js r147 and its OrbitControls from a CDN (the
  app self-hosts React Three Fiber and works offline), the sample rooms and their "Sample room" marker, the
  prototype's palette switcher in the info sheet (the colour mode lives in the map options sheet, D58), the
  "Prototype:" notes and the Start toast, and the label-collision width estimate.
- **Don't** add new text roles below 16px or tap targets below 48px (D30). Only the Beta tag and the OSM credit
  sit at 14px.
