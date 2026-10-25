# v2 plan: what changes in the code

The architecture changes behind D55–D61, agreed 2026-10-25. The requests themselves, with today's behaviour, are in
`docs/V2-UX-REQUESTS.md`; who builds what is in `docs/SPLIT-v2.md`; the order is in `docs/ROADMAP-v2.md`.
`docs/ARCHITECTURE.md` still holds for everything not named here: same stack, same layer rules, no new dependencies.

## 1. One saved map-settings store (D57, D58, D60)

The three map choices live in one place that both lanes read. New folder `src/shared/settings/`:

```ts
// src/shared/settings/map-settings.ts: pure, unit-tested
export type ColourMode = 'green' | 'black' | 'grey';
export type MapView = '3d' | '2d';
export type BuildingLook = 'solid' | 'see-through';

export type MapSettings = { colour: ColourMode; view: MapView; buildings: BuildingLook };

export const DEFAULT_MAP_SETTINGS: MapSettings = { colour: 'green', view: '3d', buildings: 'solid' };

/** Reads what was saved; anything missing or unknown falls back to the default, field by field. */
export function parseMapSettings(saved: string | null): MapSettings;

// src/shared/settings/useMapSettings.ts: a zustand store (like campus-scene's headingStore)
// that loads with parseMapSettings and saves to localStorage on every change.
export const useMapSettings: UseBoundStore<{ settings: MapSettings; set: (patch: Partial<MapSettings>) => void }>;
```

- Saved under one `localStorage` key, `dlsu-map.map-settings`, wrapped in try/catch: private mode or cleared storage
  gives the defaults, never an error.
- `parseMapSettings` is test-first (one right answer per input).
- It's in `shared/`, so `shared/` still imports nothing from features (`eslint.boundaries.js`).

## 2. The camera (D58 camera half, D59, D61): Lane B

Today the dot (`useDotGlide.ts` + `glide.ts`, D52) and the camera (`useCameraFlights.ts`, D44) run separately. v2
makes the glide the one clock both read.

| File | Change |
|---|---|
| `campus-scene/follow.ts` (new) + `follow.test.ts` | Pure: from the glide's path and progress, where the camera looks (the dot) and its heading (walking up, looking ahead). Duration from distance, clamped to 1–3 s. Test-first |
| `campus-scene/components/useCameraFollow.ts` (new) | Each frame of a glide, sets the camera's target and heading from `follow.ts`. A pan or compass tap pauses it until the next step |
| `campus-scene/components/useDotGlide.ts`, `glide.ts` | Glide duration comes from `follow.ts` instead of a fixed 600 ms on one level; climbs keep 600 ms |
| `campus-scene/components/useCameraFlights.ts` | Flights stay for jumps (open/close a building, Back's quick cut, reduced motion); steps hand over to the follow |
| `campus-scene/components/CameraRig.tsx` | `stepView` for outdoor steps at 8° from vertical, fitted to the step's stretch; `tripView` (S5) top-down, long side vertical; the door tilt 8° → 40°; 2D locks polar 0 and north up outside the player |
| `campus-scene/components/useTwistTilt.ts`, `gestures.ts` | Tilt and twist off in 2D |
| `shared/config/camera.ts` | `DRONE_POLAR` (8°), follow look-ahead and duration limits |

## 3. The map's look (D56, D57, D58 scene half, D60): Lane A

| File | Change |
|---|---|
| `shared/config/palette.ts` | `MAP_PALETTES: Record<ColourMode, MapPalette>` from the prototype's three; each has its own haze colour. `MAP_PALETTE` call sites read the current mode |
| `shared/config/contrast.ts` + tests | The WCAG AA pairs run over all three palettes |
| `campus-scene/components/MapScene.tsx`, `Masses.tsx`, `Labels.tsx`, `RouteLine.tsx`, `FloorBand.tsx` | Read the palette for the saved mode |
| `campus-scene/massing.ts` + `Masses.tsx` | 2D: very low blocks. See-through: campus buildings at reduced opacity, except the goal and selected building |
| `campus-scene/components/fadeStore.ts` (new) | `{ faded: ReadonlySet<string>; set(slugs) }`: the buildings to fade right now. Lane B's camera code writes it during a route; `Masses.tsx` reads it |
| `campus-scene/components/MapButtons.tsx` + new `MapOptions.tsx` | The map options button and its sheet: colour mode, 2D/3D, Solid/See-through (`shared/ui/Segmented.tsx`). The compass hides in 2D |
| `search/components/SearchScreen.tsx`, `SearchPill.tsx` | S2 becomes a card rising from the bottom over a frozen map (D55) |

## 4. What stays the same

- No new dependency, no new request to another origin, no change to `public/_headers`.
- Search matching, routing and the data bundle don't change.
- The size budget (D49, first load ≤ 200 kB gzipped; 183.8 kB today) is checked on every v2 PR.
- Docs that change with the code: `docs/user-flows.md` §3.3 (S2) with v2-A1, DESIGN.md (search, palettes, map depth,
  campus leads) with the PR that changes each.
