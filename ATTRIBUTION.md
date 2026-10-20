# Attribution

This repo has two licenses (D4 in [`docs/DECISIONS.md`](docs/DECISIONS.md)):

| What | License | File |
|---|---|---|
| Code (everything outside `data-src/` and `public/data/`) | MIT | [`LICENSE`](LICENSE) |
| Campus map data (`data-src/`, and `public/data/` compiled from it) | ODbL v1.0 | `data-src/LICENSE` |

## OpenStreetMap

Building footprints, gates, paths and other outdoor map data come from OpenStreetMap.

**© OpenStreetMap contributors**, available under the Open Database License (ODbL):
<https://www.openstreetmap.org/copyright>

Because our compiled map data mixes OSM data with our own, it is a derivative database and is shared under the same
ODbL. The app shows this credit on the map and in its About screen.

## Indoor floor plans

Floor plans in `data-src/floors/` are traced from De La Salle University's evacuation maps. Whether they may be
published is still an open question for the university (D4, D21). This is a student project, not an official DLSU
app.
