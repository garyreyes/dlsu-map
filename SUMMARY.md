# DLSU 3D Campus Navigator: Project Summary

> **Status:** initial planning, under review. No app code yet (as of 2026-10-18).
> **Looking for:** a second pair of eyes on the plan before we start building. See [How you can help](#how-you-can-help).

Detailed docs: [`docs/PLAN.md`](docs/PLAN.md) (full plan) · [`docs/DECISIONS.md`](docs/DECISIONS.md) (every
decision, with evidence) · [`docs/HANDOVER.md`](docs/HANDOVER.md) (the original brief; PLAN.md wins where they
differ).

Room codes in examples (`B305` = Andrew, `G304` = Gokongwei) are **placeholders** until the official prefixes are
confirmed.

---

## What it is

A free, mobile-first 3D map of De La Salle University (Manila) that gets you to any room.

- Type a room code like **`G304`**, or a sentence like **"nasa B305 ako, papunta G304"**, and get a route.
- The campus is shown as a clean 3D **"massing model"**: every building a simple pale block on a flat colored
  ground, paths as thin lines, and one accent color for your route.
- The route goes **outdoors** across campus to the right building and floor. Later, it also goes **indoors** floor
  by floor (stairs or elevator).
- Inside a building (later), the view becomes a **Sims-style cutaway**: the roof and upper floors are sliced off so
  you see the current floor's rooms and hallways from above.
- Works **fully offline** after the first open, because campus Wi-Fi and signal are unreliable, especially indoors.
- Runs in the phone's browser on **both iPhone and Android**. No app store needed.

## Why

New students, transferees and visitors get lost looking for rooms, and existing maps don't show floors or work
indoors without signal. Outdoors the app can follow you by GPS (D14), but there's no GPS indoors, so inside a
building you *say* where you are instead.

---

## How it works (for users)

1. **Open the link once** with any connection. The whole app and the campus map (a few MB) save to the phone. A
   "✓ Ready offline" badge confirms it. Optional: Add to Home Screen for an app icon.
2. **Say where you are.** Any of these work:
   - **Tap:** pick a building, then a floor. It defaults to the main entrance (ground floor) or the elevator lobby.
     Optionally pick a specific spot: elevator, stairs, main/side/back entrance, near a room, or tap the map. If
     you're outside, pick a gate (Gate 1–6, Agno).
   - **GPS:** "Use my location" when you're outdoors (D14, proposed). Still confirmed before routing.
   - **Type:** "I'm near B305", "nasa Gokongwei back entrance". English, Filipino and Taglish all work.
   - **Link:** a shared link like "meet me at G304" opens with the destination set.
3. **Say where to.** Room code, building name, or things like "nearest CR".
4. **Confirm:** the app shows *From [chip] → To [chip] → Go*. Tap a chip to fix it. It never routes on a silent
   guess.
5. **Follow the route** (two legs, D14):
   - **Outdoor leg, to the building:** if you allow GPS, an avatar walks along the route as you move, Waze-style,
     snapped to the path. This works without internet. If GPS is weak or off, you step through it instead.
   - **Indoor leg, to the room (later):** a "mall directory" view. You tap where you are, and step floor by floor.

   In both legs: a glowing line plus step-by-step text ("Take the elevator to 5F", "Exit via the main
   entrance", "Turn left after the CR"). Next/Back buttons move the camera, and the view switches between outdoor
   and indoor automatically.
   - **Route options** (collapsed by default): Stairs / Elevator / Auto for this route. Auto takes the elevator
     for 3+ floors.
   - **Avoid stairs** is a saved setting that skips *every* step: stairs, outdoor steps, stepped bridges.

There's no intro tutorial. The first screen just says "Search a room, like G304", and the app asks where you are
only when it needs to.

**Outdoor first, indoors later.** The campus is closed right now, so nobody can photograph the evacuation maps
that interiors are traced from. **v1 is the full outdoor campus:** routes end at the building's entrance and tell
you the floor ("G304 is on 3F"). Interiors come after the campus reopens, **starting with Andrew**.

---

## How it's built (for developers)

### Stack

All open source with permissive licenses, mostly MIT.

| Part | Choice |
|---|---|
| App | **TypeScript** + **React 19** + **Vite 8**, styled with **Tailwind 4** |
| 3D | **three.js** via **React Three Fiber** + **drei** (camera controls, text labels) |
| State / validation | **Zustand** / **Zod** |
| Route finding | **ngraph.path** (A* over a graph of hallways, walkways, stairs, elevators) |
| Search | Our own room-code + sentence parser, **uFuzzy** for typos, **cmdk** search palette |
| UI pieces | **react-modal-sheet** (pull-up panel), **sonner** (toasts), Radix/shadcn-style components |
| Offline | **vite-plugin-pwa** (service worker caches everything) |
| Quality | **Vitest** (unit), **Playwright** (end-to-end), **ESLint + Prettier**, Husky pre-commit, GitHub Actions CI |
| Hosting | **Cloudflare** (free, static files only) with a preview link for every pull request |

### Where the map data comes from

- **Buildings outdoors:** real footprints from **OpenStreetMap**, which already has all 16 main DLSU buildings,
  floor counts, skybridges, gates, and some elevators. We save a fixed copy in the repo and never download it while
  the app runs. The surrounding city blocks come from OSM too, for context.
- **Place names and walkways:** the official DLSU campus layout map (covered walks, plazas, which streets to cross).
  It's not to scale, so positions always come from OSM.
- **Indoors:** we trace each floor from **photos of the fire evacuation maps** posted on every floor, using a small
  dev-only tracing tool (MapLibre + Terra Draw). You pin the photo over the building's OpenStreetMap outline, then
  draw rooms, doors and hallway lines. The photos stay out of the repo and out of the app.
  These maps are DLSU's, so **we ask Facilities before a public launch**. Building and testing don't need to wait.
- **A build script** checks all the data, converts it to meters, and **builds the walking graph automatically** from
  hallway and walkway lines. It fails the build if any room can't be reached, which catches tracing mistakes.

### Key techniques

- **One mesh for all outdoor buildings** (about 1 draw call), and the app **only redraws when something changes**.
  Both help phone battery and frame rate.
- **The massing-model look is cheap on purpose:** the simplest lit material, no real-time shadows, and the soft
  shading where walls meet the ground is baked in when the buildings are built.
- **Cutaway view:** one GPU "clipping plane" slices the building you're in at 1.2 m above the current floor.
  Animating it down from the roof is the "entering the building" effect. Only that building is cut. The avatar,
  labels, route line and the rest of campus are never clipped.
- **Sentence understanding:** a tiny (~3 KB) rule-based parser, not an AI model. A throwaway test version
  ([`docs/spikes/ask-parser-spike.mjs`](docs/spikes/ask-parser-spike.mjs)) shows the approach works for English and
  Taglish, but it still misses common phrasings (listed in D9). A real phrase test set will drive the actual parser.

---

## Key decisions (short version)

Full reasoning and evidence: [`docs/DECISIONS.md`](docs/DECISIONS.md).

| # | Decision | Why |
|---|---|---|
| D1 | Install **TypeScript 7** for fast type-checking and **TypeScript 6** for tools | TS 7 has no plugin API yet, so ESLint needs 6. Tested on the real stack |
| D2 | **ESLint + Prettier** (not Biome) | In testing, ESLint caught real bugs Biome missed |
| D3 | **Pin React to 19.3.x**, upgrade the 3D libraries together | React Three Fiber breaks on React 19.4 |
| D4 | **OpenStreetMap** footprints. Code is MIT, map data is ODbL with an on-map credit. Indoor data waits on Facilities' OK before a public launch | Real positions instead of guessing; licenses handled properly |
| D5 | **Cloudflare** hosting with a strict security policy (CSP) | GitHub Pages can't set security headers or give preview links |
| D6 | **The official campus map** is used for place names, streets and orientation only | It's not to scale; OpenStreetMap gives the real positions |
| D7 | **QR stickers are optional**, not core | They need university approval we may not get |
| D8 | **Tap flow** with smart defaults plus optional precise spots | Fast for most users, precise when needed |
| D9 | **Rule-based parser** for sentences. An on-device AI model (Qwen3-0.6B) only as a later opt-in, and only if needed | AI models are hundreds of MB and need newer phones; the parser is 3 KB and works everywhere |
| D10 | **Web app (PWA)**, not an app store download | Free, works on iPhone and Android, fully offline after first open |
| D11 | **Zero cost.** Only Claude Code is paid | Free tiers only, **no credit card on any service**, so limits block instead of bill |
| D12 | **Outdoor first** (v1), then interiors starting with **Andrew** | Campus is closed; outdoor data needs no site visit |
| D13 | **"Massing model" look:** pale blocks, flat colored ground, thin path lines, one accent color. Palette still open | Matches our style reference, and is cheap to render |
| D14 | *(proposed)* **Live GPS avatar outdoors, "mall directory" view indoors** | GPS works offline but not indoors, so the split is outdoor vs indoor, not online vs offline |

### Things we chose *not* to do
- No indoor positioning (Wi-Fi/Bluetooth beacons). GPS is used outdoors only (D14, proposed), and your location never
  leaves the phone.
- No accounts, backend, database, analytics or trackers.
- No cloud AI or API keys. Everything runs on the phone.
- No app store release (fees), no custom domain (yearly fee), no paid map services.
- No Unity/Godot or native apps: one web codebase for both platforms.

---

## Build plan

We stop for review after each phase and test on a real iPhone and Android phone using the preview link.

**Part A: outdoor v1** (can start now, no campus access needed)

| Phase | What gets built |
|---|---|
| 1. Skeleton | Project setup, linting, tests, CI, Cloudflare previews, security headers, basic offline caching, empty 3D scene |
| 2. Outdoor campus | Buildings, walkways, roads, gates and nearby city blocks in the massing-model look. Compare palettes on real phones. Tap a building to see its name |
| 3. Search + Ask | Room-code parser (code → building + floor), typo-tolerant search, the English/Taglish sentence parser with a phrase test set |
| 4. Outdoor routing | Walking graph between buildings, gates and entrances, street crossings, step-by-step directions ending in "G304 is on 3F" |
| 5. Location + route player | "Where are you?" flow, deep links, Next/Back steps, follow camera, "Use my location" and the live GPS walking avatar (D14) |
| 6. Offline polish → **v1 release** | Update prompts, install hint, airplane-mode tests on iPhone and Android |

**Part B: interiors** (after the campus reopens)

| Phase | What gets built |
|---|---|
| 7. Tracing tool | Dev tool for drawing floors over evacuation-map photos, with "copy floor". Andrew first |
| 8. Indoor view | Cutaway floors, floor switcher, the "enter building" slice animation |
| 9. Indoor routing | Hallways, stairs vs elevator, skybridges, nearest CR, optional D-pad |
| 10. Polish | Visual pass, performance tiers, accessibility, reduced motion |

---

## Open questions

- **Official room-code prefixes** for each building (e.g. is Andrew "A", "AG", or "B"?). The best source is the room
  column in the enlistment/class-schedule system.
- **Floor naming:** OpenStreetMap counts the ground floor as level 0. Does DLSU call it 1F everywhere?
- **Floor counts, exits, which elevators serve which floors, which skybridges are open.** OpenStreetMap has guesses;
  someone needs to confirm them on site.
- **Palette** for the 3D look: as the reference (orange ground, pale blue buildings), DLSU green ground, or quiet
  grey. See D13.
- **Which extra buildings** from the official map to show (Retreat House, Legal Aid Clinic, Bahay Kanlungan, …).
- **Evacuation-map photos** for each floor, named like `andrew_03F.jpg`, once the campus reopens. Andrew first.
- **D14 (GPS outdoors):** is GPS steady enough between the tall buildings? Do we still want a Google-Maps-style
  street map under the 3D view later?
- **Facilities:** may we publish floor plans traced from the evacuation maps? (Needed before a public launch.)
  Would they share official plans or approve QR stickers? (Nice-to-have.)

## How you can help

1. **Review the plan.** Anything confusing, risky, or over-engineered? Open a GitHub issue.
2. **Send 10–20 sentences** you'd actually type to find a room: English, Filipino, Taglish, typos and all. They
   become the test set the parser must pass.
3. **Confirm room codes** from your own class schedule. This is the most useful thing right now, since it works
   while the campus is closed.
4. **Evacuation-map photos:** if you already have any on your phone, share them. Once the campus reopens, take them
   on floors you're already on (straight-on, whole map in frame), Andrew first.

---

*Map data © OpenStreetMap contributors (ODbL). This is a student project, not an official DLSU app.*
