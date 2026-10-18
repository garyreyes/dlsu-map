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
"typescript": "npm:@typescript/typescript6@^6.0.3",   // tools import "typescript" and get the 6.0 API
"@typescript/native": "npm:typescript@^7.0.2"          // provides the `tsc` binary = 7.0 (fast)
// scripts
"typecheck": "tsc --noEmit -p ."
```
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
```
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

**Revisit** after the Phase 2 side-by-side on real phones.
