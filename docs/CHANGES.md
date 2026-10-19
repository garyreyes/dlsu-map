# Changes

What changed and when, newest first. One entry per finished change: the date, what changed, and anything a later
session needs to know. Search this file; it isn't required reading (the reading order is in `CLAUDE.md`).

**Archive policy:** once this file passes about 1,000 lines, move the oldest entries into
`docs/CHANGES-archive-<first date>-to-<last date>.md` and keep this file recent.

---

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
