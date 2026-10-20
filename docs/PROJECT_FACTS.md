# Project facts

Durable facts about this project that aren't obvious from the code and shouldn't have to be re-explained each
session. Safety rules live in `CLAUDE.md`; reasons for decisions live in `docs/DECISIONS.md`; what changed when lives
in `docs/CHANGES.md`. Add a fact with the date you learned it. Delete it when it stops being true.

## Repo and people

- The repo is `github.com/garyreyes/dlsu-map`, public, default branch `main`. Gary Reyes owns it, so only Gary's
  account can change settings such as branch protection. (2026-10-19)
- `main` is protected by a repository ruleset (id 25407958), on since 2026-10-19: PR required with 0 approvals,
  `gates` required and the branch up to date with `main`, no force-push, no deletion. Without `gh`, a branch is
  pushed from the terminal and the PR is opened and merged on github.com. (2026-10-19)
- Charles's GitHub account is `charlesco-05`, with write access to the repo (can open and merge PRs, not change
  settings). (2026-10-19)
- The required CI check is named **`gates`**. Renaming the job breaks branch protection until the rule is updated
  to match. (2026-10-19)

## Local machine (Windows)

- Node 24 is installed (via winget) but isn't on the Git Bash PATH by default. Prepend it:
  `export PATH="/c/Program Files/nodejs:$PATH"`. PowerShell finds it normally. (2026-10-19)
- The GitHub CLI (`gh` 2.102.0) is installed on Charles's laptop at `C:\Program Files\GitHub CLI\gh.exe`. A Git Bash
  session opened before the install doesn't have it on PATH; use the full path or open a new terminal. Gary's laptop
  has `gh` 2.96.0, signed in as `garyreyes` with admin on the repo. (2026-10-19)
- Git converts line endings (`core.autocrlf`), so "LF will be replaced by CRLF" warnings are expected and harmless.
  (2026-10-19)

## Working on the code

- Setup after cloning: Node 24, then `npm ci` (also installs the Husky hook). `npm run dev` compiles the data,
  then starts Vite.
- **`public/data/*.json` is generated and gitignored.** `npm run compile-data` writes it from `data-src/`; `dev`
  and `build` run it first, so CI fails on any broken data constraint. Never edit it by hand. (2026-10-20)
- Files under `tests/` and `scripts/` (tsconfig.node, `module: nodenext`) import JSON with
  `with { type: 'json' }`; src files don't need it. (2026-10-20)
- Before a PR: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, then `npm run e2e` (it serves the
  build), which are the same commands CI runs.
- **TypeScript (D1):** `@typescript/typescript6@6.0.2` is the package version but it contains compiler 6.0.3; ESLint
  and the editor use it. `@typescript/native` is `typescript@7`, and `npm run typecheck` calls its `tsc` by full
  path. `tsc` 7 runs in build mode (`-b`) over `tsconfig.app.json` (src/) and `tsconfig.node.json` (configs, tests,
  scripts, tools). (2026-10-19)
- **Line endings:** `.gitattributes` forces LF in the working copy on every OS. Without it, Windows checkouts get CRLF
  and `prettier --check` fails locally while passing in Linux CI. (2026-10-19)
- **Layer rules** (`eslint.boundaries.js`) use built-in ESLint rules only. They cover static and dynamic `import()`,
  but not CommonJS `require` or aliasing `window` to a variable before calling `.fetch`; review catches those.
  Feature code lives either at the feature's top level (logic) or under `components/` (UI); any other subfolder is
  treated as logic. (2026-10-19)

## OpenStreetMap data

- **Overpass is unreliable from here:** every public mirror returned 502/504 or timed out on 2026-10-19 and
  2026-10-20. The main API (`api.openstreetmap.org/api/0.6/map.json?bbox=…`) answered in about 3 s with 2.5 MB, so
  `npm run fetch-osm` uses it (D27). It needs a `User-Agent` naming the app. (2026-10-20)
- **An area request cuts relations at its edge.** It returns every way touching the area in full, but a relation
  only with the members that touch it. The campus boundary (relation 11126048) came back with 2 of its 9 ways, so
  the script fetches such relations again with `/relation/<id>/full`. Every building came back complete. (2026-10-20)
- The campus boundary is 9 separate outer rings, plus gates and entrances as points on its ways. Only 2 hold our
  buildings (the main campus; STRC, Andrew and Razon across Taft); the other 7 are small patches (bike parking and
  the like, 42–1,144 m²) that the compiler drops and lists. Miguel Hall (relation 6095002) is a multipolygon with a
  courtyard hole, which `campus.json` can't draw yet (no holes). `type=building` relations (One Archers' Place, a
  hotel) add no shape: their outline and parts are ordinary ways. (2026-10-20)
- Ways come back complete even far outside the area: the LRT line way runs the length of Manila with all its
  stations. The compiler clips to what the scene needs. (2026-10-20)
- **OSM `building:part`s cover only part of a footprint here** (at ground level: Yuchengco 54%, Henry Sy 16%,
  St. La Salle 0%). So the compiler draws a building's outline at its own height *plus* its parts; the usual 3D rule
  "parts replace the outline" would make most of St. La Salle vanish. A few connector parts reach out of their
  building (centre outside it); the compiler gives them to the building holding their corners and says so. (2026-10-20)
- **`campus.json` coordinates: x is meters east, y is meters north** of the origin 120.9932, 14.5647, WGS84 scale
  (`src/shared/geo/project.ts`). `prototypes/map-home/campus.json` is different: y is meters *south* (three.js z)
  and it sits about 21 m west. Never copy coordinates from the prototype. (2026-10-20)
- Node 24 runs `scripts/*.ts` directly (type stripping), so scripts import other `.ts` files with the extension and
  need no build step. `Object.groupBy` isn't available: `tsconfig.node.json` targets ES2023. (2026-10-20)

## Floor photos and extraction

- **Official DLSU floor plans are not guaranteed** (owner, 2026-10-20). The evacuation-map photos are the main source
  for all 10 buildings, through `tools/floor-extract/` (D17, D29).
- **Two map styles on campus.** STRC's signs are green (light-green paper, double black walls, green route). Every other
  building photographed (St. Joseph, Velasco, Miguel, Andrew, Yuchengco) uses a white "EVACUATION MAP" template: thin
  grey single walls, a **red** route, black pillar squares, often under a plastic sleeve with glare. The tool detects
  the style from the paper (`--style` overrides). Thresholds were measured on STRC 4F and St. Joseph 3F. (2026-10-20)
- **Read the corners precisely.** Use `npm run floor-extract -- crop <photo> <x,y>…` and read each corner pillar's
  centre off the grid labels (the crop shifts near the photo's edge, so never work out offsets by hand). On
  St. Joseph 3F, rough corners lost half the partitions; read ones found nearly all. For a building that isn't a
  rectangle, extend the outer walls' lines to make the 4 corners. (2026-10-20)
- What the draft always gets wrong (cleanup, D17): stair and ramp treads read as walls, boxes around exit signs and
  "YOU ARE HERE", some short wall stubs and outer walls missed. 0.4–1.9 s per floor. (2026-10-20)

## Room lists

- **`data-src/rooms/<building>.csv`**, one per building, named by slug. Columns:
  `floor,code,name,floor_label,floor_checked,note`. `floor` is a whole number (G = 1). `code` is typed as printed
  on the lobby directory (`C404/406`, `C-309`); the compiler expands combined entries (`/`, `-` and `&` all
  separate rooms, D18) and makes codes canonical with `parseRoomCode`. `floor_checked` = `yes` lets a room sit
  off number ÷ 100 (D26). `note` records every change from the sign. (2026-10-20)
- Names are typed as printed, with obvious spelling fixed and trailing periods dropped; abbreviations stay
  (`Che`, `CMD`, `BCRU`). (owner, 2026-10-20)
- **STRC's directory has one wrong code:** its 4th-floor "Stock Room · C302" is entered as **C402** (C302 is a 3rd-floor
  lab). And `C102/104-106` is rooms 102, 104 and 106, since C105 is the Mechatronics Lab. Both are the owner's
  calls, 2026-10-20; check the doors when next on site.
- `tsconfig.node.json` maps `@/*` so scripts can typecheck src files that use the alias. Type imports only: Node
  doesn't resolve `@/`, so a value import through it would crash `compile-data` (CI's build step catches
  it). (2026-10-20)

## Cloudflare

- The free Cloudflare account is Gary's, signed in with GitHub. Never upgrade it to Workers Paid (D11).
- `CLOUDFLARE_API_TOKEN` is a user API token made from the **Edit Cloudflare Workers** template, scoped to this one
  account (My Profile → API Tokens). Tokens in the current format start with `cfut_`. Both it and
  `CLOUDFLARE_ACCOUNT_ID` are GitHub Actions secrets only. (2026-10-19)
- Adding a secret on github.com: the token goes in the **Secret** box, not **Name**. A secret whose name looks like
  random characters is a pasted token: delete it and roll the token in Cloudflare. (2026-10-19)
- **Checked live on 2026-10-20** with a throwaway Worker (wrangler 4.147.0, then deleted):
  - `wrangler versions upload` fails on a Worker that doesn't exist yet ("run the `deploy` command first").
  - `wrangler deploy` with `workers_dev: false` creates the Worker with no live URL: "No targets deployed", and
    `<name>.<account>.workers.dev` returns 404 (error 1042). D28 relies on this.
  - With `preview_urls: true`, `versions upload --preview-alias pr-1` gives `https://pr-1-<name>.gary-reyes.workers.dev`.
    Uploading again to the same alias updates that link within about 12 s. Deleting the Worker removes its previews.
  - `public/_headers` is applied on preview links and in `wrangler dev` alike. `/_headers` itself is never served.
  - With `not_found_handling: "single-page-application"`, **any** missing path gets `index.html` with status 200,
    including `/data/missing.json` fetched with `Sec-Fetch-Mode: cors`. So `shared/data` must reject a response
    whose content type isn't JSON; `res.ok` alone passes. Same in `wrangler dev`.
- The account's workers.dev subdomain is `gary-reyes`, so preview links contain the owner's name. They are public to
  anyone with the link and carry `noindex` (D19). (2026-10-20)
- On Gary's laptop, `npx playwright install chromium` times out (Playwright's downloader; plain `curl` of the same
  file works). Run the e2e tests on the installed Chrome instead: `PLAYWRIGHT_CHANNEL=chrome npm run e2e`. CI
  downloads its own Chromium. (2026-10-20)

## Tool versions pinned in CI

- `markdownlint-cli2@0.23.3`: an exact-pinned devDependency since 1a, and CI's `npx` step uses the same version. Bump
  both together. Its dependencies carry dev-only `npm audit` warnings (braces, katex, smol-toml); the shipped app has
  none (`npm audit --omit=dev` is clean). (2026-10-19)
- `impeccable@4.6.0` for the design detector, to match the locally installed Impeccable plugin. Bump both together.
  Exit 0 = clean, 2 = findings (fails CI), 1 = couldn't scan. Telemetry is off in CI (`DO_NOT_TRACK=1`).
  (2026-10-19)
- GitHub Actions: `actions/checkout@v7` and `actions/setup-node@v7`, both official. No third-party actions: change
  detection is a short shell step instead of `dorny/paths-filter`. (2026-10-19)
- `wrangler@4.149.0` and `@playwright/test@1.63.0`, exact-pinned devDependencies for 1b. 4.149.0 is the first
  wrangler whose `miniflare` pulls `sharp@0.35.5`; 4.147.0/4.148.0 pull `sharp@0.35.4`, which has a high-severity
  librsvg advisory (GHSA-wq5f-xc86-pv6w). Don't pin wrangler below 4.149.0. (2026-10-20)
- `motion` stays on major 12 (`^12.43.0`): `react-modal-sheet` 5.6.0 is built and tested against `motion` 12.35
  (its devDependency), and `motion` 14 only came out on 2026-10-02. Move to 14 only with a `react-modal-sheet`
  release that supports it, checked on a phone. (2026-10-20)

## Docs

- `docs/HANDOVER.md` is frozen history and is excluded from markdown lint. Don't reformat it. (2026-10-19)
- The PRD's use-case labels (`**UC2. …**`) are bold text, not headings, on purpose; lint rule MD036 is off for that.
  (2026-10-19)
