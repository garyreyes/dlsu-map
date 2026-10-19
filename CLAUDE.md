# CLAUDE.md

Context for Claude Code (and any other AI assistant) working in this repo.

## What this is

DLSU 3D Campus Navigator: a free, offline-first 3D map of De La Salle University (Manila) that routes students to
any room. Phone-browser PWA for iPhone and Android. Student project, not an official DLSU app.

**Status:** planning only. There is no app code yet. Don't scaffold or write app code until the team approves the
plan (PLAN.md §11 lists what's pending, including the folder structure in §8).

## Read before answering or changing anything

1. `SUMMARY.md`: the whole project on one page.
2. `docs/PLAN.md`: stack, data pipeline, rendering, UX, phases.
3. `docs/DECISIONS.md`: decisions D1–D14 with evidence. Newest last.
4. `docs/HANDOVER.md`: the original brief, kept for history. PLAN.md wins where they differ.

## The product in two legs (D14, proposed 2026-10-19)

- **Outdoor leg (where you are → building entrance):** live GPS follow mode. An original walking avatar moves along
  the route, Waze-style, snapped to the route line. GPS works without internet. Falls back to Next/Back step mode
  when GPS is weak, denied or off.
- **Indoor leg (entrance → room, Part B):** a "mall directory" cutaway. The user taps "You are here". No indoor
  positioning.
- The split is outdoor vs indoor, not online vs offline. The app stays fully offline after first open (D10).

## Ground rules from the decisions

- Zero cost, no credit card on any service (D11). No backend, accounts, analytics or cloud AI.
- Location never leaves the phone and is never stored.
- Never route on a silent guess: everything goes through the From → To confirm screen.
- Room codes in examples (`B305` = Andrew, `G304` = Gokongwei) are placeholders until official prefixes are
  confirmed. Don't treat them as real.
- Evacuation-map photos and licensed reference images are never committed (`.gitignore`).
- Map data is © OpenStreetMap contributors (ODbL); keep the credit.

## Working on the docs

- A new decision gets the next D-number at the end of `docs/DECISIONS.md`, marked *proposed* until the team agrees,
  then is reflected in `SUMMARY.md` and `docs/PLAN.md` (§0 table, phases, open items).
- Plain English, short sentences. Feedback and disagreements go in GitHub issues.
