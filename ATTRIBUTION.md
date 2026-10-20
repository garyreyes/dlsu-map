# Attribution

This repo has two licenses (D4 in [`docs/DECISIONS.md`](docs/DECISIONS.md)), plus floor plans we can't license yet:

| What | License | File |
|---|---|---|
| Code: everything not listed below | MIT | [`LICENSE`](LICENSE) |
| Campus map data: `data-src/` and `public/data/` (compiled from it), plus the OSM-derived samples and fixtures `prototypes/map-home/campus.json`, `src/shared/data/*.sample.json` and `scripts/fixtures/` | ODbL v1.0 | `data-src/LICENSE` (added in #12) |
| Indoor floor plans: `data-src/floors/` | Not ours to license yet | See [Indoor floor plans](#indoor-floor-plans) |

## OpenStreetMap

Building footprints, gates, paths and other outdoor map data come from OpenStreetMap.

**© OpenStreetMap contributors**, available under the Open Database License (ODbL):
<https://www.openstreetmap.org/copyright>

Because our compiled map data mixes OSM data with our own, it is a derivative database and is shared under the same
ODbL. ODbL data can't be relicensed as MIT, so any file holding OSM-derived data is under ODbL wherever it sits. The
app shows this credit on the map and in its About screen.

## Indoor floor plans

Floor plans in `data-src/floors/` are traced from De La Salle University's evacuation maps. Whether they may be
published is still an open question for the university (D4, D21), so they are not offered under ODbL or any other
license yet. This is a student project, not an official DLSU app.
