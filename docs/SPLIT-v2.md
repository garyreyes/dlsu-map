# Splitting the v2 work

Who builds what in v2 (D55–D61), agreed 2026-10-25. The lanes and working rules of `docs/SPLIT.md` still hold; this
file only changes who owns which files for v2. The code changes are in `docs/V2-PLAN.md`, the order in
`docs/ROADMAP-v2.md`.

## Who owns what

| | Gary (Lane A) | Charles (Lane B) |
|---|---|---|
| **Requests** | 1 search card (D55), 3 colour modes (D57), 4's scene half and the map options button (D58), 6's manual setting and fading (D60) | 5 camera follow (D59), 7 drone view (D61), 4's camera half (D58), 6's "which buildings block the route" (D60), 2 fog (D56, done in #100) |
| **Bugs** | | #87 (S4 sheet 8px too wide), #88 (retry a failed building file) |
| **Owns these files** | `features/search/components/`, `shared/config/palette.ts`, `shared/config/contrast.ts`, `campus-scene/components/` `MapScene`, `Masses`, `Labels`, `FloorBand`, `MapButtons`, `MapOptions` (new), `fadeStore.ts` (new), `campus-scene/massing.ts` | **The camera:** `campus-scene/components/` `CameraRig`, `useCameraFlights`, `useCameraFollow` (new), `useDotGlide`, `useTwistTilt`, `headingStore.ts`; `campus-scene/` `follow.ts` (new), `glide.ts`, `gestures.ts`; `shared/config/camera.ts` |
| **For the bugs** | | `location-picker/components/WhereAreYou.tsx`, `useBuildingSpots.ts` (Lane A's folder, lent for #87 and #88) |

Owning a file means you write it and the other asks before changing it, as in `docs/SPLIT.md`.

## Where the lanes meet

| Meeting point | Who writes it | Who reads it | When |
|---|---|---|---|
| **Map settings store** (`src/shared/settings/`, V2-PLAN §1) | Gary, in v2-0, reviewed by Charles | Both: palettes and blocks (A); 2D camera lock (B) | First. Nothing else in v2 waits on anything else |
| **Building fade** (`fadeStore.ts`) | Gary writes the store and makes `Masses.tsx` read it (v2-A4) | Charles's camera code fills it during a route (v2-B6) | Charles can start against the store's type before A4 lands |
| **`RouteLine.tsx`** | Gary (palettes, v2-A2) | Charles adds the walked part in grey (v2-B7), **after** A2 is merged | B7 is last |

## Rules for v2

- **Same rules as `docs/SPLIT.md`:** one branch per sub-phase named after its ID (`v2-0-map-settings`,
  `v2-B1-follow-math`), every change through a PR, look at each other's PRs, mark the roadmap in the same PR.
- **One e2e run at a time.** Two runs share wrangler's port 8788 and the same `dist`, and the server drops mid-run.
  Say in chat before a full e2e run.
- **Size budget on every PR** (D49). If a PR pushes first load past 200 kB, it doesn't merge.
- **Touching the other person's file:** a short message first, then a small PR of its own.
