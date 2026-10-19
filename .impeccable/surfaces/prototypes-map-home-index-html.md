---
version: 1
slug: "prototypes-map-home-index-html"
primary_target: "prototypes/map-home/index.html"
related_targets: []
---

# Map home (prototype)

Scope: the map home screen (S1) and the find-a-room path it opens (S2 search, S3 room card, S4 Where are you, S5
summary stub), as a phone-testable prototype. Not app code. Mode: Operate.

Audience and job: a freshman walking between classes who knows a room code and needs the building and floor now.
Constraints: Google Maps interface convention (owner's choice); D13 massing-model map; real OSM campus; plain English;
no Google or DLSU marks; offline-first manners (no runtime fetch beyond the page's own files).

Memorable moment: type ST311 and the STRC block lights up with a ring at its third floor.

Unresolved: the D13 palette (A orange, B green, C grey), compared on phones via the ⓘ sheet.

## Direction contract

THESIS: A map app every student already knows how to use, whose map is a pale massing model of their own campus. It
refuses both the category's flat grey 2D tiles and a bespoke "game" interface that would need learning.

OWN-WORLD: White and near-white floating chrome (search pill, bottom sheet, round map buttons) in the phone's system
face, soft offset shadows, one accent shared by the route, the selected building and "you are here". Under it, D13:
pale blocks shaped by light, a flat saturated ground, thin bright path lines, the city around campus muted.

STORY: The student sees their campus, types a code, sees which building and which floor before anything else, then
says where they are to get a route.

FIRST VIEWPORT: Full-bleed 3D campus at a high angle, Taft Avenue toward the bottom. Search pill pinned at the top
(about 48 px tall) with ⓘ and a Beta tag. Round recenter button bottom right above the sheet. Sheet at peek with one
line, "Type a room, like ST311", or Recent. Primary action: the search pill.

FORM: Google Maps convention (owner-pinned; the category standard executed straight, bar set by Google Maps, Apple
Maps and Waze). Signature move: the found floor drawn as a solid accent band one storey tall, with a floor chip.
seed: none (concept-seed not run: the owner pinned the direction, so the category standard is executed straight)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and
every shipping raster carrying its provenance
