---
name: floor-extract
description: Turn an evacuation-map photo of one DLSU floor into a draft floor (walls + hallway line) and clean it up. Use when the owner uploads floor photos, or says "trace this floor" / "add <building> <floor>".
---

# Floor extract (per floor, ~70 times across the project)

Decisions D17 and D29; facts in `docs/PROJECT_FACTS.md` "Floor photos and extraction". Photos are DLSU's: they live
in `data-src/photos/` (gitignored) and are never committed. Everything the tool writes goes to
`tools/floor-extract/out/` (gitignored too). Official DLSU plans are not guaranteed, so this is the main path.

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
5. **Inspect** `out/<name>/2-overlay.png`: red = walls, blue = route. Expect stair/ramp treads and boxes around exit
   signs or "YOU ARE HERE" as false walls, and some short stubs or outer walls missing.
6. **Clean up** (6b/6d define the floor file): add missed walls, delete false ones, label room numbers (photo +
   lobby directory), stairs, elevator (✕-box), doors.
7. **Owner checks** `3-preview-3d.png` (later the dev preview, 6d); only then is the floor marked `checked: true`.

Fit onto the OSM footprint (meters) is 6b, still unproven.
