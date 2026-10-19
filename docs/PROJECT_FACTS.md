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

## Cloudflare

- The free Cloudflare account is Gary's, signed in with GitHub. Never upgrade it to Workers Paid (D11).
- `CLOUDFLARE_API_TOKEN` is a user API token made from the **Edit Cloudflare Workers** template, scoped to this one
  account (My Profile → API Tokens). Tokens in the current format start with `cfut_`. Both it and
  `CLOUDFLARE_ACCOUNT_ID` are GitHub Actions secrets only. (2026-10-19)
- Adding a secret on github.com: the token goes in the **Secret** box, not **Name**. A secret whose name looks like
  random characters is a pasted token: delete it and roll the token in Cloudflare. (2026-10-19)

## Tool versions pinned in CI

- `markdownlint-cli2@0.23.3`, run through `npx` until Phase 1 adds it as a devDependency. Use the same version
  locally so local and CI results match. (2026-10-19)
- `impeccable@4.6.0` for the design detector, to match the locally installed Impeccable plugin. Bump both together.
  Exit 0 = clean, 2 = findings (fails CI), 1 = couldn't scan. Telemetry is off in CI (`DO_NOT_TRACK=1`).
  (2026-10-19)
- GitHub Actions: `actions/checkout@v7` and `actions/setup-node@v7`, both official. No third-party actions: change
  detection is a short shell step instead of `dorny/paths-filter`. (2026-10-19)

## Docs

- `docs/HANDOVER.md` is frozen history and is excluded from markdown lint. Don't reformat it. (2026-10-19)
- The PRD's use-case labels (`**UC2. …**`) are bold text, not headings, on purpose; lint rule MD036 is off for that.
  (2026-10-19)
