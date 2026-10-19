# Changes

What changed and when, newest first. One entry per finished change: the date, what changed, and anything a later
session needs to know. Search this file; it isn't required reading (the reading order is in `CLAUDE.md`).

**Archive policy:** once this file passes about 1,000 lines, move the oldest entries into
`docs/CHANGES-archive-<first date>-to-<last date>.md` and keep this file recent.

---

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
