# CLAUDE.md

Context and safety rules for Claude Code (and any other AI assistant) working in this repo. These rules bind every
session and every tool, including ones that never load a skill.

## What this is

DLSU 3D Campus Navigator: a free, offline-first 3D map of De La Salle University (Manila) that routes students to
any room. Phone-browser PWA for iPhone and Android. Student project, not an official DLSU app.

**Status:** plan approved by the team on 2026-10-19 (D15–D24 agreed). Build follows `docs/ROADMAP.md`, one
sub-phase at a time, starting with 1a, in the lanes of `docs/SPLIT.md`. The folder structure is in
`docs/ARCHITECTURE.md` §7. `prototypes/map-home/` is a design reference, not app code to copy.

## Read these first, in this order

| # | File | What it is |
|---|---|---|
| 1 | `SUMMARY.md` | The whole project on one page |
| 2 | `docs/PRD.md` | Who it's for, use cases, scope, success metrics (draft) |
| 3 | `docs/ARCHITECTURE.md` | **The** stack, entities, layer rules, folders. Wins over `docs/PLAN.md` §1 |
| 4 | `docs/user-flows.md` | Every screen, transition and empty/loading/error state. Wins over `docs/PLAN.md` §6 |
| 5 | `docs/PROJECT_FACTS.md` | Durable facts about tools, repo and data that aren't obvious from the code |
| 6 | `docs/DECISIONS.md` | Every decision (D1 onward) with its evidence. Newest last |
| 7 | `docs/ROADMAP.md` | The build queue: sub-phases with status. Work on one sub-phase at a time |
| 8 | `docs/SPLIT.md` | Who owns which lane and folders, and how the two lanes meet |
| 9 | `docs/PLAN.md` | Rendering and data-pipeline detail. Partly history now |
| — | `docs/PRODUCT.md` | The PRD translated for Impeccable (design work). The PRD wins where they differ |
| — | `docs/CHANGES.md` | Dated log of what changed. Search it; don't read it all |
| — | `docs/HANDOVER.md` | The original brief, frozen for history. Everything above wins |

## The product, v1 (PRD + ARCHITECTURE, drafts)

- The student types a room code in **To**, sets **From** by tapping the map (building → floor → spot, or a gate), and
  gets a route: across campus to the right entrance, then inside floor by floor. Next/Back steps.
- v1 includes full interiors for 10 buildings (D15, D20). GPS follow mode (D14) moved to later, not v1.
- Fully offline after first open (D10). No backend: static files plus a compiled data bundle.

## Ground rules from the decisions

- Zero cost, no credit card on any service (D11). No backend, accounts, analytics or cloud AI.
- Location never leaves the phone and is never stored. v1 doesn't ask for location at all.
- Never route on a silent guess: everything goes through the From → To confirm screen. Unknown room codes are
  rejected with "Did you mean…" (strict, PRD §7).
- Room prefixes come from the table in `docs/ARCHITECTURE.md` §3.3. Example codes in `PLAN.md` and `HANDOVER.md`
  (`B305`, `G304`) predate it and are not real.
- No third-party requests at runtime. Every drei `<Text>` gets a self-hosted font; never use drei
  `<Environment preset>` (both pull from a CDN and break offline use and the CSP, D5).
- Map data is © OpenStreetMap contributors (ODbL); keep the credit.

## Never do these (irreversible or high blast radius)

- **Never commit DLSU photos or licensed images.** `data-src/photos/`, `docs/reference/` and `docs/spikes/*/out/`
  are gitignored. Once pushed to this public repo, removal means a history rewrite and the copies may already be
  cached. Traced floor files *are* committed (accepted risk, D21).
- **Never delete or move `data-src/photos/`.** It is gitignored, so git can't bring it back.
- **Never force-push, rewrite history, or delete branches on `main`.**
- **Never deploy to the production Cloudflare URL or share the beta link publicly** without the owner's explicit
  yes. The beta stays `noindex` with a visible beta label until public launch (D19).
- **Never commit secrets.** The only secrets are `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, and they live
  in GitHub Actions secrets (ARCHITECTURE §8). `.env*` is gitignored.
- **Never weaken a gate to get green:** don't disable a lint rule, add a detector ignore, `--legacy-peer-deps`, or
  skip a CI step without saying so and getting a yes.

## Ask the owner first

- Any change to the CSP or `public/_headers`, or anything that adds a request to another origin.
- Marking a floor `checked: true` (only the owner does this, after the 3D preview, ARCHITECTURE §4).
- Changing a room's canonical code or a building's prefixes. Deep links and shared codes depend on them.
- Adding a dependency outside the ARCHITECTURE §2 stack, or upgrading React past ~19.3 (D3).
- **Merging and pushing:** Claude may merge PRs and push on its own, but must ask in chat first, every time, with a
  short overview: the branch, what changed, the CI status, and the exact command about to run. Wait for a clear yes.

## Security

- There are no accounts or payments, and none are planned (D11). If a task ever seems to need them, **stop and ask**
  instead of building. When they exist: never hand-roll authentication, sessions or cryptography (password hashing,
  JWTs, tokens, resets); never hand-build raw payment or OAuth requests instead of the official SDK; and auth or
  payment SDKs get exactly one wrapper module that features import.
- No database exists, so there is no project ref or migration to guard.

## Layer boundaries (ARCHITECTURE §6)

- **UI** (`features/*/components/*.tsx`): renders and handles taps. No parsing, routing or fetching.
- **Logic** (`features/*/*.ts`): pure functions, unit-tested. No React, no fetch.
- **Data access** (`shared/data/`): the only place that fetches `/data/*.json` and validates it with Zod.
- **App shell** (`src/app/`): thin. URL ↔ state sync and providers only.
- Features import only from `shared/` or another feature's `index.ts`.

## Code shape

- Files: 200–400 lines is normal, 800 is the ceiling. Functions under 50 lines. Nesting at most 4 levels.
- Never mutate React state or props. Return a new object or array.
- **Test first** for anything with one right answer: room-code parsing, floor = number ÷ 100, routing, the data
  compiler's constraints, deep-link resolution. Done means the test was run and seen passing. Layout, copy and
  styling get no tests.

## Gates

One CI job, **`gates`** (`.github/workflows/ci.yml`), runs on every PR and every push to `main`. A ruleset on `main`
(D22, on since 2026-10-19) requires it by that name, so the job must always run and report. Never add `paths-ignore`
to its trigger, and never rename the job without updating the ruleset in the same change.

- **Every PR:** markdown lint (`.markdownlint-cli2.jsonc`). Locally: `npx markdownlint-cli2 "**/*.md"` (add `--fix`
  for blank-line issues); it's a devDependency pinned to the same 0.23.3 as CI.
- **PRs that touch code** (anything not `.md` and not under `docs/`), once `package-lock.json` exists: `npm ci`,
  `npm ls --all` (fails on peer conflicts), `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, then
  the Impeccable design detector on `src/` and `index.html`.
- **The root `package.json` must define `lint`, `typecheck`, `test` and `build`.** CI calls them by name. From 2b,
  `build` runs the data compiler, so a broken data constraint fails CI. `lint` = ESLint, Prettier check and markdown
  lint. `typecheck` = tsc 7 (D1); CI also fails if that binary isn't 7.x.
- **Layer rules are lint rules:** `eslint.boundaries.js` enforces ARCHITECTURE §6, and `tests/boundaries.test.ts`
  proves it. Change both together; never loosen a rule to get a file through without asking.
- **Local hooks:** Husky runs lint-staged on every commit (D2): ESLint + Prettier on staged code, markdownlint on
  staged `.md`. `npm ci` installs the hook. Don't bypass it with `--no-verify`.

## Commits and docs

- Conventional commits: `<type>: <description>`, types `feat` `fix` `refactor` `docs` `test` `chore` `perf` `ci`.
- **`main` is protected:** every change goes through a branch and a PR; `gates` must pass and the branch must be up
  to date with `main`. No direct pushes, force-pushes or deletion. One branch per roadmap sub-phase, named after its
  ID (`3a-room-code-parser`); see `docs/SPLIT.md`.
- A new decision gets the next D-number at the end of `docs/DECISIONS.md`, marked *proposed* until the team
  agrees, then is reflected in `SUMMARY.md` and `docs/PLAN.md`.
- A finished change gets a dated entry in `docs/CHANGES.md`. A durable, non-obvious fact goes in
  `docs/PROJECT_FACTS.md`.
- Plain English, short sentences, wrapped at 120 columns. Feedback and disagreements go in GitHub issues.
