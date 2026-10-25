# v2 UX requests (Gary, 2026-10-24): for Charles to agree, disagree or change

**Status:** proposed. Nothing here is decided or built yet. Each request below becomes a D-number (D55 onward) in
`docs/DECISIONS.md` once Gary and Charles agree on it. After that, Gary writes a v2 plan, then `docs/SPLIT-v2.md` and
`docs/ROADMAP-v2.md` so both lanes can work in parallel without touching the same files.

**Where this came from:** Gary tested `main` at `7544811` (#97 merged) on a phone and on the PR #97 preview
(`https://pr-97-dlsu-map.gary-reyes.workers.dev`), and compared it with the old prototype (`prototypes/map-home/`).

**How to read this file:**

- **Gary's request** is what Gary asked for, in Gary's words as closely as possible. That part is the request.
- **Today** is what the app does now, with the file or decision behind it, so you can check it.
- **Open questions** are details Gary hasn't decided. Answer them or leave them for the v2 plan.
- **Suggestions** are Claude's ideas while writing this up. They are *not* Gary's requests. Agree or reject them
  separately.

**Please reply per request** with one of: agree / disagree (why) / agree with a change (what). A GitHub issue comment
or a reply in chat both work.

## Two questions for Charles to decide

Gary asks Charles to make these two calls in this PR. Both shape a lot of the work, so please answer them first.

1. **Black mode and the interface (request 3):** in Black mode, should the search bar, sheets and panels also go dark,
   like screenshot 1, or should only the map go dark?
   - **Map only:** smaller. The interface stays light in every mode, as DESIGN.md has it today.
   - **Interface too:** a night mode. It's a much bigger job: DESIGN.md has only light interface tokens, every screen
     needs dark tokens and contrast checks, and the roadmap notes say a dark interface means re-polishing every
     earlier screen.
2. **Camera heading while a route plays (request 5):** should the map turn so the walking direction is always up
   (like navigation apps), or keep north up while the dot moves across it?
   - **Walking direction up:** "go left" on screen matches turning left, but the map rotates at every turn.
   - **North up:** the map stays still and is easier to recognise, but the student has to turn the direction in their
     head.

## Why these matter

The aim of v2 is that a first-time student understands the map and the route without effort (the UX floor in
`CLAUDE.md` and `docs/PRODUCT.md`). Gary's main complaints from testing:

1. Search opens a blank white page, so you lose the map.
2. The haze makes the map look washed out.
3. Next/Back feels like teleporting, so after a turn you can't tell where you came from.
4. Buildings hide the route, especially between buildings.

The model to copy is **Apple Maps** (2D/3D, map modes) and **Google Maps / Apple Maps walking directions** (a top-down
"drone" view between buildings).

## Big change in priorities: iterate now, polish later

- **Gary's request:** do the feature changes first. Hold off on the Impeccable critique-and-polish passes, which cost
  many more tokens than the changes themselves.
- **What this pauses:** the roadmap rows 2▸, 3▸, 5▸ and 10▸ (all "not started"), and the small critique leftovers in
  the 2026-10-24 checkpoint. They stay on the list for later. Nothing already done gets undone.

## Floors are on hold until we get the official floor plans

- **Gary's request:** the team is asking the school for the official interior floor plans. Until they arrive, don't
  finish the remaining buildings or re-trace floors from the evacuation-map photos, because the plans would replace
  that work.
- **Today:** 3 of 10 buildings are done and checked: STRC (4 floors), Velasco (5) and St. Joseph (6), 15 floors in
  all. St. Miguel has its room list (`data-src/rooms/miguel.csv`) but no floors. Gokongwei, Yuchengco, St. La Salle,
  Andrew (20 floors), Razon and Mutien-Marie have nothing yet. Roadmap 9a–9d, and so the private beta (10d), wait on
  this. `docs/PROJECT_FACTS.md` currently says the evacuation photos are the main source; that note gets updated.
- **Open questions:**
  1. When the plans arrive, do we re-trace the 3 finished buildings from them too, or only check them against the
     plans?
  2. What work can Lane B do in the meantime? The v2 split will need an answer, for example the routing side of
     requests 5 and 7 below.

## Request 1: search opens over the map, not as a full white page

- **Gary's request:** tapping "Where to?" should pop a search panel up over the map, like the old prototype's
  floating panel (screenshot 1). It should not replace the screen with a blank white page (screenshot 2, which Gary
  crossed out).
- **Screenshot 1** (the prototype, opened on a wide screen) shows the map filling the screen. The search pill sits at
  the top left, and a dark rounded panel floats under it at the left, with the map visible around it. **Screenshot 2**
  (today's app on the PR #97 preview) shows the search: a white page covering everything, with a back arrow and
  "Room code or building", a green line under the bar, and only "Type a room, like ST311, or a building." below.
- **Today:** `src/features/search/components/SearchScreen.tsx` is full-screen on purpose: `fixed inset-0`, a 64 px bar,
  a modal that makes the map inert (S2 in `docs/user-flows.md` §3.3). The prototype's search was full-screen too
  (`.search { position: fixed; inset: 0 }`). What Gary likes in screenshot 1 is the **floating panel over a visible
  map**, which the prototype used for its sheet and side panel, not its search.
- **What this means in practice:** the search field and results live in a floating, rounded panel anchored to the pill.
  The map stays visible and dimmed or blurred behind it, never replaced by white. Results update as you type, as now.
  Search behaviour (strict matching, Go only on an exact match, D38) doesn't change; only the presentation does.
- **Open questions:**
  1. On a phone the keyboard covers about half the screen. How much map should still show: a strip at the top, or the
     panel pulled up from the bottom like Apple Maps' search card?
  2. Should the panel be dark, as in screenshot 1, in every colour mode, or follow the colour mode (request 3)?
  3. Should the map behind it be pannable while search is open, or stay inert like now?
- **Touches:** S2 in `docs/user-flows.md`, DESIGN.md's search spec, `SearchScreen.tsx`, `SearchPill.tsx`, and the e2e
  tests that open search.

## Request 2: less fog, or none

- **Gary's request:** reduce the foggy look on the map, or remove it.
- **Today:** D13 and DESIGN.md (Map depth) chose a green haze that fades the distance into the sky colour.
  `src/shared/config/palette.ts` sets `HAZE_NEAR = 0.8` and `HAZE_FAR = 1.5`. Those are multiples of the camera's
  distance to what it's looking at, so the fog starts just short of the target and is solid at 1.5× the distance.
  That's why the map looks washed out even at close zoom. `MapScene.tsx` applies it, with the background set to the
  haze colour.
- **Options:**
  1. **Lighter:** push the fog much further out, for example 2.5× to 5×, so only the far horizon fades.
  2. **None:** remove it. Without fog, the edge of the ground plane and the end of the OpenStreetMap snapshot may show
     at wide zoom, so the camera's max distance or tilt may need limiting, or the ground made bigger.
  3. **Per colour mode:** each mode in request 3 gets its own amount.
- **Open question:** which option? Claude's suggestion is option 1, then check option 2 on a phone. The fog hides the
  edge of the world, and with request 4's 2D view the camera looks straight down, where fog does nothing anyway.

## Request 3: three colour modes the user picks: Green, Black, Grey

- **Gary's request:** let the user choose between three map colour schemes: **Green** (today's look), **Black** (like
  screenshot 1), and **Grey**.
- **Today:** D13 compared three palettes in the prototype, and in 2c the owner picked green and the switch was removed.
  The app has one palette (`MAP_PALETTE` in `src/shared/config/palette.ts`). The prototype's three palettes still
  exist in `prototypes/map-home/scene.js`:

  | Mode | ground | building | path | road | cityMix | fog |
  |---|---|---|---|---|---|---|
  | Black | `#121614` | `#e8edf3` | `#56645d` | `#77857e` | 0.4 | `#163326` |
  | Green (today) | `#175f3c` | `#f2eee5` | `#5f9c7c` | `#7fb396` | 0.5 | `#4f9a72` |
  | Grey | `#c4c7c6` | `#fbfbfa` | `#ffffff` | `#ffffff` | 0.32 | `#cfe5d7` |

  The prototype put the switch in its info panel under "Map colours", saved the choice on the device, and changed only
  the map. The interface green stayed fixed in every mode.
- **What this means in practice:** this reverses part of D13, so it needs a new decision. The choice is saved on the
  phone, so it survives closing the app and works offline. Everything drawn on the map has to stay readable in all
  three modes:
  - the route line,
  - the "you are here" dot,
  - the floor band,
  - the labels and spot plates,
  - the cut floor tones (`cutTones()` already derives them from the palette).

  10c checked WCAG AA over the green map only (`src/shared/config/contrast.ts`), so those checks have to cover all
  three modes.
- **Open questions:**
  1. **Black mode and the interface:** in screenshot 1 the pill and the panel are dark too. Does Black mode also make
     the interface dark (a night mode), or only the map? A dark interface is a bigger job: DESIGN.md has only light
     interface tokens, and the roadmap notes say a dark interface means re-polishing every screen.
  2. Which mode is the default on first open? Green, as today?
  3. Where does the switch live? The ⓘ sheet as in the prototype, or a map options button (see the suggestion under
     request 4)?

## Request 4: a 2D / 3D toggle, like Apple Maps

- **Gary's request:** model the app on Apple Maps, especially its 2D and 3D views, so each user picks the one they
  prefer.
- **Today:** the map is always 3D. Home is about 52° from straight down (`HOME_POLAR`), the user can tilt down to about
  70° (`MAX_POLAR`), and buildings are extruded masses. Two-finger drag tilts (gestures in
  `src/features/campus-scene/gestures.ts`).
- **What Apple Maps does:** a map button switches between a flat top-down map (2D) and a tilted map with 3D buildings.
  In 2D the camera looks straight down, north is up unless you rotate, and buildings read as flat footprints or very
  low blocks. In 3D the camera tilts and buildings stand up.
- **What this means in practice:**
  - **2D:** the camera locks straight down (polar 0). Tilt gestures are off. Buildings are drawn as flat footprints,
    or squashed nearly flat, so nothing covers the paths. Labels stay upright and readable.
  - **3D:** today's view.
  - The choice is saved on the phone.
  - Indoors, a 2D cut floor is a plain floor plan seen from above, which may be the clearest view for indoor steps.
- **Open questions:**
  1. In 2D, are buildings completely flat (footprints only), or very low blocks so they still read as buildings?
  2. Does the route player respect the user's 2D/3D choice, or use its own camera (request 7)?
  3. In 2D, is north always up, or can you still twist the map?
- **Suggestion (Claude, not Gary):** one **map options** button on the map, like Apple Maps' map-mode button, holding
  the colour mode (request 3), 2D/3D (this request) and building see-through (request 6). That keeps all three out of
  the way until wanted (progressive disclosure) and in one place you can find again.

## Request 5: smooth Next and Back, no teleporting

- **Gary's request:** when you tap Next (or Back) the view shouldn't teleport to the next step. It should animate
  gradually from where you were to where you're going. Teleporting is confusing, especially at turns, because you
  can't tell where you came from.
- **Today:**
  - D44: on each step the camera flies to the step's spot in 650 ms.
  - D52 (Charles built it): the dot glides 600 ms along the route line on one level and climbs at the stairs between
    floors. But D52 point 5 says **"the camera is unchanged"**: it still flies straight to each step.
  - D52 point 4 says the dot **jumps** in some cases: into another building's upper floor, onto a floor without a spot,
    on and off the player, and under reduced motion.
  - So today the dot moves smoothly, but the camera cuts across in 650 ms, turning and moving at once. The words change
    instantly. That is what reads as teleporting.
  - D52 listed the fix Gary now wants as its rejected alternative: "The camera following the dot down the path, longer
    for longer walks."
  - Code: `src/features/campus-scene/glide.ts` and `components/useDotGlide.ts` (the dot), and
    `components/useCameraFlights.ts` and `components/CameraRig.tsx` (the camera).
- **What this means in practice:**
  - **The camera follows the dot along the path**, so the screen travels the route the student walks. It doesn't
    jump between spots.
  - **Duration grows with the walk's length**, with a sensible minimum and maximum so a long walk doesn't take
    forever. Tapping Next again mid-animation skips ahead, as D52 already does for the dot.
  - **Turns rotate gradually**, so you see the corner happen. The camera's heading turns through the corner rather
    than snapping to the new direction.
  - **The cases where the dot jumps today get a smooth transition too**, as far as possible: entering a building, going
    up floors, going in and out of the indoor view.
  - **Reduced motion still gets a cut** (accessibility).
- **Open questions:**
  1. **Heading during a step:** travel direction up (like navigation apps), or north up with the dot moving across
     the map?
  2. **Speed:** a fixed speed (for example about 1–1.5 s per 100 m), or "about 1–3 s whatever the length"?
  3. Does Back play the walk in reverse, or cut back quickly?
- **Suggestion (Claude, not Gary):** to make "where did I come from?" answerable even after the animation, draw the
  part of the route already walked in a lighter or greyed style, and the rest in the strong route colour, like Google
  Maps does.

## Request 6: a building see-through control

- **Gary's request:** an option to change how transparent the buildings are. Solid buildings are distracting when you
  are trying to see where you're going.
- **Today:** off-campus buildings are already see-through (`CITY_OPACITY = 0.35`, DESIGN.md "Campus leads"). Campus
  buildings are solid. The entered building gets the indoor cutaway (D45, D46), but the buildings around it still hide
  things behind them.
- **What this means in practice:** the user can set campus buildings from solid to see-through. With buildings
  see-through, the route line, the dot and the goal show through them.
- **Open questions:**
  1. A slider, or a few steps (for example Solid / See-through / Outlines only)?
  2. Should it only be a user setting, or should the app also fade buildings automatically when they stand between the
     camera and the route? See the suggestion below.
  3. Does it apply to the selected or goal building too, or only the others?
- **Suggestion (Claude, not Gary):** a setting alone puts the work on the user. Consider also fading, during the route
  player only, just the buildings that block the line of sight to the route. Then the default view is clear without
  touching anything, and the setting stays for people who want more.

## Request 7: a top-down "drone" view for building-to-building directions

- **Gary's request:** when the directions go from one building to another (outdoors), show them like Google Maps or
  Apple Maps: a top-down "drone" view. Today it gets confusing when buildings cover the path. From straight above you
  can see the path, where you are and where you're going all at once.
- **Today:** outdoor steps are seen from 40° off straight down (`STEP_POLAR`, D44), chosen so tall buildings don't stand
  between the camera and the spot. In practice tall buildings like Andrew and Razon still cover parts of the path at
  40°. Indoor steps are also at 40° (D45).
- **What this means in practice:**
  - **Outdoor steps** look (nearly) straight down, zoomed so the whole leg fits on screen: the dot, the path to the
    next building and that building's entrance. From above nothing can hide the path.
  - **When you go in through a door**, the camera tilts back to the indoor view (the cut floor) with a smooth
    transition (request 5).
  - This is the outdoor half of request 4's 2D view, applied automatically to outdoor route steps.
- **Open questions:**
  1. Straight down (0°), or slightly tilted (about 10–15°) so buildings still read as 3D?
  2. Does the route preview (S5, before tapping Start) use the drone view too, to show the whole route at once?
  3. If the user picked 3D in request 4, do outdoor route steps still go top-down?

## What these change in the existing decisions and docs

These requests reverse or extend agreed decisions, so the v2 plan has to update them:

| Decision or doc | What changes |
|---|---|
| D13 (one green palette, switch removed) | Three user-picked modes; haze reduced or removed |
| D44 (camera flies to each step in 650 ms, outdoor at 40°) | Camera follows the path; outdoor steps top-down |
| D45 (indoor steps at 40°) | May change with 2D and the smooth transitions |
| D52 (dot glides, "camera unchanged") | Camera now follows the glide; fewer jumps |
| DESIGN.md (Map depth, Map palettes, Campus leads, search spec) | Haze, three palettes, see-through campus, search panel |
| `docs/user-flows.md` §3.3 (S2 search) | Floating search panel instead of full screen |
| `src/shared/config/contrast.ts` and 10c's checks | WCAG checks over all three modes |
| D49 (size budget) | Extra code must stay within it (183.8 of 200 kB today) |
| `docs/PROJECT_FACTS.md` (evacuation photos as the main source) | Official floor plans requested; floors on hold |

## Who might own what (draft for the v2 split; not decided)

Most of these live in Lane A's folders (`features/campus-scene`, `features/search`, `features/route-player`), but
Charles already built D52 in `campus-scene`. A first idea for keeping files apart:

- **Gary (Lane A):** request 1 (search panel), request 3 (colour modes, settings storage), request 4 (2D/3D and the
  map options button), request 6 (see-through).
- **Charles (Lane B):** request 5 (camera following the glide, building on the D52 code Charles wrote), request 7
  (the drone view for outdoor steps), and request 2 (fog), since it's in the same camera and scene code.
- **Shared first:** a small contract PR for the saved map settings (colour mode, 2D/3D, see-through) that both sides
  read, so neither waits on the other.

Requests 4, 5 and 7 all touch the camera (`CameraRig.tsx`, `useCameraFlights.ts`), so they need a clear owner or an
order. The v2 split decides this.

## Next steps

1. Charles (or Charles's LLM) replies per request: agree / disagree / change, and answers any open questions Charles
   has an opinion on.
2. Gary and Claude settle the remaining open questions and write the agreed requests as D55 onward.
3. Claude writes the v2 plan (architecture changes), then `docs/SPLIT-v2.md` and `docs/ROADMAP-v2.md`.
