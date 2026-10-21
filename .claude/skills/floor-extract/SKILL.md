---
name: floor-extract
description: Turn an evacuation-map photo of one DLSU floor into a draft floor (walls + hallway line) and clean it up. Use when the owner uploads floor photos, or says "trace this floor" / "add <building> <floor>".
---

# Floor extract (per floor, ~70 times across the project)

Decisions D17 and D29; facts in `docs/PROJECT_FACTS.md` "Floor photos and extraction". Photos are DLSU's: they live
in `data-src/photos/` (gitignored) and are never committed. The tool's pictures go to `tools/floor-extract/out/`
(gitignored too; `out/` below means that folder); only `floor` and `edit` write the floor file, which is committed
(D21). Official DLSU plans are not guaranteed, so this is the main path.

Bash needs Node on PATH first: `export PATH="/c/Program Files/nodejs:$PATH"`.

1. **Name the photo** `<building>_<NN>F.jpg` in `data-src/photos/` (ground floor = `01F`; rooms 1xx).
2. **Rough corners:** look at the photo (Read shows it downscaled; multiply by the factor it states) and note the
   building's 4 outer corner pillars: top-left, top-right, bottom-right, bottom-left.
3. **Exact corners:** `npm run -s floor-extract -- crop data-src/photos/<file> x,y x,y x,y x,y`, then read each
   `out/<name>/crop-N.png`. Read the pillar's centre **off the grid labels** (photo pixels); near the photo's edge the
   crop shifts, so never compute offsets by hand. Precise corners matter: rough ones lose half the walls. For a
   building that isn't a rectangle, extend the outer walls' lines to make 4 corners.
4. **Extract:** `npm run -s floor-extract -- extract data-src/photos/<file> tl tr br bl` (add `--style green-sign` or
   `--style white-map` only if the detected style is wrong; STRC is green-sign, every other building white-map).
5. **Inspect** `out/<name>/2-overlay.png`: red = walls, blue = route. If it looks sane, write the floor file:
   `npm run -s floor-extract -- floor data-src/photos/<file>` → `data-src/floors/<building>/<NN>.json`, `checked:
   false`, `fit.turn: 0`. Set `fit.turn` (0 or 180) by hand from something on the sign the owner can place: STRC's
   ground-floor guard room is at the Taft end, so STRC is 180 (PROJECT_FACTS).
6. **Clean up, in a review → edit loop** (D17). The draft always needs it.
   - `npm run -s floor-extract -- review data-src/floors/<building>/<NN>.json [--tiles N]` draws the file's walls
     over the straightened photo, red and **numbered by their index in the file**, the hallways in blue, and a grid
     labelled in **plan px**. Read `out/<name>/review-1.png` … `review-N.png` (default 4 tiles; use more for a
     long sign so the numbers stay readable).
   - Write a spec to `out/<name>/` (gitignored), for example `out/strc_01F/c01.json`:
     `{"delete": [20, 26], "add": [[0, 105, 0, 712], [178, 420, 178, 725]], "hallways": [[…]]}`. `delete` takes
     indices from the last review; `add` takes lines in plan px, read off the grid (flat x, y pairs, 2+ points);
     `hallways`, if given, replaces every hallway line. Any part can be left out.
   - `npm run -s floor-extract -- edit <floor file> tools/floor-extract/out/<name>/c01.json` applies it and checks
     the result against the compiler's schema. It refuses a wall index that isn't there, an index listed twice and a
     line past the sign. **Every edit renumbers the walls: run `review` again before the next spec.** Editing a
     checked floor sets it back to `checked: false`, since the owner checked the old walls.
   - Cleanup rules from STRC (6d):
     - Delete stair and ramp treads and stair stringers: stairs come back as their own data in 8a.
     - Close the outer walls at both ends, and keep one line where the outer wall is drawn double.
     - Add the light-grey walls the extraction misses: room dividers, short stubs, hallway walls.
     - Box in lift shafts (the ✕-box).
     - If the route has boxes drawn around exit signs or "YOU ARE HERE", redraw the hallways as the main hallway
       line plus one branch to each stair.
   - Room labels, doors, stairs and elevators aren't in the floor file until 8a adds them.
   - `npm run compile-data` notes how far each floor's walls sit from its OSM outline (median and 90th percentile).
     STRC's cleaned floors are 0.5–0.6 m at the 90th. Past 1.5 m it adds "check its corners and turn", usually
     missed outer walls or rough corners; on a checked floor that fails the build.
7. **Look before the owner does:** `npm run -s floor-extract -- shots <building>` compiles the data, opens P1 (the
   dev floor preview) in Edge for every floor file and writes `out/shots/<building>-NN.png`. It fails on a page or
   console error, a failed load (other buildings' missing floor files aside), or a request to another site. Check each floor sits inside the yellow outline with the main pin (orange) at
   the right end.
8. **Owner checks** in P1 (`npm.cmd run dev`, then `/preview.html?building=<slug>&floor=<n>`). Only the owner says a
   floor is right; then Claude sets `checked: true` in a PR.
