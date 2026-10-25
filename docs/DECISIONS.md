# Decisions log

Each entry records a foundation decision, the evidence behind it, and what would make us revisit it.
Newest last. Dates use Asia/Manila time.

---

## D1. TypeScript: run 7.0 for type-checking and keep 6.0 for tools (2026-10-18)

**Problem.** `typescript@latest` is now 7.0.2 (the Go rewrite). TS 7.0 ships **without a programmatic API**, so
typescript-eslint (peer range `>=4.8.4 <6.1.0`) and editor tooling can't load it.

**What we tested** (throwaway project with the full stack: React 19.3, R3F 9.8, drei 10.7, three 0.186, Zod 4,
Zustand 5, ngraph, Vite 8, Tailwind 4, vite-plugin-pwa 2):

| Check | Result |
|---|---|
| Our code type-checks on TS 7.0.2 | ✅ |
| Our code type-checks on TS 6.0.3 | ✅ |
| `tsc` time, TS 7 vs TS 6 | **1.3 s vs 4.0 s** |
| `vite build` + PWA service worker | ✅ (bare stack precache ≈ 1.4 MB before gzip) |
| Microsoft's documented side-by-side install (below) | ✅ `tsc` = 7.0.2, ESLint gets the 6.0 API |
| typescript-eslint `strictTypeChecked` with that setup | ✅ works, no peer-dependency errors |
| Two type errors from `three-stdlib` (a drei dependency) vs `@types/three` 0.186 | Happen on **both** TS 6 and 7. A library mismatch, not a TS issue |

**Decision.**

```jsonc
// package.json (devDependencies)
"typescript": "npm:@typescript/typescript6@~6.0.2",   // tools import "typescript" and get the 6.0 API
"@typescript/native": "npm:typescript@^7.0.2"          // provides the `tsc` binary = 7.0 (fast)
// scripts
"typecheck": "tsc --noEmit -p ."
```

- **Correction (2026-10-19, 1a):** this first said `@typescript/typescript6@^6.0.3`, which can't install: that
  package stops at 6.0.2 (6.0.3 exists only as plain `typescript`). It also names its command `tsc6`, so the
  install-order clash below can't happen with it; the full-path call and CI version check stay as a guard.
- **Both packages may install a `tsc` command**, and which one lands in `node_modules/.bin` depends on install
  order. So in Phase 1 the `typecheck` script calls the TS 7 binary by its full path inside
  `node_modules/@typescript/native/`, and CI runs a version check that fails unless it reports 7.x.
- `tsconfig.json`: `"skipLibCheck": true` (works around the three-stdlib mismatch; this is the Vite template
  default). Also `strict`, `noUncheckedIndexedAccess`, `moduleResolution: "bundler"`.
- VS Code: "Use Workspace Version" so the editor uses the same 6.0 API as ESLint.

**Revisit when** typescript-eslint supports the TS 7.1 API. Then drop the alias and use a single `typescript@7`.

---

## D2. Lint/format: keep ESLint + Prettier as the handover says (withdraws my Biome suggestion) (2026-10-18)

**Evidence from the same test project:**

- typescript-eslint `strictTypeChecked` caught a real bug class that **Biome missed** (`string + number` in a label).
- `eslint-plugin-react-hooks` v7 flagged `gl.localClippingEnabled = true` inside a component (mutating a hook value).
  That is a real R3F anti-pattern. The fix is `<Canvas gl={{ localClippingEnabled: true }}>`.
- Cost: ESLint full run ≈ 7 s vs Biome ≈ 0.6 s. Mitigated by linting only staged files on commit (lint-staged)
  and running the full lint in CI.

**Decision.** ESLint 10 flat config + typescript-eslint `strictTypeChecked` + `eslint-plugin-react-hooks`
(recommended) + Prettier. Git hooks: **Husky + lint-staged** (as in the handover).
Scene files may disable `react-hooks/immutability` per line, with a comment, only inside `useFrame`/effects.

**Revisit if** lint time becomes painful. Biome for formatting only is an easy swap.

---

## D3. React version pin (2026-10-18)

**Problem.** `@react-three/fiber@9.8` declares `react >=19 <19.4`. React latest is 19.3.1, so nothing is broken
today, but an unpinned `^19` would break installs the day React 19.4 ships.

**Decision.**

- `"react": "~19.3.1"`, `"react-dom": "~19.3.1"` (patch updates only). Commit `package-lock.json` and use `npm ci` in CI.
- Dependabot **groups** `react`, `react-dom`, `@types/react*`, `@react-three/*`, `three`, `@types/three` into one PR,
  so the 3D stack upgrades together or not at all.
- CI fails on peer-dependency conflicts (no `--legacy-peer-deps`).

**Revisit when** R3F widens its React range.

---

## D4. Map data: OpenStreetMap footprints under ODbL (2026-10-18)

**Evidence.** Queried OSM (Overpass) for the DLSU area on 2026-10-18. OSM already has:

- **The campus boundary** (relation 11126048, "De La Salle University Manila").
- **All 16 buildings** from the handover list, as real footprints with `building:levels` (table below).
- **4 skybridges** between buildings (tagged `building:part=bridge` with levels), **9 named gates**,
  **10 elevators** with the levels they serve (Henry Sy, Yuchengco, Connon area), 38 covered footways, 14 crossings,
  steps, and fire-equipment points.

**License facts** (not legal advice):

- OSM data is **ODbL**. Rendered maps need the credit "© OpenStreetMap contributors".
- Our compiled `campus.json` mixes OSM footprints with our own data and is shipped publicly, so it is a
  *derivative database* that must also be offered under ODbL.

**Decision.**

- **Code: MIT.** **Campus data (`data-src/`, `public/data/`): ODbL**, with a `data-src/LICENSE` and an
  `ATTRIBUTION.md`. One data license is simplest. (Indoor data has an extra condition, below.)
- Credit "© OpenStreetMap contributors" on the map (small, bottom corner) and in an About screen. It works offline
  because it's plain text.
- **Pinned snapshot, never fetched at runtime.** `scripts/fetch-osm.ts` saves
  `data-src/campus/osm/snapshot-<date>.geojson`, and we commit it. My cloud workspace can't reach the Overpass
  servers, so this script runs on your computer (or as a manual GitHub Action).
- Do **not** trace from Google or other satellite imagery (their terms forbid it).
- **Indoor data is a separate question.** It's traced from DLSU's own evacuation maps, so DLSU may hold rights in
  it, and publishing detailed floor plans may need the university's OK. Since the app ships its data to every
  visitor, "public app" means "public floor plans". So:
  - **Building and testing** with indoor data is fine (the photos themselves are never committed or shipped).
  - **Before a public launch,** we ask Facilities. If they say no, the app launches outdoor-only plus "room G304 is
    on 3F" text, which still works (PLAN §4.1).
  - We don't contribute indoor data to OSM unless Facilities agrees, because OSM requires a compatible source.

**Gotchas found in the data:**

- **Level numbering:** OSM uses `level=0` for the ground floor (Yuchengco's elevators list `0;1;2;3;4;5`). DLSU
  signage probably calls that "1F". The compiler maps `floor = level + offset` with a **per-building offset table**.
  Confirm on site.
- Henry Sy Sr. Hall has `building:min_level=2`, which is unusual and needs checking.
- OSM values are crowd-sourced, so treat every number below as **"probably right, verify"**.

| Building (OSM name) | OSM levels | Notes |
|---|---|---|
| Brother Andrew Gonzalez Hall | 20 | height 90 m; alt name "Gate 5B (Andrew)" |
| Henry Sy Sr. Hall | 15 | `min_level=2`, height 53.6 m |
| Enrique M. Razon Sports Center | 10 | |
| Don Enrique T. Yuchengco Hall | 9 | |
| William Hall | 7 | |
| St. Joseph Hall | 6 | |
| Velasco Hall | 5 | |
| Brother Gabriel Connon Hall | 5 | |
| Faculty Center | 4 | |
| John Gokongwei Hall | 4 | |
| Science and Technology Research Center | 4 | |
| Miguel Hall (relation) | 4 | |
| St. John Hall | 3 | |
| St. La Salle Hall | 3 | |
| Brother Alphonsus Bloemen Hall | 2 | |
| Mutien-Marie Hall | 2 | |

Skybridges (OSM levels, nearest buildings): Bloemen ↔ Miguel (2–3) · Yuchengco ↔ Henry Sy (6–7) ·
Miguel ↔ Gokongwei (1–2) · William ↔ St. Joseph (5–6).
Gates: 1 (South), 2 (North), 3 (Velasco), 4A/4B (Gokongwei), 5A, 5B (Andrew), 6 (Razon), Agno Gate.

**Revisit if** Facilities provides official CAD/PDF plans. Those would replace OSM footprints for accuracy.

---

## D5. Hosting: Cloudflare (Workers static assets) (2026-10-18)

**Problem.** GitHub Pages can't send HTTP headers. A CSP can still go in a `<meta>` tag, but `frame-ancestors`
(clickjacking protection) only works as a header, and there are no per-PR preview URLs for testing on phones.

**Decision.** Cloudflare **Workers with static assets**. This is Cloudflare's recommended route for new projects;
Pages is still supported and would work too.

- `wrangler.jsonc`: `assets.directory = "./dist"`, `not_found_handling = "single-page-application"`.
- `public/_headers` (supported for Workers static assets, up to 100 rules) carries the CSP and security headers.
- Preview URL per PR via version aliases (`wrangler versions upload --preview-alias pr-<n>`) from GitHub Actions.
- You need a free Cloudflare account. We'll connect it together in Phase 1. No secrets go in the repo; the deploy
  token lives in GitHub Actions secrets.
- **Preview links only work for branches in this repo, not forks** (GitHub doesn't give forked PRs access to
  secrets). Collaborators get added to the repo and push branches here.

**Starting CSP** (to be tested in Phase 1, not guessed later):

```text
Content-Security-Policy: default-src 'self'; script-src 'self'; worker-src 'self' blob:;
  style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self';
  connect-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

- `worker-src blob:` is needed because drei `<Text>` (troika) runs its text layout in blob-URL web workers.
- `style-src 'unsafe-inline'` is needed for the inline `style=""` attributes that animation/sheet libraries set.
  No inline *scripts* are allowed.
- **No WebAssembly decoders** (meshopt, Draco, Basis). They would need `'wasm-unsafe-eval'` in `script-src`. Our
  models are small enough to skip them; gltf-transform `quantize` shrinks them with no decoder (PLAN §2).

**Found while checking:** if drei `<Text>` gets no `font` prop, troika downloads font data from
`cdn.jsdelivr.net` at runtime. That **breaks offline use and the CSP**. Rule: always pass a self-hosted font file
(`/fonts/…woff`) to every `<Text>`, and never use drei `<Environment preset>` (it also loads from a CDN).
The CI Playwright test should fail on any request to a non-self origin.

**Fallback:** GitHub Pages with a meta-tag CSP (no `frame-ancestors`, no previews).

---

## D6. Campus map image (2026-10-18)

**Received 2026-10-18:** the official "De La Salle University Campus Layout" map. It's DLSU's material and the repo
is public, so it lives in `docs/reference/` (gitignored) and in the shared folder, not in git.

OSM gives real positions and footprints. The official map is used for:

- **Local names** of paths and places: the covered walks, Central Plaza, Marian Quadrangle, the Amphitheater.
- **Street context:** Taft Avenue in front; Fidel Reyes Street / Calle Agno and Castro Street separate Gokongwei
  and Andrew from the main campus, so routes to them **cross a street**.
- **Orientation:** the map is rotated (its north arrow points right) with Taft Avenue along the bottom. Students
  know the campus this way, so the app's default camera matches it (D13).
- **A building list longer than the handover's 16.** It numbers 23 items, adding Retreat House, Legal Aid Clinic,
  Bahay Kanlungan, the Solar/Eco car shelter, plus small service buildings (AHU, STP, a maintenance office).
  **Open:** which of these v1 shows. Suggestion: all of them as blocks, but only real destinations are searchable.

It's **not to scale**, so footprints and positions always come from OSM, never from this map.

---

## D7. QR stickers become optional, and deep links stay (2026-10-18)

**Why.** Room stickers need university approval we may never get, so the app must not depend on them.

**Decision.**

- **Core:** tap-based location picking (D8) and typed or spoken input (D9).
- **Kept, because they need no approval:** deep links (`?from=…&to=…`). A student can share "meet me at G304" in a
  group chat, and an org's link opens with the destination set. QR codes that just *open the app* can go on any
  poster or org page.
- **Optional, only if Facilities approves:** per-location "You are here" stickers. The app needs no changes for
  these; they're the same deep links.

---

## D8. "Where are you?": tap flow with precise spots (2026-10-18)

The default stays one tap after choosing the floor. Precision is optional.

1. **Pick a building** (tap it on the 3D map or choose from the list), **or** "I'm outside" → pick a **gate**.
   OSM already lists Gate 1 South, 2 North, 3 Velasco, 4A/4B Gokongwei, 5A, 5B Andrew, 6 Razon, and Agno.
2. **Pick a floor.**
3. **Where on this floor?** It defaults automatically, and you can change it with chips:
   - Default: **Main entrance** on the ground floor, **Elevator lobby** on other floors.
   - Chips: `Elevator` · `Stairs` (with names if the building has several, e.g. "North stairs") ·
     `Entrance: Main / Side / Back` (ground floor; real names from data, e.g. "Side (Gate 4A)") ·
     `Near room…` (picker of that floor's rooms) · `Tap on map`.
4. The avatar drops there and the chip says e.g. **"📍 Gokongwei · 1F · Back entrance"**. Tap it to change.

The same structure is what the text parser fills in (D9), so both inputs lead to one confirm screen.

---

## D9. Natural-language input: a rule-based parser first, and an on-device model only if needed (2026-10-18)

**Goal.** Let students type, or say via the keyboard mic, things like *"I am near B305 and I want to go to G304"* or
*"nasa AG1104 ako, papuntang G304"*.

**Why not run Llama directly.** Checked 2026-10-18:

| Option | Works offline? | Cost on the phone | Verdict |
|---|---|---|---|
| Cloud LLM (any API) | ❌ needs signal | needs a backend + API key, which the handover forbids | ❌ |
| Chrome built-in AI (Gemini Nano) | ✅ | **Desktop only.** Chrome for Android isn't supported; needs ~22 GB free | ❌ |
| WebLLM + **Llama 3.2 1B** (q4f16) | ✅ after download | **~880 MB GPU memory**, several hundred MB download, WebGPU needed (iOS 26+, Android 12+ with Chrome 121+) | Too heavy as a default. Llama's license is also not MIT/Apache (it's the Llama Community License with attribution terms) |
| WebLLM + SmolLM2-360M / Qwen3-0.6B (Apache-2.0) | ✅ after download | ~380 MB / ~1.4 GB GPU memory | Possible as an **opt-in** extra, but Taglish quality is unproven |
| **Rule-based parser** (our code) | ✅ always | **~3 KB**, instant, testable | ✅ **Core** |

**Evidence.** A 3 KB spike (`docs/spikes/ask-parser-spike.mjs`) correctly parsed all 9 phrases it was written
against, including:

- *"I am near B305 and I want to go to G304"* → from room B305, to room G304
- *"nasa AG1104 ako, papuntang G304"* and *"papunta G304, nasa B305 ako"* (reversed order) → correct from/to
- *"from the back entrance of gokongwei to velasco 3rd floor"* → from Gokongwei back entrance, to Velasco 3F
- *"I'm at Andrew 5th floor, where is the nearest CR"* → from Andrew 5F, to nearest CR
- *"hello"* → "needs help" (falls back to the tap flow)

(Building prefixes in the spike are placeholders until official codes are confirmed.)

**Known failures, found in review on 2026-10-18.** Those 9 phrases were written alongside the spike. Fresh
phrasings show it's a proof of approach, not a finished parser:

| Input | Spike output | Why |
|---|---|---|
| *"pano pumunta sa G304 galing B305"* | from G304, to nothing (reversed) | `pumunta` isn't a cue word, and `galing` after the destination isn't handled |
| *"G304 to B305"*, *"B305 papuntang G304"* | starting room dropped | A bare code before the "to" cue isn't read as the start |
| *"nasa 3rd floor ako ng velasco, saan CR"* | CR merged into the start | `saan` alone isn't a cue word |
| *"where is the CR at Andrew 5th floor"* | read as "you're on Andrew 5F" | `at` is treated as a location cue |

These go straight into the Phase 3 test set. The confirm screen (point 2 below) is what makes this safe: a wrong
parse shows up as a wrong chip, never as a silent wrong route.

**Decision. Two tiers, one output format:**

1. **Tier 1, ships in Phase 3:** a rule-based parser in `features/search/`. English + Filipino/Taglish cue words
   (`nasa`, `papunta`, `saan`, `likod`, `gilid`, …), room codes, building names and aliases, floors ("3rd floor",
   "3F"), amenities (CR/banyo, elevator, stairs), and entrances. Typos go through uFuzzy.
2. **Every parse ends at a confirm screen**: *From [chip] → To [chip]*, then **Go**. Chips are editable with the
   D8 picker. The app never routes silently on a guess. Unknown rooms show "Did you mean…".
3. **Test set:** collect about 100 real phrases from classmates (English, Filipino, Taglish, typos) into a Vitest
   file. The parser must pass them before release, and every failure becomes a new rule plus a test.
4. **Tier 2, optional, after Phase 10:** add an on-device model **only if** Tier 1 scores under about 90% on the test
   set. It would be opt-in ("Download smarter search, ~400 MB, Wi-Fi recommended"), only on WebGPU phones, use an
   Apache-2.0 model, and be limited to emitting the same JSON (WebLLM's JSON-schema mode). The output is validated
   with Zod and resolved against our room index, so it can't invent rooms. The app works fully without it.

   **Model shortlist for Tier 2** (memory figures from WebLLM 0.2.86, q4f16 builds):

   | Model | License | GPU memory | Tagalog | Role |
   |---|---|---|---|---|
   | **Qwen3-0.6B** | Apache-2.0 | ~1.4 GB | ✅ listed among Qwen3's 119 languages | **Primary candidate** (run with thinking mode off for speed) |
   | Qwen2.5-0.5B-Instruct | Apache-2.0 | ~0.94 GB | weaker | Lighter fallback |
   | SmolLM2-360M-Instruct | Apache-2.0 | ~0.38 GB | mostly English | Smallest; English phrasing only |
   | Llama 3.2 1B Instruct | Llama Community License | ~0.88 GB | not officially supported | Not chosen: license terms, no Tagalog advantage |

   Runtime: **WebLLM** (Apache-2.0, needs WebGPU). For phones without WebGPU, **wllama** (MIT, CPU/WASM, GGUF
   files) works but is slow. The final pick is whichever scores best on our Taglish phrase test set.
5. **Voice:** use the phone keyboard's mic button, which needs no code. The browser Speech API is skipped because it
   needs a network connection on most phones.

---

## D10. How offline works and how students get the app (2026-10-18)

**No app store download is needed.** It's a Progressive Web App (PWA):

1. **First open, with any connection** (home or dorm Wi-Fi, mobile data, or a good campus Wi-Fi spot): the
   browser downloads the app **and all campus data** in one go. Budget < 15 MB; the expected size is a few MB
   (the bare 3D stack measured 1.4 MB before compression). A "✓ Ready offline" badge confirms it.
2. **After that, no signal needed.** Search, parsing, routing and 3D all run on the phone. Nothing calls a server.
3. **Add to Home Screen** gives a normal app icon and a full-screen app. Android Chrome offers it automatically.
   On iPhone it's Share → *Add to Home Screen*, and the app shows a one-time hint.
4. **Updates:** when the phone is online, the app quietly checks for a new map version and asks
   "Map updated, reload?".
5. **How students find it the first time:** a link or QR on org pages, group chats, or a poster. Those QR codes just
   open the app, so no per-room sticker approval is needed.

**Risks and mitigations:**

- iOS may clear stored data for web apps that go unused for a long time. Mitigations: ask for persistent storage
  (`navigator.storage.persist()`), keep the "Ready offline" badge honest by re-checking on launch, and the app
  re-downloads by itself the next time there's signal. Test in airplane mode on a real iPhone in Phase 6.
- If the university later wants a store app, **Capacitor** wraps the same code with everything bundled inside
  (no eviction). That's an optional later step.
- The optional AI model (D9 Tier 2) is a separate opt-in download and never blocks the core app.

---

## D11. Zero cost: free tiers only, no credit card anywhere (2026-10-18)

**Decision.** The only paid tool in this project is Claude Code. Everything else runs on a free tier, and **no
service gets a credit card**, so hitting a limit stops the service instead of sending a bill.

What that rules in and out:

- **In:** Cloudflare free plan (D5), GitHub free (repo, Actions, Dependabot), OpenStreetMap data (D4), open-source
  libraries (PLAN §1), CC0 models.
- **Out:** app store accounts (yearly/one-time fees, D10), a custom domain (yearly fee), paid map or AI APIs (D9),
  and Git LFS beyond its free quota, which is why evacuation photos live in a shared folder instead (PLAN §4).

**Revisit if** the university offers to host it, or a store release becomes a real goal (Capacitor, D10).

---

## D12. Outdoor first; interiors later, starting with Andrew (2026-10-18)

**Problem.** The campus is closed, so nobody can photograph the evacuation maps, and every indoor phase depends on
them. In the old order, routing (Phase 6) came after the tracer and indoor view, so almost everything was blocked.

**Decision.** Split the build in two (PLAN §10):

- **Part A, outdoor v1 (Phases 1–6), needs no campus access.** Every building, walkway, covered walk, road, gate,
  crossing and skybridge, in 3D; search; door-to-door routing between buildings; offline. A route ends at the
  target building's entrance with "G304 is on 3F". For most students the hard part is *which building and which
  floor*, and v1 answers that.
- **Part B, interiors (Phases 7–10), starts when the campus reopens.** **Andrew first**: its entrance floor, then
  one typical classroom floor, then the floors that share that layout (the tracer copies a floor).

**What can be gathered while the campus is closed:**

| Need | Source | Needs campus? |
|---|---|---|
| Footprints, floor counts, gates, skybridges, some entrances | OSM (`scripts/fetch-osm.ts`, run on your PC) | No |
| Walkway layout, covered walks, place names, which streets | Official campus map (D6) | No |
| Room-code prefixes | Room column in the enlistment/class-schedule system | No |
| Evacuation-map photos | Classmates may already have some on their phones; or email Facilities | Partly |
| Which entrances are open, elevator floors, exact entrance spots | On-site check | **Yes**, so these ship tagged `verified: false` |

**Revisit if** Facilities sends official floor plans. Interiors could then start before the campus reopens.

---

## D13. Visual look: a "massing model" (2026-10-18)

**Reference:** a 3D city render, an Unsplash+ photo (licensed, so it's kept as a reference only, never committed or
shipped). Stored in `docs/reference/` (gitignored).

**What's specific to it**, beyond "3D buildings":

1. **Every building is one pale color.** Shape reads from light alone: roofs brightest, sunlit walls mid, shaded
   walls darkest. No windows, textures or outlines.
2. **A flat, saturated ground** that contrasts strongly with the pale buildings.
3. **Streets and paths are thin bright lines**, not wide grey strips.
4. **Soft darkening where walls meet the ground**, which gives the blocks weight.
5. **A high, angled camera** over a dense context: the surrounding city is drawn too, not just the subject.

**Decision.** Build that look, on a phone budget (PLAN §5): `MeshLambertMaterial`, hemisphere + directional light,
fake ambient occlusion baked into vertex colors, paths as thin ribbons, surrounding OSM blocks muted and
non-tappable. This **replaces** the handover's toon shading and outlines, and its "match the stylized map's greens".

**Color has one job:** one accent marks the route, the selected building and "you are here". Everything else
stays in the two base tones.

**Open: the palette.** It's three tokens (ground, buildings, accent), so Phase 2 can render all three options on
real phones before choosing:

| Option | Ground | Buildings | Accent | Trade-off |
|---|---|---|---|---|
| **A. As the reference** | Burnt orange | Pale blue-white | DLSU green | Most striking; a large orange area is loud in sunlight, and labels need backing plates |
| **B. DLSU-branded** | Deep DLSU green | Pale warm white | Gold | Instantly "La Salle"; the green ground mirrors the official map |
| **C. Quiet** | Light warm grey | White | DLSU green | Calmest and most readable; least distinctive |

**Settled (2026-10-21): green.** The owner picked option B's green during 2c: ground `#175f3c`, warm white
buildings `#f2eee5`, sage paths `#5f9c7c`, roads `#7fb396`, a green haze `#4f9a72`. By then option A had become the
owner's near-black (like Waze's dark mode) instead of orange. The accent is the interface's Campus Green `#00703c`,
not B's gold (PRODUCT.md, 2026-10-19); the selected building leans 22% toward it. The `?palette=` preview switch and
palettes A and C are gone from the app; the colours are `MAP_PALETTE` in `src/shared/config/palette.ts`. **Revisit
if** labels or the selection tint are hard to read on the green in sunlight.

---

## D14. Two modes: live GPS avatar outdoors, "mall directory" indoors (2026-10-19, proposed)

**Status:** proposed by the team on 2026-10-19, not yet reviewed. It **reverses "no GPS"** for the outdoor leg
only. Indoor positioning stays out (no Wi-Fi/BLE beacons).

**The idea as first described.** A route has two legs: *current location → the building*, then *building entrance →
the room*. Offline, the app shows the route only, like a mall directory map. Online, it looks like Google Maps or
Waze, with an avatar that walks along the route, Pokémon Go style.

**What we changed, and why.** The split that works is **outdoor vs indoor, not online vs offline**:

- **GPS doesn't need internet.** The phone's GPS chip works with no data, even in airplane mode. The first fix is
  just slower without data. So the live avatar can work offline too, and the app stays offline-first (D10).
- **GPS doesn't work indoors**, online or not. The building-to-room leg is always the "mall directory" style.
- **Outdoor accuracy is roughly 5–15 m** in the open, and worse next to tall buildings, along Taft and under covered
  walks (estimate; measure it on site). That places you on the right path but not at the right door.
- **What "online" would add is a Google-Maps-style street basemap**, and that's the part that costs money or breaks
  rules: Google and Mapbox need a card (D11), and the public OpenStreetMap tile servers forbid this kind of app
  use. Our 3D scene already draws the streets and surrounding city blocks from the OSM snapshot (D4, D13), so the
  "live" view reuses it with a Waze-style follow camera instead of a separate map.

**Decision (proposed).**

| Leg | Mode | How you're placed | What you see |
|---|---|---|---|
| **Outdoor:** where you are → building entrance | **Live follow** when GPS is good; **step mode** otherwise | GPS position snapped to the route line (like Waze snaps a car to the road) | Same 3D campus, low tilted camera behind the avatar, heading-up; the avatar walks along the route |
| **Indoor:** entrance → room (Part B) | **Mall directory** always | You tap "You are here" (D8); the entrance you arrived at is the default | Cutaway floor (§5), route line, Next/Back steps, floor rail |

Details:

1. **"Use my location"** becomes one more chip in "Where are you?" (D8), only when you're outdoors. It still goes
   through the From → To confirm screen. The app never routes on a silent guess.
2. **Live follow** runs only while a route is active and the page is visible (`watchPosition`, stopped on route end,
   on `visibilitychange`, and in step mode). This keeps battery use down.
3. **Snapping:** if the GPS point is within a set distance of the route (config constant, start around 25 m), the
   avatar snaps to the nearest point on the route line and walks there. Farther than that, show "You seem off the
   route" with **Re-route from here**. If reported accuracy is worse than a threshold (start around 30 m), show
   "GPS weak" and fall back to step mode (Next/Back) without losing your place.
4. **Handoff to indoor:** within a set distance of the target entrance, or when you tap **I'm inside**, the app
   switches to the indoor view at that entrance and stops using GPS. In v1 (outdoor only) this is the "G304 is on 3F"
   arrival screen.
5. **Facing direction:** use the compass when allowed, else the direction of the route. On iPhone the compass needs
   its own permission prompt (`DeviceOrientationEvent.requestPermission()`, from a tap). Android doesn't.
6. **Avatar:** an **original** or CC0 low-poly character with a walk cycle (Kenney/Quaternius, PLAN §5). No Pokémon
   or other franchise look-alikes. It idles when you stop and walks when the snapped position moves.
7. **Privacy:** positions live in memory only. They're never stored, logged or sent anywhere, and there's no
   location history. The permission is asked the first time you tap "Use my location", never on first open.
8. **Security headers:** the strict `_headers` policy (D5) must allow `Permissions-Policy: geolocation=(self)` (and
   the device-orientation sensors), or the browser blocks GPS silently.
9. **Testing while the campus is closed:** Chrome DevTools location override plus recorded GPS tracks replayed in
   Playwright. Real accuracy checks on campus walkways happen once it reopens.

**Not decided yet:** a real street basemap under the 3D scene. A small self-hosted **Protomaps (PMTiles)** file
of just the campus area, served from our Cloudflare host, would be free and could be cached offline too. But it
reopens the "MapLibre for the outdoor view" rejection in PLAN §1, so it waits until the 3D follow view has been
tried on real phones.

**Revisit if** on-site tests show GPS is too jumpy between the tall buildings to be useful (then keep step mode as
the default and make live follow opt-in), or if the team still wants the Google-Maps look after seeing the 3D
follow view.

**Update 2026-10-19:** moved to **later** (not v1) in the PRD. From is set by tapping the map only.

**Status 2026-10-19:** still proposed. The PRD moved GPS out of v1 (PRD §4 "Later"), so this is decided when GPS
work starts, after the public launch.

---

## D15. The campus is accessible; v1 includes full interiors (2026-10-19, agreed)

**Problem.** D12 split the build into outdoor v1 and interiors later *because the campus was closed*. On 2026-10-19
the owner confirmed campus access and shared STRC's lobby directory and evacuation maps for G, 2F, 3F and 4F.

**Decision.** v1 is the outdoor campus **plus** every full-tier building's room list and 3D interior (PRD §8). Lobby
directories are the main source of room codes. Release is a private beta, then a public launch (PRD §9).

**Alternatives.** Keep outdoor-only v1 (fastest to ship, already solves "which building and floor"); rejected by
the owner in favour of one complete public product. **Revisit if** data rollout stalls for months.

---

## D16. No sentence parser: plain From / To fields (2026-10-19, agreed)

**Replaces D9.** The owner: "there's no sentence in the first place; the UI is From and To."

**Decision.** To takes a room code or building name (strict, with "Did you mean"). From is set by the D8 tap flow.
No English/Taglish parser, no phrase test set, no on-device AI model.

**Alternatives.** D9's rule-based parser; it worked on its own 9 phrases but failed on fresh ones, and explicit
fields remove the guessing entirely.

---

## D17. Floors are extracted from photos by script, cleaned up by Claude (2026-10-19, agreed)

**Problem.** Full interiors for 10 buildings is roughly 70 floors by OSM's counts. PLAN §10 Phase 7 planned a MapLibre +
Terra Draw tracing tool, drawn by hand.

**Evidence.** Spike `docs/spikes/wall-extract/` (Node + opencv-js + sharp) on STRC 4F (4032×3024) and 2F
(2048×1536, angled): about 4 s per floor. The hallway line (the green evacuation route) came out clean on both, most
walls were found, and door gaps appeared on their own. Misses: some single-line walls, breaks at pillars.
False positives: stair treads, lines outside the building. Not identified: room numbers, stairs, elevator.
Not yet tested: fitting onto the OSM footprint.

**Decision.** Per floor: script draft → Claude cleanup and labels → owner checks the 3D preview. The tracer tool is
dropped. A small self-serve review page can be added later if maintainers other than the owner need it.

**Alternatives.** Own tracer (a full phase of tool-building); QGIS (steep, no "copy floor"). **Revisit if** the OSM fit
fails or cleanup takes longer than about 15 minutes per floor.

---

## D18. Every room number is its own room (2026-10-19, agreed)

**Problem.** Directories list combined rooms (`C404/406 · Biology Lab`, `C102/104-106`).

**Decision.** Each number becomes its own Room with the shared name. Typing `C404` resolves directly; `C404/406` is
read as `C404`. Floor = room number ÷ 100. The confirmed prefix table is in `docs/ARCHITECTURE.md` §3.3.

**Alternatives.** One room keyed `C404/406` (an extra "Did you mean" tap); one room with alias codes.

---

## D19. Private beta on an unlisted link (2026-10-19, agreed)

**Decision.** Beta testers get an unlisted Cloudflare URL, with `noindex` headers and a visible beta label.

**Accepted risk.** The app ships all data to every visitor, so if the link spreads, floor plans circulate before
Facilities' OK (D4). **Alternatives.** Cloudflare Access login (not verified to be free without a card, D11);
a beta without interiors (testers can't try half of v1).

---

## D20. Ten full buildings; the rest are blocks (2026-10-19, agreed)

**Decision.** Full tier (searchable, room list, interior): St. La Salle, Yuchengco, St. Joseph, Velasco, St. Miguel,
Andrew, STRC, Razon, Gokongwei, Mutien-Marie. Block tier (named 3D shape only, not searchable, outside the launch
gate): Connon, Henry Sy, William Hall, Faculty Center, St. John Hall, Bloemen Hall and the official map's extras.

**Alternatives.** The 16 OSM buildings only; all 23 with interiors (work on buildings students never enter).

**Update 2026-10-19:** Connon and Henry Sy were first listed as full, then moved to block tier "for the mean time"
because no classes are held there.

---

## D21. Traced floor files are committed to the public repo (2026-10-19, agreed)

**Problem.** The repo is public (D6). `data-src/floors/` is derived from DLSU's evacuation maps, so committing it
publishes floor plans on GitHub, which is searchable, before Facilities' OK (D4).

**Decision.** Accept the risk and commit them. The photos themselves stay gitignored and are never committed.

**Alternatives.** A private repo (loses public review and free collaboration features); keep floor files out of git
until approval (no history or CI checks on the hardest data). **Revisit if** Facilities objects: then remove the
floor files and purge them from git history.

---

## D22. One CI gate for every contributor, scoped to what changed (2026-10-19, agreed)

**Problem.** A gate only counts if nobody can skip it, whether the change comes from a person, Claude Code or
another AI tool. Running the full build on a docs-only PR wastes minutes. Skipping CI for docs at the trigger
(`paths-ignore`) blocks merging for good, because branch protection then waits for a required check that never posts.

**Decision.**

- One job, `gates`, runs on every PR and every push to `main`, and always reports. Markdown lint runs every time.
  Lint, type-check, test, build and the design detector run only when a non-docs file changed (CI config and
  lockfiles count as code) and `package-lock.json` exists.
- Change detection is a short shell step (`git diff --name-only`), not a third-party action, to keep the supply
  chain to official `actions/*` only.
- Branch protection on `main`: require `gates` to pass, apply it to admins too, block force-pushes and deletion.
  **Required approving reviews: 0**, because the two of us review the diff together before merging. Raise it to 1
  when a contributor joins whose review is meant as a real second opinion.
- **When:** at the start of Phase 1, when app code arrives (decided 2026-10-19). While the repo is docs only, `gates`
  reports but doesn't block, and a bad docs commit is easy to fix.
- **Update 2026-10-19:** turned on early, as a repository ruleset: PR required (0 approvals), `gates` required with
  the branch up to date, no force-push, no deletion.

**Alternatives.** The full suite on every PR (slow for docs); `paths-ignore` (blocks merges, above);
`dorny/paths-filter` (works, but adds a third-party action); 1 required review now (a second click on GitHub for a
change both people already read).

**Revisit if** more contributors join, or CI minutes on a public repo stop being free.

---

## D23. From can be typed as a room code, not only tapped (2026-10-19, agreed)

**Problem.** The PRD set From by tapping only (building → floor → spot). A freshman who just left class usually
knows that room's code, because it's on their schedule.

**Decision.** "Where are you?" has the same code box as To at the top, with the tap flow below it. A typed code sets
From to that room's door. The tap flow stays for anyone outside, in a lobby or a hallway. This is not the dropped
sentence parser (D16): it's one code, parsed the same way as To. Also decided in the same Q&A: the picker opens
right away when a room is found and From is empty, and after arriving, From becomes that room until the app closes
(memory only). Full flows in `docs/user-flows.md`.

**Alternatives.** Tap only (three taps where two seconds of typing would do).

---

## D24. Beta reports go through a pre-filled Google Form link (2026-10-19, agreed)

**Problem.** Testers need an easy way to report a wrong room or route (PRD UC6). Most blockmates have no GitHub
account, and the app has no backend to send anything.

**Decision.** "Report a problem" in the ⓘ sheet opens a Google Form in the browser, pre-filled with the room last
searched (To), the app and data versions, and the phone type. **Never From**: it's the student's location (PRD §6).
It's a plain link the tester taps, not a request the app makes, so the CSP and the offline rule (D10) are unchanged.
Offline, the button says to send it once there's signal. Free, no card (D11).

**Alternatives.** GitHub issues (testers lack accounts); a group chat link only (nothing pre-filled).
**Revisit if** the public launch needs a channel that doesn't depend on Google.

---

## D25. Prefixes printed on signs but not ours are suggested, never accepted (2026-10-20, agreed)

**Problem.** Some lobby directories print codes in a form our prefix table doesn't use: Velasco's prints `VH-501`
(our prefixes are `VL`, alias `VE`) and St. Joseph's prints `J-201` (ours is `SJ`). Students type what the sign says.

**Decision.** `VH` and `J` are *suggest prefixes*, not aliases. Typing `VH501` gives "Did you mean VL501 (Velasco)?"
and one tap accepts it. The route never starts from a guess (PRD §7, strict). The parser returns `kind: 'suggest'`
(`src/shared/data/room-code.ts`). Canonical codes and prefixes don't change.

**Alternatives.** Full aliases like `C`→`ST` (silent; the owner chose a visible suggestion instead); ignoring them
("No building uses VH", which is wrong, since the sign says it).

**Changed by D54** (2026-10-23): `J` is now an accepted alias for St. Joseph. `VH` stays a suggest prefix.

---

## D26. A room's floor is where its source puts it, not always number ÷ 100 (2026-10-20, agreed)

**Problem.** Velasco's directory has a "G Mezz" row (VH-151 Dean's Office, VH-153 CAD/CAM Lab), and St. Miguel's
lists 153–158 under G. Number ÷ 100 can't tell a mezzanine from the floor below it.

**Decision.** Floor = number ÷ 100 stays the parser's guess (`floorFromNumber`), but the floor in the room list wins:
the floor of the directory row or evacuation map the room was found on. A room on a mezzanine sits on that
mezzanine. The compiler still fails on a floor that differs from number ÷ 100 unless the room is marked as found
there, so typos are still caught (3b).

**Alternatives.** Number ÷ 100 always (mezzanine rooms land on the wrong level); renumbering mezzanine rooms (changes
codes students already know).

---

## D27. OSM snapshot from the main API, converted by our own code (2026-10-20, agreed)

**Problem.** D4 planned to download the snapshot from Overpass, the service meant for read-only downloads. Every
public Overpass server failed on 2026-10-19 and 2026-10-20 (502, 504, timeouts). The snapshot also needs a
converter from OSM's points-and-ways format to shapes, and none is in the ARCHITECTURE §2 stack.

**Decision.** `npm run fetch-osm` makes one area request to the OSM main API (it answered in about 3 s), then
fetches in full any kept relation the area cut short (the campus boundary). It sends a `User-Agent` naming the app
and is run by hand, now and then, which the OSM API usage policy allows. Our own converter
(`scripts/osm-to-geojson.ts`, about 200 lines, tested on real extracts) keeps only what the map uses and reports
anything it can't convert instead of guessing.

**Alternatives.** Overpass first with the main API as backup (failed every time we tried); the `osmtogeojson`
package (a new dependency outside the stack, latest release a beta); saving raw OSM JSON and converting in 2b (moves
the same work).

**Revisit if** the snapshot is ever refreshed automatically or often: that is bulk use, and belongs on Overpass or a
planet extract.

---

## D28. Preview links only; production stays dark until the private beta (2026-10-20, agreed)

**Problem.** D5 gives every PR a preview link, but Cloudflare only makes previews for a Worker that already exists
(checked live, PROJECT_FACTS "Cloudflare"). Creating it with a normal deploy also publishes
`dlsu-map.<account>.workers.dev`, which would be the beta link (D19) months before the beta, and CLAUDE.md says
nothing deploys there without the owner's yes.

**Decision.** `wrangler.jsonc` has `workers_dev: false` and `preview_urls: true`. The owner creates the Worker once
by hand with `wrangler deploy`, which publishes no URL ("No targets deployed"; the address returns 404). After that,
CI only runs `wrangler versions upload --preview-alias pr-<n>`, which never touches production. The beta link is
switched on in 10d by setting `workers_dev: true` and deploying, with the owner's yes. A Playwright test in `gates`
checks the headers, `robots.txt` and that nothing loads from another site, against `wrangler dev` (no secrets, so
it covers Dependabot PRs too).

**Alternatives.** Auto-deploy `main` to production (the beta link exists from now on); a manual "Deploy" button in
GitHub Actions (production goes live whenever it's pressed, before 10d); testing only the live preview (skipped on
Dependabot PRs and can't be a required check).

---

## D29. Floor extraction without OpenCV (2026-10-20, agreed)

**Problem.** ARCHITECTURE §2 named `@techstark/opencv-js` + `sharp` for `tools/floor-extract/`, as the spike used.
OpenCV is a 10 MB WebAssembly package with an awkward async start, and the spike used only three of its functions:
the perspective warp, a morphological open with a line, and connected components.

**Decision.** The tool keeps `sharp` (decode the photo, write PNGs; already in the tree at the patched 0.35.5 through
wrangler) and does those three steps in plain TypeScript: a 4-point homography with bilinear sampling, long-run
masks, and 8-connected blobs. Every step is a pure function with unit tests on hand-drawn images. Measured: 0.4–1.9 s
per floor on real photos (the spike took about 4 s).

**Alternatives.** OpenCV as in the spike (no unit tests on its steps, a large dependency for three functions).
**Revisit if** extraction needs something OpenCV is genuinely good at, like line detection on bent or curved plans.

---

## D30. Reading text at 16px, taps at 48px; only the Beta tag and credit at 14px (2026-10-20, agreed)

**Problem.** PRODUCT.md sets a 16px text floor and 48px tap targets, but the prototype shipped 12–14px roles (Beta
tag, OSM credit, row subtitles, section labels, code tags, map labels, the floor chip) and 44px chips, a 44px
secondary button and 40px segments. DESIGN.md left this open for the real app.

**Decision.** Everything a student reads is 16px or more: labels, captions, code tags, map labels and the floor chip
move up from 12–14px. Every tap target is 48px or more: chips, the secondary button and segments move up. The Beta tag
and the OSM credit stay at 14px (Micro), because they are marks on the chrome rather than text to read. DESIGN.md's
type scale and components now say so (1c).

**Alternatives.** Strict 16px with no exceptions (the pill and the map corner get noticeably heavier); keeping the
prototype's sizes and fixing only tap targets (breaks PRODUCT.md's floor, so PRODUCT.md would need changing).

---

## D31. Building entrances from pins on openstreetmap.org (2026-10-20, agreed)

**Problem.** OSM has a door for none of the 10 full buildings. Its only "entrances" on their outlines are street
gates (Gates 4A/4B, 5A/5B, 6, Gate 1). STRC, Miguel and Yuchengco touch no path at all, so routing (4a) has nothing
to aim at.

**Decision.** Charles drops a pin on each building's main entrance, and any side or back door students use, on
openstreetmap.org (right-click → Show address gives the `lat, lon`). They go in `data-src/campus/entrances.json`.
The compiler snaps each pin onto its own building's outline, fails the build if a pin is more than about 15 m from
it, and joins the entrance to the nearest path. Every entrance starts `verified: false`, so directions to it say
"(approximate)" (O6) until the on-site check (11a).

**Alternatives.** Auto-placing one entrance where each outline comes closest to a path (some land on the wrong side,
e.g. STRC's on Taft); placing them from a description in words (less precise, still needs a check); pins from
Google Maps (its terms don't allow copying positions into another dataset, and its imagery doesn't line up with the
OSM outlines).

---

## D32. Taft Avenue gets two sidewalks that meet only at crosswalks (2026-10-20, agreed)

**Problem.** OSM has no sidewalks here, so walking means following street centre lines. On a centre line nothing
stops a route crossing Taft Avenue mid-block, under the LRT, which is unsafe and not what anyone does. Andrew can
only be reached along Taft. With footpaths alone the campus falls into 5 pieces; with the smaller streets, all but
Andrew join.

**Decision.** The compiler draws a sidewalk on each side of Taft, offset from the carriageway using OSM's `sidewalk`
and `lanes` tags. Side paths join the sidewalk on their own side, and the two sides are linked only at mapped
crosswalks (`footway=crossing` ways and `highway=crossing` points). Smaller streets (Agno, Fidel Reyes, Castro) are
walked on their centre lines; routing (4b) gives them a cost penalty so campus paths win. Other main roads are left
out of the walk network.

**Alternatives.** Centre lines everywhere, Taft included (simplest, but routes can cross anywhere and the text can't
say "at the crosswalk"); hand-drawn sidewalks in `data-src/campus/walkways.geojson` (most control, but hand data to
maintain and check on site).

---

## D33. On these directory signs a dash between room numbers is a range (2026-10-20, agreed)

**Problem.** D18 read a dash in a combined entry as "and": STRC's `C102/104-106` is rooms 102, 104 and 106, because
C105 is the Mechatronics Lab. Velasco's, St. Joseph's and St. Miguel's directories use a dash as a range:
`VH-304-309 Classrooms`, `J-403-406`, `313-317`, and the rooms in between appear nowhere else on the sign. Read as
"and", rooms like VL305–VL308 would not be searchable.

**Decision.** On these three signs a dash is a range. The CSV types the range out with `/` (`VL-304/305/306/307/308/309`)
and a note gives the printed form, so the compiler stays as it is and STRC's reading doesn't change. A two-room dash
(`SM202-203`, `SM212A-212B`) reads the same either way and is typed as printed. Each new sign is read on its own:
if the rooms in between are listed elsewhere on it, the dash means "and". (Owner, 2026-10-20.)

**Alternatives.** Make the compiler read every dash as a range (breaks STRC's `C102/104-106`); read every dash as "and"
(loses the rooms in between).

---

## D34. Routing costs in seconds, and which doors a route uses (2026-10-21, agreed)

**Problem.** 4b needs one number to minimize that weighs walking, waiting at Taft and changing floors against each
other. The S5 time estimate needs the same numbers. And until floor plans exist (8b), the router can't know which
door is nearest a room inside.

**Decision.** The router adds up **seconds** (`src/shared/config/routing.ts`, owner's answers 2026-10-20):

- Walking at **1.3 m/s**. Each meter of a small street (`street`, walked down the middle) counts **×1.5**; outdoor
  steps **×1.2**. No preference for covered walkways (most aren't).
- **+45 s** each time a route crosses **Taft Avenue**. Small-street crossings (Dagonoy) have no wait.
- **Stairs 20 s per floor**, up or down. **Elevator 3 min** wait (rush hour is 3–10 min) **+ 5 s per floor**.
- **Auto** = elevator for **3 floors or more** (PRD UC3, kept: most students wait for the elevator), stairs below.
- All 9 gates are open all day; no path is closed.
- **The time shown** (S5's "about 4 min") is real time: meters ÷ 1.3 m/s, plus Taft waits and floor changes. The ×1.5
  and ×1.2 only steer which route is chosen. (Owner, 2026-10-21.)
- **Doors:** From on G starts at the building's main entrance(s), the PRD's spot default. From an upper floor, and at
  the To building, the route uses whichever door gives the cheapest outdoor walk. 8b adds the indoor distance.

**Alternatives.** Meters with penalties in meters (floors and waits don't convert naturally); a covered-walkway bonus
(rejected: most aren't covered); main entrances only until 8b (simple, but sends students round to the front past a
side door); any door from G too (ignores the PRD's spot default). **Revisit** with time-of-day elevator costs (PRD
Could) or once 8b gives indoor distances.

---

## D35. Which bends become a step, and what a turn step names (2026-10-21, agreed)

**Problem.** 4c turns a walk into steps (PLAN §6.3). The real walk network bends often: Gate 1 → ST311 is 428 m with 9
bends over 30°, and between the Taft sidewalk and STRC alone it zigzags 7 times in a short stretch (path, covered
walk, Fidel A. Reyes Street, path, covered walk, Fidel A. Reyes Street). A step at every bend means pressing Next
every few meters. And a turn step needs a name for *which* turn, from data that only has way names, a covered flag and
building outlines.

**Decision.** (Owner's answers, 2026-10-21.)

- **A step only where there's a choice:** a turn at a junction (a walk point with three or more links), a crossing
  and a door. A bend with no other way to go is no step; the previous step's distance covers it.
- **Jogs merge:** turns less than **15 m** apart become one, using the overall change of direction. Under **30°** it is
  straight on and no step. The size follows PLAN §6.3: slight 30–60° ("Bear left"), turn 60–135°, sharp over 135°.
- **A turn names the first of these that exists:** the name of the way turned onto ("Turn left onto SJ Walk"); else
  "the covered walk" if it is covered; else a building within **20 m** of the turn, by its short name ("Turn right at
  Velasco"); else nothing ("Turn right"). Block-tier buildings count.
- Distances are rounded for showing: to 5 m under 100 m, to 10 m from there.

**Alternatives.** A step at every bend over 60° (PLAN's literal wording; the zigzag alone becomes 4–5 steps); a step
only where the way's name changes (fewest steps, but a real choice on an unnamed path gets none). For names: buildings
only (students know them better than OSM's inner street names, but "at Velasco" is vaguer than "onto SJ Walk"); no
landmarks in v1 (weakest for text-only mode). **Revisit** if beta testers don't recognise the inner-campus street
names (Kalayaan, Bagong Lipunan, Kasaganaan): then drop way names for `path` ways and keep them for streets.

---

## D36. Floors are stretched onto the OSM outline by the compiler, turned by hand (2026-10-21, agreed)

**Problem.** ARCHITECTURE §4 step 4 (fit the traced plan onto the building's OSM outline) was unproven. The 6b spike
fitted four drafts (STRC 2F and 4F, St. Joseph 3F, Miguel 3F) in all 8 placements and found two things. The signs'
proportions don't match OSM: the straightened plans are 7–16% longer or shorter than the outline (STRC 4.06 and 4.21
against 3.61; St. Joseph 8.31 against 7.31; Miguel 1.75 against 1.88), and the two STRC signs differ from each other
by 4%. And the outline can't tell a sign from the same sign turned 180°: matching rules out a quarter turn every time,
but for box-shaped buildings the two remaining placements score within 0.02 m of each other.

**Decision.** (Owner's answers, 2026-10-21.)

- **Stretch to the outline:** each floor is stretched separately along length and width so its outer walls sit on the
  OSM outline. Walls never poke out of the 3D building, and outside doors land on the outline where paths meet them.
  Rooms come out up to about 16% wider or narrower than on the sign.
- **The outline's corners:** its own 4 corners when OSM draws it with 4 (STRC's is skewed at one end), else the
  smallest rectangle around it. The sign's long side goes along the outline's long side.
- **Turned by hand:** each floor file has `fit.turn`, 0 (the sign's top as near north as the outline allows) or 180.
  Claude sets it from the ground floor's doors against the entrance pins (D31), then by lining up stairs and elevators
  floor to floor; the owner confirms it in the 3D preview before `checked: true`. Without a ground-floor photo,
  Claude asks the owner.
- **The compiler applies the fit:** floor files stay in sign coordinates (0–1, as the photo), as
  `data-src/floors/<building>/<NN>.json` (not `.geojson`). The compiler fits them on every build and writes meters in
  campus.json's frame to `public/data/buildings/<slug>.json`. A new OSM snapshot re-fits every floor by itself.

**Alternatives.** Keep the sign's proportions with one scale, centred (rooms true to the sign, but outer walls miss
the 3D building by 0.5 m on average and 1 m at worst, and doors need snapping separately). The owner notes which way
each sign faces when photographing it (certain, but one more note for about 60 signs, and a revisit for the ones
already taken). Bake lon/lat GeoJSON into the floor file (opens in geojson.io, but cleanup no longer lines up with
the photo, and a new snapshot means re-fitting by hand). **Revisit if** a square-ish building needs a quarter turn
(add 90 and 270), or if measuring on site shows the signs, not OSM, have the right proportions.

## D37. Indoor walls are 0.2 m thick boxes, not flat panels (2026-10-21, agreed)

**Problem.** Floor files give each wall as a line with no thickness (D36). PLAN §5 sketched indoor walls as flat
panels, with backfaces drawn darker so a cut wall reads as solid. The floor builder (6c) has to pick one.

**Decision.** (Owner's answer, 2026-10-21.) Each wall segment becomes a box 0.2 m thick, centred on the
traced line, with two sides, two ends and a top. Each end runs on by 0.1 m so walls meeting at a corner close it.
From the angled camera, walls read as solid and a wall seen end-on doesn't vanish into a hairline, and when 7a's
clipping plane slices a floor open, the cut walls still look solid without a backface trick.

**Cost.** About 3 times the triangles of a flat panel (10 per segment); STRC's ground floor is 80. Centred on the
line, an outer wall stands 0.1 m outside the OSM outline that D36 fits it to. Door gaps narrow by 0.1 m on each side.

**Alternatives.** Flat double-sided panels (fewest triangles, but a hairline end-on, and the cut shows a line instead
of a wall top). Insetting outer walls so they stay inside the outline (needs to know which walls are outer, which
the floor file doesn't say). **Revisit if** a phone struggles with the triangle count on a 20-floor building (Andrew),
or the 0.1 m overhang shows against the outdoor mesh.

---

## D38. How search answers while typing, and what it does without a room list (2026-10-21, agreed)

**Problem.** user-flows §3.3 lists what S2 shows for finished codes. Building 3c (S2) raised what it shows while a
code is still being typed, what a real prefix shows when its building has no room list yet (6 of the 10 full
buildings, until 9a–9d), what the keyboard's Go key does, what Recent holds, and what tapping a room shows before
3d's room card exists.

**Decision.** (Owner's answers, 2026-10-21.)

1. **While typing**, S2 lists the rooms that start with what's typed (`ST31` → ST310, ST311…, 8 at most). It says
   "isn't in our list" only when no room code starts with it, so `AG110` never flashes red on the way to `AG1104`.
2. **A building with no room list yet:** `AG1104` shows "Br. Andrew Gonzalez Hall's rooms aren't in the app yet."
   with the building's row, so the student can still go to the building. It never routes to a guessed room.
3. **Go** opens a result only when the text is exactly one room or one building (name, alias or prefix). Otherwise
   it hides the keyboard. It never accepts a Did you mean, a sign prefix (D25) or a bare number.
4. **Recent** holds the last 5 destinations tapped, rooms and buildings, newest first, no Clear button. It shows in
   S2 with nothing typed and on home's sheet. It never holds From (PRD §6).
5. **Tapping a room** closes search, highlights its building and shows a plain card: code, name, "STRC · 3F". 3d adds
   the floor band, the floor chip and Share.
6. **Did you mean** offers rooms one typo away in the same building (one character changed, added, dropped, or two
   neighbours swapped: `ST350` → ST305, ST310), and building names one typo away per word of 4+ letters
   (`velsaco` → Velasco). **uFuzzy and cmdk are not used** (ARCHITECTURE §2 is updated): uFuzzy found nothing for
   any code, even with digits allowed in words, and its one-typo setting is an enum missing from its JavaScript
   (setting it crashed at load); cmdk added about 18 KB gzipped to the first-load chunk, mostly Radix Dialog code
   we don't use. The rows are plain buttons with Up/Down arrows for keyboards.

**Alternatives.** Rejecting partial codes until they parse (simpler, but `AG110` reads as rejected). Strict "isn't in
our list" for buildings with no room list (reads as if the room doesn't exist). Offering "probably 11F" from the
number (a guess, against PRD §7). Go only hiding the keyboard (one extra tap every time). Rooms-only Recent.
Keeping uFuzzy with a lint exception, and keeping cmdk for its combobox semantics. **Revisit if** students often
mistype in ways one typo doesn't cover, or screen-reader testing shows the button list is harder to use than a
combobox.

---

## D39. Floors are labelled whole, and stairs list their own floors (2026-10-21, agreed)

**Problem.** 8a puts rooms, doors, stairs and elevators into the floor files and joins them into an indoor graph.
Three things needed an answer: how the build knows which floors an elevator stops at, when a floor counts as
labelled, and whether the four skybridges join the graph now.

**Decision.** (Owner's answers, 2026-10-21.)

- **`data-src/floors/<building>/verticals.json`** lists each stair and elevator with its `servesFloors`; floor
  files only place them. An evacuation sign draws an elevator shaft on every floor, also on floors it skips, so the
  floors can't be read off the signs.
- **A floor is labelled whole.** A floor file without `rooms` asks nothing. Once it has `rooms`, every room the
  room list puts on that floor must be placed, each code once, and every vertical that stops there must be placed
  once it has `verticals`. The build fails on a door or vertical more than 3 m from a hallway, an entrance more than
  5 m from the G hallway, and, once G is traced, any placed room that can't be reached from every main entrance.
- **Bridges wait for 9b/9c.** None of the bridged buildings (Miguel, Gokongwei, St. Joseph, Yuchengco) has floor
  files yet; they join the graph when one of each pair is traced.
- The shape Lane A reads is in `src/shared/data/indoor.ts`: `graph` (points with a floor each; links `hall`,
  `door`, `stairs`, `elevator`, `entrance`), `rooms` (label and door points), `verticals` (`stops` on each
  labelled floor) and `entrances` (index into campus.json's `entrances`).

**Alternatives.** `servesFloors` read off which floor files place a vertical (less to type, but routes a skip-stop
elevator to floors it skips). Labelling room by room (no all-or-nothing floor, but a forgotten room fails silently
until launch). Bridges now, on made-up fixtures (a shape with nothing real to test it against). **Revisit if** a
building's labelling has to land in parts, or a bridge turns out to join a floor that isn't traced.

---

## D40. What a `?to=` link opens, and what Share does without a share sheet (2026-10-21, agreed)

**Problem.** 3d builds the room card's Share and the deep link `…/?to=ST311` (user-flows §3.4, §3.9). Four things
needed an answer: which links open a card and which open search, what happens to the address bar once a link is
read, what Share does in a browser with no share sheet, and where Share sits on the card.

**Decision.** (Owner's answers, 2026-10-21.)

1. **A link opens what Go would open** (D38): exactly one room (`ST311`, `C311`, `ST404/406`) or one building
   (`Velasco`, `strc`) opens its card. Anything else (`ST350`, `AG1104`, a sign prefix, a typo, a bare number) opens
   S2 with the text typed, showing what S2 shows for it. Only `to` is read, at most 40 characters; `from` is never
   read from or put in a link (PRD §6). In dev, the 5c dev link (`?from=…&to=…`) still wins.
2. **Read once, then cleaned.** The app reads `?to=` when it loads and takes it out of the address bar at once
   (`replaceState`), so a reload lands on home and the phone's Back closes the card like any other pick. The link
   opens once the room list is ready; if the list can't load, S2 opens with the text typed and says so.
3. **No share sheet** (most desktop browsers, some in-app browsers), or one that refuses: Share copies the link,
   and the card says "Link copied" for 2 s (or "Couldn't copy the link"). Closing the share sheet without sharing
   says nothing. The share text is the card line, "ST311 · Surface Physics Lab · STRC 3F".
4. **Share is an icon button** beside Close, as DESIGN.md's Room card already said, so Directions (5a) stays the
   card's one button.

The map side follows DESIGN.md as written: the band covers every volume that holds the whole storey, a storey being
the first volume's height over `levels`; the camera tries ten headings nearest the student's own (0°, ±30°, ±60°,
±90°, ±135°, 180°) and takes the first that sees every band point, else the one that sees most.

**Alternatives.** Keeping the URL in sync with the open card (always shareable from the address bar, but every
overlay's history entry would have to carry a URL, and a reload reopens a card the student closed). Hiding Share
where there's no share sheet (less code, but desktop students couldn't share). A Share pill under the card's text
(clearer label, but a second button next to Directions). Opening a guessed card for a near miss like `ST350` (a
silent guess, against PRD §7). **Revisit if** students want to share a building as often as a room, or the
address bar is how they share on desktop.

---

## D41. Routes go inside: where the building files come from, and what indoor steps say (2026-10-22, agreed)

**Problem.** 8b joins the indoor graph (8a, D39) to the outdoor route. Three things needed an answer: how the router
gets a building's file, since `buildings/<slug>.json` is loaded per building and the router is built once; what an
indoor turn says, since hallways have no names; and what the last step says at the room.

**Decision.** (Owner's answers, 2026-10-22.)

- **The router call takes the trip's building files** (`Router`'s optional 4th argument, `IndoorFiles`): the From
  and To buildings' files that loaded, by slug. Lane A loads only those two, matching ARCHITECTURE §3.5. A building
  left out, or a floor the trip needs that isn't labelled, is routed as before 8b (to the door, then floors only),
  and is named in `Route.noIndoorMap` for O5.
- **An indoor turn names a room**: "Turn left at ST305", the room whose door is nearest the turn, within 5 m; else
  plain "Turn left". Turns follow D35 otherwise: only at junctions, jogs under 15 m merged, under 30° no step.
- **The last step gives the side**: "ST311 is on your left", from the way the student walks up to the door; "ST311
  is ahead" when the door is within 30° of straight on. No door counting: floor files place only listed rooms' doors.
- **The shape grows, nothing changes** (`src/shared/data/route.ts`): an `indoor` leg per floor walked, between the
  floors legs; `floors` legs and steps say which stairs or elevator (`via`, `at`); `enter` and `floors` steps carry
  the walk to the next step (`meters`); a new `arrive` step; indoor turns and starts reuse `turn` and `start`.

Claude's calls, not the owner's: costs stay D34's (an elevator ride waits once, however many floors); a trip from an
upper floor with no room starts at that floor's elevator, else its first stairs (PRD UC2); an elevator that skips the
To floor is ridden as far as it helps, then the stairs; stairs and elevators on checked floors never say
"(approximate)".

**Alternatives.** All building files given once to `createRouter` (simplest, but loads every building at start, and
Andrew's 20 floors are the biggest). Turns as bare directions (shortest, but easy to take the wrong junction in a long
hallway) or toward a range of rooms (most telling, longest, hardest to get right). "The 3rd door on your left"
(unreliable: restrooms and unlisted doors aren't in the files). **Revisit if** beta testers miss turns indoors, or
a building's rooms are numbered so that the nearest room misleads.

---

## D42. Where are you (S4) opens under the room card only, and Change spot waits for indoor steps (2026-10-21, agreed)

**Problem.** Building 5a (S4) raised three things the docs left open: user-flows §3.1 sends a building card to S4
when From is empty, but a building card also opens when a student just taps the map to look around, and inside S4 a
map tap sets From; `From` has no spot (8b starts an upper floor at its elevator, else its first stairs, D41), so
"Change spot" needs a new field in the lanes' shared contract; and S5 (5b) doesn't exist yet, so S4 needs somewhere
to hand off to.

**Decision.** (Owner's answers, 2026-10-21.)

1. **S4 opens by itself only under a room card** (§3.4, D23). A building card shows Directions, which opens S4.
   Tapping around the map stays browsing.
2. **Change spot moves to 8c**, with the indoor steps in the player, where a chosen spot shows. Until then the floor
   step says the default under the chips: "G starts at the main entrance; other floors at the elevator lobby."
3. **Until 5b, the all-steps list (5c) stands in for S5.** Its trip line shows From → To before any step, and a
   "Change where I am" button reopens S4. 5b replaces it.
4. While S4 is open, the room card shrinks to one line above it; the gates are a chip grid; From stays in memory.

**Alternatives.** Opening S4 under every building card (one tap less, but browsing turns into setting From).
Building Change spot now (a contract change in Lane B's router, for a choice the steps list can't show yet).
Returning to the card with From shown until 5b (nothing to test on a phone), or merging 5a and 5b (one huge PR).
**Revisit if** students mostly pick buildings, not rooms, as destinations.

## D43. Route preview (S5): Start opens all steps until 5d, exit choice in 8c, line outdoors (2026-10-22, agreed)

**Problem.** Building 5b (S5) raised four things the docs left open: Start needs somewhere to go before the step
player (5d) exists; user-flows §3.6 puts "which exit to use" in Route options, but the router's contract takes only
Stairs / Auto / Elevator (D41); the 3D map has no cutaway until 7a, so a route's indoor legs would float inside
solid blocks; and only STRC and Velasco have indoor maps, so most routes stop at a door and the time leaves out the
walk inside, with nothing on S5 saying so (O5 put it on S9).

**Decision.** (Owner's answers, 2026-10-22.)

1. **Until 5d, Start opens the all-steps list (S8).** Back returns to S5. 5d swaps it for the player and nothing
   else changes. "Change where I am" leaves S8 for now: S5's From chip does it, and 5d's ⋯ menu brings it back.
2. **The exit choice moves to 8c**, next to Change spot (D42): both choose a door or spot, and both need a field the
   router doesn't take yet. Route options in 5b are Stairs / Auto / Elevator only, and hidden when the route
   changes no floor.
3. **The line on the map draws only the outdoor walk** until the cutaway (7a). Inside a building, the "you are here"
   dot (From's floor) and the floor band (To's floor) carry it.
4. **S5 says when a building has no indoor map yet:** "St. Joseph has no indoor map yet, so directions stop at its
   door." (or start there, for From; door to door, for both; only the floor, for a trip inside one building).
5. The room line stays on top of S5 as it does on S4, so the building and floor stay on screen.

**Alternatives.** Leaving Start out until 5d (the preview then has no primary action). Asking Lane B for an exit
option now (5b would wait on a contract change). Drawing indoor legs through the walls (lines floating at floor
heights inside solid blocks read badly). Saying "indoor map coming" only on S9 (the student finds out at the door,
and the time looks shorter than the trip). Dropping the room line and putting the floor on the To chip (more map,
but the sheet jumps between S4 and S5). **Revisit if** testers miss the exit choice, or the indoor-map line reads
as noise once most buildings have their maps.

## D44. Step player (S6): the camera and the dot follow each step (2026-10-22, agreed)

**Problem.** user-flows §3.7 says the camera moves to each step, but not how. Indoor steps exist for STRC and
Velasco (8b), yet the cutaway that shows a building's inside is 7a, after 5d, so an indoor step's spot sits inside a
solid block. The "you are here" dot marks From on S5; nothing said what it does once the student steps through. And a
turn reads wrong if the map is turned so the walk points down the screen.

**Decision.** (Owner's answers, 2026-10-22.)

1. **Indoor steps, until 7a:** the camera frames the building, and the green floor band moves to the floor that step
   is on. 7a swaps this for the cutaway.
2. **The dot moves to each step's spot** (the turn, the door, the stairs), at that step's floor inside a building, so
   the map shows where the student should be now.
3. **Outdoor steps face the way the student walks:** the camera turns so the walk from that step points up the
   screen, as in navigation apps. Reduced motion makes the flight a cut, as everywhere.

**Alternatives.** Flying to an indoor step's spot anyway (the camera shows a roof). Keeping the whole-trip view for
indoor steps (the map stops helping indoors). Leaving the dot on From (nothing marks the step). Keeping the student's
heading (calmer, but "turn left" can point right on screen). **Revisit if** testers find the turning map
disorienting, or once 7a's cutaway lands.

## D45. The cut slides in, out and between floors; indoor steps at 40° (2026-10-22, agreed)

**Problem.** PLAN §5 asks for one animation: the cut slides from the roof down to the floor as a step enters a
building. It says nothing about leaving the building, a floor change inside it, or stepping into another building.
And the camera saw an indoor step from 58° (the room card's angle), where the 1.2 m walls hide the far side of each
room.

**Decision.** (Owner's answers, 2026-10-22, 7b.)

1. **Every change of the cut slides, 600 ms, with the camera flight's ease-out:** in from the roof, out to the roof
   (then the building rejoins the campus), from one floor's cut to the other's, and into a second building from its
   roof (the first rejoins at once). Reduced motion makes every slide a cut.
2. **Indoor steps are seen from 40°**, the outdoor steps' angle (`STEP_POLAR`), so going inside changes the target,
   not the tilt, and the low walls hide less.

**Alternatives.** Sliding only on the way in (leaving looks abrupt next to it). Sliding in and between floors but
cutting on the way out. Keeping 58° (more 3D, walls hide more) or going steeper, about 30° (reads as a flat plan).
**Revisit if** testers find the slide slow on repeated floor changes, or 40° hides too much of a tall building.

## D46. The indoor cut is a plan: closer camera, darker walls, the goal floor on the rail (2026-10-22, agreed)

**Problem.** The Phase 7 critique (7▸, 22/40) found the cut floor unreadable on a phone. Indoor steps used the
building's own view (the building and its neighbours), so a floor plan was about 70×135 CSS px. Walls and slab were
the same cream, so rooms read only by side shading. The rail showed only the current floor, and looked like Google
Maps' tappable level picker. The 600 ms slide was 97% done by 300 ms and read as a flicker. The Shaped-by-Light
Rule (one colour per building, no fills) left no room for a plan's own needs.

**Decision.** (Owner's answers, 2026-10-22, 7▸.)

1. **A named exception, the Indoor Cut**, beside the selected building's tint: the cut floor may use a darker tone
   of the building colour for its walls, and (from 8c) one Campus Green mark for the goal room and the indoor line.
   Nothing else on the map changes.
2. **An indoor step on a labelled floor flies to its spot** at the floor's height, about 22 m across, from 40°,
   facing the way the student walks, as outdoor steps do. The camera may come closer indoors than outdoors. Without a
   spot (an unlabelled floor), the building's view stays.
3. **The rail marks the goal floor**, where the route's stay in the building ends, with an outlined chip, and says it
   ("Going to 3F"). Other rows lose their pill shape so the rail reads as a gauge. It stays display-only.
4. **The slide eases with a cubic ease-out** over the full 600 ms (it was the camera's exponential curve), so the cut
   is seen passing the floors. This replaces D45 point 1's "with the camera flight's ease-out".
5. **The cut building keeps its selection tint**, its name label hides while it is cut, and off-campus blocks no
   longer draw over the cut.

**Alternatives.** Keeping Shaped-by-Light strict (contrast from shading alone; the critique's screenshots show it
doesn't read). Making the rail tappable to preview other floors (48px rows make a tall rail; no use case asks for it
yet). Drawing the indoor line and goal-room mark now (new drawing, not polish: moved to 8c with "Indoor map still
saving"). **Revisit if** testers still can't read the plan at 22 m, or tap the rail expecting it to move; and when
DLSU's real floor plans arrive or the post-build indoor restyle starts. **This is the interim look** (owner,
2026-10-22): today's floors are traced from evacuation maps only, and the final indoor view is meant to be a
Sims-like bird's-eye dollhouse, designed once the app is built and iterated from there.

## D47. 8c splits in two: the indoor drawing first, Change spot and the exit choice after a router change (2026-10-22, agreed)

**Problem.** Planning 8c found most of it already built: the player plays indoor steps (7b, 7▸), "indoor map coming"
(O5) is on S5 and S9, and unchecked doors say "(approximate)" (O6). What's left falls in two kinds. The indoor line,
the goal-room mark and "Indoor map still saving" are Lane A only. Change spot (D42) and the exit choice (D43) need a
`spot` on `From` and an exit option the router doesn't take yet, in `src/features/routing/`, which is Lane B's.

**Decision.** (Owner's answer, 2026-10-22.)

1. **8c-1, now:** the indoor line and goal-room mark on the cut floor (D46), and "Indoor map still saving" for a
   building file that failed only because the phone is offline (a missing file still means "indoor map coming").
2. **8c-2, next:** a small contract PR in `src/shared/data/route.ts` that both lanes look at, then the router change
   and the two pickers, once Charles agrees the shape.
3. **O6 for stairs and elevators waits:** the floor files have no checked flag for them, only `checked` per floor.

**Alternatives.** One PR with the router change done in Lane A (bigger, and in Charles's folder). Building the pickers
against a sample while Charles does the router (8c stays open until his part lands). **Revisit if** Charles would
rather Lane A write the router change.

## D48. The 8c-2 contract: a spot on From, and a door choice as the router's last argument (2026-10-22, agreed)

**Problem.** Change spot (D42) and the exit choice (D43) need the router to take two things it can't yet: where on
From's floor the student stands, and which door to leave by. Both change `src/shared/data/route.ts`, which both lanes
read, so the shape is agreed before the router (Lane B) or the pickers (Lane A) are built.

**Decision.** (Draft for Charles, 2026-10-22.)

1. **`From`'s `building` kind gets an optional `spot`:** an entrance (G only, by its index in `campus.json`'s
   `entrances`, needs no building file) or a stairs or elevator on that floor (by its id in the building file). S4
   offers only spots the data has, the same ids the floor file and `indoor.ts` already use.
2. **The router takes an optional fifth argument, `doors`:** `exit` for From's building and `entrance` for To's, by
   entrance index. Left out, the router picks as now. Only the exit gets a picker in 8c-2; `entrance` waits for a
   reason. An exit is ignored when the spot is an entrance, because the student is already at a door.
3. **A spot or door the router can't place gives `unknown-place`,** never a quiet fallback to the default, so a bad
   pick shows up instead of routing from somewhere else.
4. **`WalkEnd`'s door gets an optional `entrance` index,** so Route options can show which door the route took.
5. All new fields are optional and `doors` comes last, so every existing call and sample still means the same (D41).

**Alternatives.** Turning `mode` into an options object (tidier, but it changes every call in both lanes at once).
Naming doors by kind and name instead of index (Velasco has two unnamed main entrances, so names don't tell them
apart). Putting the exit on `From` (it's a route option in S5, not where the student is). **Revisit if** the entrance
index stops being stable between `campus.json` and the building files, which come from the same build.

**Agreed** by Charles on #78 and Gary in chat (2026-10-22), with two cases the draft left open, as Charles proposed:

- **A door spot on a trip inside one building** starts the walk inside at that door, in place of the main
  entrances.
- **A stairs or elevator spot on G** gets a short walk inside from it to the exit, which a G tap doesn't have
  otherwise, and may leave by any door, not only the main ones.

And one for the data: **a building with two doors of one kind names each one** (`facing Taft`, `facing Agno`), and
the build fails until it does. The name reads in both "Enter Velasco by the main entrance facing Agno" and "Leave
Velasco by…", so it says where the door faces, never "to" or "from". The names are the ones students use (owner,
2026-10-22).

## D49. A size budget for the JavaScript, checked on every build (2026-10-22, agreed)

**Problem.** Vite warns when a chunk is over 500 kB before compression. Two chunks were over it: the first-load
chunk at 569 kB (179 kB gzipped) and the lazy 3D chunk at 995 kB (266 kB gzipped). The first-load growth since 1d is
real code (React, zod, motion for the sheet, routing), not an accident. three.js alone is about 950 kB, so its chunk
can't get under 500 kB. A warning that always shows gets ignored, and then it can't catch real growth either.

**Decision.** (Owner's answer, 2026-10-22.)

1. **Budget what the phone downloads, gzipped:** the first load (the entry script and every chunk `index.html`
   preloads) at most **200 kB**; every other chunk at most **300 kB**.
2. **`scripts/check-size.mjs` enforces it** at the end of `npm run build`, so the `gates` job fails on a PR that
   goes over. No new dependency.
3. **three.js gets its own chunk** (with `@react-three/*` and camera-controls), and a `vendor` chunk holds what the
   first screen and the map share (React, zustand). Without it rolldown puts React in the three chunk and three.js
   lands in the first load. Vite's `chunkSizeWarningLimit` is 1000 kB, the smallest round number the three chunk
   fits under.
4. **Nothing else goes lazy for now.** Where are you would save 2.9 kB for a blank sheet after Directions, and the
   route screens share an `index.ts` with hooks the shell needs, for about 5 kB. Neither is worth it today.

At the time of writing: first load 179 kB gzipped (index 109, vendor 70), three 249 kB, the map's own code 15 kB.

**Alternatives.** Leaving the warning on every build (it gets ignored). Raising the limit with no budget (growth goes
unnoticed). `size-limit` or Lighthouse CI (a new dependency outside ARCHITECTURE §2 for what a short script does).
**Revisit if** the first load nears 200 kB (about 21 kB of room today: split the route screens first), a budget
blocks a feature that needs the bytes, or testers on slow phones find the first load slow even within budget.

**When it gets too big, in this order** (agreed by Gary and Charles, 2026-10-22):

1. **Load later what the first screen doesn't show.** The route screens first (about 5 kB): give `route-player` a
   second entry for its components, so the shell's hooks stay in the first load and the screens don't.
2. **Swap a heavy library for a lighter one that does the same job:** `zod/mini` for zod (same schemas, a fraction
   of the size), and look at whether the sheet still needs all of `motion`.
3. **Move work out of the phone's download:** anything computed from the data at startup belongs in the data
   compiler, which runs at build time.
4. **Only then raise the budget,** as a new D-number that says what the bytes buy. The PWA saves everything after
   the first visit, so the budget is really about that first visit on mobile data.

## D50. No download percentage while saving for offline (2026-10-22, agreed)

**Decision.** (Owner's answer, 2026-10-22.) O2 keeps "Saving for offline…" with no number. We keep the service
worker vite-plugin-pwa generates (Workbox `generateSW`) instead of writing our own to report progress.

**Why.** Workbox's generated worker reports no progress (PROJECT_FACTS, Offline). A real percentage needs
`injectManifest`: our own worker with its own install loop, which means rewriting and proving again the precache,
`clientsClaim` and update logic that the whole offline promise rests on. The first save is about 2–3 MB, a few
seconds on campus Wi-Fi, and the app is usable while it runs (user-flows §4), so a number adds little.

**Alternatives.** Our own service worker with a byte-weighted percentage (about one extra session, more risk).
Counting files as they land in Workbox's precache cache from the page (cheap, but it jumps unevenly because the
three.js chunk is most of the bytes, and it depends on Workbox's internal cache name).
**Revisit if** testers say the first save feels stuck, or the precache grows past about 10 MB (ARCHITECTURE §3.5
allows 15 MB).

**Agreed** by Gary and Charles (2026-10-23).

---

## D51. `V` is an accepted alias for Velasco, like `VE` (2026-10-23, agreed)

**Problem.** Students say and type Velasco rooms as `V205`. Our prefixes are `VL` (alias `VE`), so `V205` gave "No
building uses V" and the room couldn't be found, even though `VL205` is in the app.

**Decision.** (Owner's call, 2026-10-23.) `V` joins Velasco's accepted prefixes: `["VL", "VE", "V"]` in
`data-src/campus/buildings.json`. `V205` opens VL205 with "also written V205", exactly as `VE205` does, and `V2`
lists the same rooms as `VL2`. The canonical code stays `VL205`, so deep links and shared codes don't change. `VH`
stays a suggest prefix (D25). Tests: `tests/search.test.ts` and the prefix table in `tests/compile-data.test.ts`.

**Why an alias, not a suggestion like `VH`.** `V` belongs to no other building, so `V205` can only mean one room: it
isn't a guess. `C` for STRC works the same way.

**Alternatives.** A suggest prefix (`V205` → "Did you mean VL205?", one more tap). Leaving it out (students who type
`V` find nothing).

**Agreed** by Gary and Charles (2026-10-23).

---

## D52. The "you are here" dot glides along the route on Next and Back (2026-10-23, agreed)

**Problem.** D44 moves the dot to each step's spot, but says nothing about how. It jumped there, so while the camera
flew, the dot (what the eye follows) seemed to teleport.

**Decision.** (Owner's call, 2026-10-23; Gary agreed to Charles building it in Lane A's map.)

1. **On one level** the dot glides from the old spot to the new one along the route's line, through its corners,
   forwards on Next and backwards on Back. **G counts as the ground** (it is at ground height), so walking outside,
   going in or out through a door and moving around G are one level; each upper labelled floor is its own. Its height
   changes evenly along the way (the dot sits a metre above a floor). A spot is on a line when it is within 1 m of it;
   when the two spots aren't on one line it glides straight. A line that passes a spot twice (out and back) is read at
   its first pass, so the dot may take the short way along it: accepted for v1.
2. **Between floors of one building it climbs** at the stairs or elevator: on Next it rises there, then walks the new
   floor's line to the next spot; on Back it walks the old floor's line to the stairs, then drops. Each floor's stairs
   were traced on their own (St. Joseph's sit up to 6.6 m apart from floor to floor), so the stairs end may be up to
   8 m off the other floor's line. The climb counts in the path's length, and the cut slides at the same time (D45).
3. **600 ms, the cut slide's cubic ease-out** (D45), so the dot and the cut move as one. A tap mid-glide starts the next
   glide from where the dot is drawn.
4. **It jumps** into another building's upper floor, onto a floor without a spot (unlabelled), on and off the player,
   and under reduced motion (a glide already under way, at most 600 ms, finishes).
5. **The camera is unchanged:** it still flies to each step in 650 ms (D44). The step's words show at once; the glide
   delays nothing.

Pure logic in `src/features/campus-scene/glide.ts` (tests in `glide.test.ts`).

**Alternatives.** The camera following the dot down the path, longer for longer walks (more cinematic, but slower to
read and more work). Keeping the jump.

**Agreed** by Gary and Charles (2026-10-23).

---

## D53. The cut floor keeps green for "yours": neutral hallways, a label pin for the goal (2026-10-23, agreed)

**Problem.** The 8▸ critique (`.impeccable/critique/2026-10-23T04-20-22Z__src-features-location-picker.md`) found the
indoor step hard to read. Green did three jobs on the cut floor: the hallways, the 1.1 m indoor line, and a hollow
goal ring that sat beside the same-green "you are here" dot, so the goal read as a second dot. On G floors the 5.5 m
outdoor ribbon swamped the entrance. Offline, with the indoor map still saving, the floor chip showed the step's floor
(G) while the step said 3F.

**Decision.** (Owner's answers, 2026-10-23, 8▸.)

1. **Hallways are a darker neutral** of the building colour, not green, so Campus Green on the cut means only the
   route and the goal. This narrows D46's Indoor Cut exception.
2. **The goal room gets a label pin** at its door: a Campus Green plate with its code ("ST311"), like a selected
   building label. The owner first picked tinting the room itself, but the floor data has no room outlines, so the
   pin stands in. Revisit if room outlines are ever added to the floor files.
3. **The indoor line is 1.6 m on a 2.9 m white casing**, and the outdoor ribbon fades toward the ground while a
   building is cut open.
4. **When a building's indoor map is still saving or failed**, the band and chip show the goal floor, and the step
   says "Indoor map still saving · follow signs to 3F". S5 says "STRC's indoor map is still saving. Steps inside are
   text only." instead of promising to stop at the door.

**Alternatives.** Tinting the room (needs outlines, see 2). Keeping the ring and recolouring it (still a circle next
to a circle). Green hallways with a thicker line (the line still disappears into them).

**Agreed** by Gary and Charles (2026-10-23).

---

## D54. One-letter shortcuts for Andrew, Yuchengco, St. Miguel and St. Joseph (2026-10-23, agreed)

**Problem.** After D51 (`V` for Velasco), the owner checked what else students type. They also write Andrew rooms as
`A1104`, Yuchengco's as `Y305`, St. Miguel's as `M203` and St. Joseph's as `J204`. Only `J` did anything (a "Did you
mean", D25); the rest gave "No building uses …".

**Decision.** (Owner's call, 2026-10-23.) `A` (Andrew), `Y` (Yuchengco), `M` (St. Miguel) and `J` (St. Joseph) join
those buildings' accepted prefixes in `data-src/campus/buildings.json`, after the canonical one. Each opens the room,
"also written J204", exactly as `V` and `C` do, and lists rooms while typing (`J2` as `SJ2`). A building without a
room list yet (Andrew, Yuchengco) says so, as for its main prefix (D38). Canonical codes don't change, so deep links
and shared codes keep working. This reverses D25 for `J` only; `VH` stays a suggestion.

**Why aliases.** No other building uses these letters, and the parser reads every letter before the number as the
prefix, so `M` and `MM` (Mutien-Marie), or `A` and `AG`, never meet: a shortcut can only mean one building.

Tests: `tests/search.test.ts` (each shortcut on the real rooms) and the prefix table in `tests/compile-data.test.ts`,
seen failing first.

**Alternatives.** Suggest prefixes for all four (one more tap each). Leaving them out.

**Agreed** by Gary and Charles (2026-10-23).

---

## D55. Search is a card that rises over the map (2026-10-25, agreed)

**Problem.** Search (S2) replaced the whole screen with a white page. On a phone the student lost the map the moment
they tapped "Where to?" (v2 request 1, `docs/V2-UX-REQUESTS.md`).

**Decision.** (v2 request 1; Charles's answer on #98, Gary agreed.) Search opens as a light card that rises from the
bottom, like Apple Maps' search card, with the map still showing above it and the keyboard. The map stays frozen
(inert) while typing. The card's top is fixed, leaving about a third of the visible height as map; that strip is
dimmed, and a tap on it closes search. Wide screens get a floating panel at the top left, under the pill (Gary,
v2-A1). Search behaviour doesn't change: strict matching, Go only on an exact match (D38). The card stays
light in every colour mode (D57).

**Changes** `docs/user-flows.md` §3.3 (S2) and DESIGN.md's search spec.

**Alternatives.** A strip of map at the top with the panel under the pill (the keyboard leaves almost no map). A
pannable map behind the card (taps meant for the card move the map).

**Agreed** by Gary and Charles (2026-10-25).

---

## D56. The fog sits at 2.5× to 5× the camera's distance (2026-10-25, agreed)

**Problem.** The haze started at 0.8× the camera's distance to its target and was solid at 1.5× (D13), so the map
looked washed out even at close zoom (v2 request 2).

**Decision.** (v2 request 2, picked from draft #99's phone trial.) `HAZE_NEAR = 2.5`, `HAZE_FAR = 5`. Only the far
horizon fades, and the edge of the OpenStreetMap snapshot stays hidden. Shipped in #100. Each colour mode (D57) gets its
own haze colour, not its own distance.

**Changes** D13's haze. **Alternatives.** No fog (`none` in #99: the world's edge shows at wide zoom). Today's.

**Agreed** by Gary and Charles (2026-10-25).

---

## D57. Three map colour modes: Green, Black, Grey; the interface stays light (2026-10-25, agreed)

**Problem.** D13 picked one green map palette and removed the switch. Gary wants students to pick (v2 request 3).

**Decision.** (v2 request 3 and question 1; Charles's answer on #98, Gary agreed.)

1. **Three map palettes**, from the prototype's (`prototypes/map-home/scene.js`): **Green** (today, the default),
   **Black** and **Grey**. Only the map changes: search, sheets, panels and the pill stay light in every mode.
2. **The choice is saved on the phone** (D58's settings store), so it survives closing the app and works offline.
3. **Everything drawn on the map stays readable in all three:** the route line, the dot, the floor band, labels and
   spot plates, the cut floor (`cutTones()` already derives from the palette). The WCAG AA checks in
   `src/shared/config/contrast.ts` (10c) run over all three modes.
4. **The size budget (D49) still holds:** palettes are data, not new code paths.

**Changes** D13 (one palette, no switch). **Alternatives.** Black as a full night mode with a dark interface (every
screen re-polished; DESIGN.md has only light tokens).

**Agreed** by Gary and Charles (2026-10-25).

---

## D58. A 2D / 3D toggle and one map options button (2026-10-25, agreed)

**Problem.** The map is always tilted 3D. Some students read a flat map faster, and Gary wants the choice Apple Maps
gives (v2 request 4).

**Decision.** (v2 request 4; Charles's answers on #98, Gary's on 2026-10-25.)

1. **2D:** the camera looks straight down (polar 0), tilt gestures are off, and **north is always up** while browsing:
   twisting is off too, and the compass hides. The route player still turns walking direction up (D59). Buildings
   become very low blocks (they still read as buildings), not flat outlines. Labels stay upright.
2. **3D:** today's view.
3. **Route steps ignore the choice outdoors:** they use the drone view in both (D61). Indoor steps keep 40° in 3D and
   look straight down in 2D.
4. **One map options button** on the map holds colour mode (D57), 2D/3D and see-through (D60), so all three stay out
   of the way until wanted.
5. **One saved settings store** (`src/shared/settings/`) holds all three, saved on the phone. Both lanes read it.

**Alternatives.** Flat footprints in 2D (lose the sense of buildings). 2D with twist allowed (then 2D needs the compass
and a north reset, and "north up" stops being a guarantee).

**Agreed** by Gary and Charles (2026-10-25).

---

## D59. The camera follows the dot on Next and Back (2026-10-25, agreed)

**Problem.** D52's dot glides, but D52 point 5 left the camera flying straight to each step in 650 ms (D44). The view
cut across while the dot walked, which read as teleporting, worst at turns (v2 request 5).

**Decision.** (v2 request 5 and question 2; Charles's plan and answers on #98, Gary agreed.)

1. **The camera follows the glide.** The dot and the camera read the same glide each frame: the camera looks a few
   meters ahead of the dot, so corners turn gradually. When the glide ends, the camera is already at the step.
2. **Walking direction is up** for the whole trip. A compass tap turns the map north up, and a pan stops the follow,
   but both only until the next Next or Back.
3. **Duration grows with distance, 1–3 s.** A tap mid-glide starts the next one from where the dot is (as D52).
4. **Back cuts quickly** instead of replaying the walk backwards.
5. **The walked part of the route goes grey**, built last (`docs/ROADMAP-v2.md`).
6. **Reduced motion still cuts.**

The follow math is pure and test-first (`campus-scene/follow.ts`).

**Changes** D44 (camera flies to each step) and D52 point 5 ("the camera is unchanged"). **Alternatives.** North up
with the dot crossing the map (turns are harder to read). A fixed speed per 100 m (long walks take too long).

**Agreed** by Gary and Charles (2026-10-25).

---

## D60. See-through buildings; the player fades only what hides the route (2026-10-25, agreed)

**Problem.** Solid campus buildings hide the route, the dot and the goal behind them (v2 request 6).

**Decision.** (v2 request 6 with Charles's change on #98; Gary's answer on 2026-10-25.)

1. **A manual setting, Solid / See-through**, in map options (D58), saved on the phone.
2. **While a route plays, the app fades only the buildings that stand between the camera and the route**, whatever the
   setting.
3. **The goal building and the selected building never fade.** The entered building keeps its cutaway (D45, D46).

**Alternatives.** A slider or a third "outlines only" step (more to choose, little gain). Setting only (puts the work
on the student).

**Agreed** by Gary and Charles (2026-10-25).

---

## D61. Outdoor route steps use a top-down "drone" view (2026-10-25, agreed)

**Problem.** Outdoor steps were seen from 40° (D44), and tall buildings like Andrew and Razon still covered the path
(v2 request 7).

**Decision.** (v2 request 7; Charles's answers on #98, Gary agreed.)

1. **Outdoor steps look down from about 8° off vertical**, zoomed so the step's whole stretch fits, walking direction
   up (D59). Not 0°: straight down, the camera can't tell which way is up and the heading jumps.
2. **The route overview (S5) is top-down too**, turned so the route's long side runs top to bottom.
3. **It applies in 3D too** (D58).
4. **Going inside, the camera tilts from 8° back to 40° at the door** as the floor opens. Climbs keep the 600 ms slide
   (D45).

**Changes** D44 (outdoor at 40°) and D45 (the going-in transition). **Alternatives.** 10–15° (buildings read as 3D but
still hide short stretches). Today's 40°.

**Agreed** by Gary and Charles (2026-10-25).
