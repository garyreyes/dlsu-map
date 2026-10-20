# Changes

What changed and when, newest first. One entry per finished change: the date, what changed, and anything a later
session needs to know. Search this file; it isn't required reading (the reading order is in `CLAUDE.md`).

**Archive policy:** once this file passes about 1,000 lines, move the oldest entries into
`docs/CHANGES-archive-<first date>-to-<last date>.md` and keep this file recent.

---

## 2026-10-19: 1a project scaffold

- Vite 8 + React 19.3.1 (`~19.3.1`, D3) + TypeScript per D1, with skeleton-only dependencies: each later sub-phase
  adds what it uses in its own PR (decided in 1a). `npm ls --all` is clean.
- Scripts CI calls: `lint` (ESLint 10 `strictTypeChecked` + react-hooks, Prettier check, markdownlint), `typecheck`
  (tsc 7 by full path; new CI step fails unless it's 7.x), `test` (Vitest), `build` (`vite build`; the data compiler
  joins in 2b).
- ARCHITECTURE §6 layer rules are now lint errors (`eslint.boundaries.js`, built-in rules only, decided in 1a), proven
  by 50 cases in `tests/boundaries.test.ts`. A reviewer pass found gaps (dynamic `import()`, the app shell, other
  feature subfolders, `..` inside `@/` paths, WebSocket/EventSource/sendBeacon); all closed with tests.
- The ARCHITECTURE §7 folder tree (`.gitkeep` placeholders), a placeholder page with `noindex`, Husky + lint-staged,
  Dependabot's npm block, `.gitattributes` (LF everywhere), `.vscode/settings.json` (workspace TypeScript, D1).
- D1 corrected: `@typescript/typescript6` stops at 6.0.2 (it contains compiler 6.0.3), so `^6.0.3` couldn't install.

## 2026-10-19: Gate 0 done (gh, Cloudflare)

- `gh` checked on Gary's laptop (2.96.0, signed in, admin on the repo).
- Free Cloudflare account created. `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` saved as GitHub Actions
  secrets. The first try put the token in the secret's name field; that secret was deleted and the token rolled.
- The token is only proven by the first deploy in 1b. Next: 1a scaffold (Lane A).

## 2026-10-19: Plan approved (Gate 0)

- The team approved the plan. D15–D24 are now *agreed* in `docs/DECISIONS.md`; D14 (GPS) stays proposed because
  GPS moved out of v1.
- The lanes in `docs/SPLIT.md` are agreed: Lane A Gary, Lane B Charles.
- `CLAUDE.md` status now says the build follows `docs/ROADMAP.md` from 1a. `docs/PLAN.md` got a status note pointing
  to the current docs; `SUMMARY.md` was rewritten in the entry below (PR #4).
- GitHub CLI installed on Charles's laptop. Gate 0 still open: `gh` on Gary's laptop, the Cloudflare account and
  secrets.

## 2026-10-19: SUMMARY and README brought up to date

- `SUMMARY.md` rewritten to match the PRD, ARCHITECTURE and D15–D24: v1 includes 10 full interiors, plain From / To
  fields (no sentence parser), no GPS in v1, real room-code formats (`ST311`, `AG1104`) instead of `B305`/`G304`, the
  Google-Maps-style interface and black map ground, the 11-phase roadmap and the two lanes.
- `README.md`: status, a reading order that includes the PRD, ARCHITECTURE, user flows, roadmap and split, and a short
  contributing note about the protected `main`.

## 2026-10-19: Roadmap and work split

- Added `docs/ROADMAP.md`: ARCHITECTURE §10's 11 phases split into 38 sub-phases with a lane, dependencies and
  status each, plus Gate 0 and the Impeccable cadence. Two reorders from `docs/user-flows.md` §8: the steps list
  before the 3D player (5c), and the floor builder moved up to Phase 6 (6c).
- Added `docs/SPLIT.md`: two lanes (A: platform, screens, 3D; B: data, logic, campus), folder ownership, the five
  points where the lanes meet, the order of work side by side, and working rules. Lane names are proposed.
- Branch protection is on (ruleset on `main`), earlier than D22 planned. `CLAUDE.md`, D22 and
  `docs/PROJECT_FACTS.md` updated to match.

## 2026-10-19: Prototype feedback, round 1 (owner tested on a phone)

- Green fog: the distance and sky fade into a soft green in every map palette.
- Every off-campus building is see-through (35%), replacing "see-through only while blocking". Only campus buildings
  can now hide the selection.
- Rotating on a phone: the map library only rotated when two fingers slid sideways together. A two-finger twist now
  turns the map with the fingers, like Google Maps (checked with a simulated twist: 60° in, 59.9° turned). A compass
  button appears while the map is turned and turns it back.
- `docs/DESIGN.md` updated (map depth, compass, gestures). No new finish review: these are owner-directed refinements.
- Owner confirmed all three on a real phone. Then asked for a black ground like Waze's dark mode: palette A is now
  near-black (#121614) with soft grey paths and a dark green haze, replacing D13's orange. Green and grey stay in
  the switcher for comparison. Recorded in `docs/PRODUCT.md` and `docs/DESIGN.md`.

## 2026-10-19: Design direction and map home prototype

- The owner pinned the direction: the Google Maps interface convention (quality bar Google Maps, Apple Maps, Waze)
  over the D13 massing-model map, with a fixed green interface colour. Impeccable's random direction pick was skipped
  because the direction was pinned; recorded in the surface brief.
- Added `prototypes/map-home/`: a phone-testable prototype of S1–S5 (search, room card, Where are you, route
  summary) on the real campus from an OpenStreetMap snapshot (2026-10-19). Signature move: the found room's floor
  drawn as a green band one storey tall, with a floor chip. Only ST311, ST402, ST404 and ST406 are real rooms.
  Not app code: three.js loads from a CDN here, which the real app must not do.
- Finish review took four rounds (8 fixes, then 3 and 2 regressions); final disposition **ship** for the scored
  fixes. Not reviewed: motion (every capture had reduced motion on), a night map, label style.
- Added `docs/DESIGN.md` and `.impeccable/design.json` (written from the built prototype), the surface brief in
  `.impeccable/surfaces/`, and two detector ignores for confirmed false positives in `.impeccable/config.json`.
- `docs/PRODUCT.md` gained two owner commitments: the Google Maps convention and the green interface.
- Published privately: <https://claude.ai/artifact/VXTeRoikyZv1bwGHotiSPo>.

## 2026-10-19: Product context for design (`/impeccable init`)

- Added `docs/PRODUCT.md`, translated from the PRD. Impeccable finds it in `docs/`, so the root stays clean. No
  Stack section (ARCHITECTURE owns it).
- New facts from init: platform `web`; the app's own words are plain English; "DLSU 3D Campus Navigator" is a
  working name; no DLSU seal, logo or official marks anywhere.
- D13's massing-model look is recorded as a decided commitment; the palette stays open for the design step.

## 2026-10-19: User flows mapped

- Added `docs/user-flows.md`: 11 screens, 6 system states and 1 dev-only page. Each screen has its one primary
  action, its transitions and its empty, loading and error states, with Mermaid diagrams for the branching flows.
- New proposed decisions: D23 (From can be typed as a room code) and D24 (beta reports via a pre-filled Google Form,
  never including From). The PRD's UC1, UC2, UC6 and the §8 Must row were updated to match.
- `CLAUDE.md` reading order now includes `docs/user-flows.md`. It supersedes `docs/PLAN.md` §6.2.

## 2026-10-19: Harness setup (CI gate, safety rules, project docs)

- Added `.github/workflows/ci.yml`: one job, `gates`, on every PR and every push to `main`. Markdown lint always runs.
  Lint, type-check, test, build and the Impeccable design detector run only when code changed and
  `package-lock.json` exists, so today only markdown lint runs (D22).
- Added `.markdownlint-cli2.jsonc` (120-column wrap; `HANDOVER.md` is frozen and excluded) and fixed the existing
  docs to pass it. The fixes are only code-fence languages, blank lines, and one wrapped line. No content changed.
- Added `.github/dependabot.yml` for GitHub Actions. The npm block is written but commented out until Phase 1.
- Rewrote `CLAUDE.md`: reading order, never-do list, ask-first list, merge/push rule, security, layer rules, gates.
  It now points at PRD and ARCHITECTURE for the v1 scope (GPS moved to later) and the real prefix table.
- Added this file and `docs/PROJECT_FACTS.md`.
- Verified locally: actionlint passes on the workflow; the change-detection rule classifies 10 sample cases
  correctly; a deliberately broken doc fails markdown lint (exit 1); a sample page with gradient text and a purple
  glow fails the detector (exit 2, 7 findings).
- First CI run on GitHub passed (PR #2). Merged to `main` as a fast-forward.
- **Deferred:** branch protection on `main` moves to the start of Phase 1 (D22). It needs the repo owner's account.
