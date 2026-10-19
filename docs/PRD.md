# DLSU 3D Campus Navigator: Product Requirements (PRD)

> **Status:** draft for review, written 2026-10-19 from a Q&A with the project owner.
> This is the single source of product truth. `docs/PLAN.md` and `docs/DECISIONS.md` describe *how*; where they
> disagree with this file on *what* or *for whom*, this file wins. The disagreements are listed in §10.

Room codes in examples use the **real STRC format** (`C311` = Science & Technology Research Center, 3F), taken from
the STRC lobby directory. Other buildings' prefixes are still unconfirmed.

---

## 1. Problem

Freshmen have about **15 minutes between classes**. They are often already walking to the next class when they
realize they don't remember **which building, and which floor, the room is in**.

Existing maps don't help in that moment:

- They show buildings, not floors or rooms.
- They need signal, and campus Wi-Fi and data are unreliable, especially indoors.
- Room codes don't explain themselves to a new student (what building is `C`?).

## 2. Users

| User | Who | What they need | Status |
|---|---|---|---|
| **Primary: the freshman between classes** | First-year student, walking, one hand on the phone, 15-minute window | The building and floor *now*, then the way there | Confirmed |
| **Secondary: maintainer** | The project team. Photographs lobby directories and evacuation maps, types room lists, traces floors, verifies on site | A fast, checkable way to add and fix building data | **Assumption** |
| **Beta tester** | Blockmates in the private beta | A working app to try, and an easy way to report problems | Confirmed (private beta) |
| *Stakeholder, not a user* | DLSU Facilities | Asked to approve publishing floor plans traced from their evacuation maps | Needed before public launch |

Transferees and visitors will also benefit, but the app is designed for the freshman case first.

## 3. Core use cases

**UC1. "Which building is C311 in?"** (the main one)

1. The student opens the app and types `C311` in **To**.
2. The app immediately shows **"C311 · Surface Physics Lab · STRC 3F"** and highlights the building.
3. If **From** is empty, the app asks "Where are you?" (see UC2) so it can make a route. The building and floor stay
   visible while it asks, which is what makes the 10-second target in §5 possible.

**UC2. Set where you are (From)**

- **Tap on the map:** tap a building, then pick a floor, then optionally a spot (main entrance, elevator, stairs).
  Ground floor defaults to the main entrance; other floors default to the elevator lobby.
- If outside: tap a gate (Gate 1–6, Agno).

**UC3. Follow the route**

1. Tap **Go**.
2. **Outdoor leg:** a route line across campus to the right entrance, with Next/Back steps
   ("Exit STRC by the main entrance", "Cross Agno at the crosswalk").
3. **Indoor leg:** the view switches to the 3D cutaway of the building (roof and upper floors sliced off). Steps go
   floor by floor ("Take the east stairs to 3F", "C311 is on your left").
4. **Stairs / Elevator / Auto** can be changed for this route. Auto takes the elevator for 3+ floors.

**UC4. Install once, use offline**

1. Open the link once with any connection. Everything saves to the phone.
2. A "✓ Ready offline" badge confirms it. Optional: Add to Home Screen.
3. After that, search, routing and 3D work in airplane mode.

**UC5. Maintainer adds a building** (secondary user)

1. Photograph the lobby directory and the evacuation map on every floor.
2. Type the room list (code, name, floor) from the directory.
3. Trace each floor over its photo, aligned to the building's OpenStreetMap outline.
4. Run the data build. It fails on duplicate codes, unreachable rooms or impossible floors.

**UC6. Beta tester reports a problem**

- Through a GitHub issue or the team's group chat. The app itself sends nothing (no backend).

## 4. Out of scope

**Later (not v1, but wanted):**

- Amenities as destinations, including "nearest CR", water, elevators
- Offices (registrar, accounting, faculty rooms)
- Food and hangouts (canteens, library, org rooms)
- Events ("where's the org fair?")
- "My classes": paste a schedule, one-tap route to the next class
- Live GPS for the outdoor leg (D14): "Use my location" in From, and the Waze-style walking avatar

**Never (ruled out by constraints):**

- Accounts, backend, database, analytics, trackers
- Cloud AI or any API key
- App store release, custom domain, paid map services
- Indoor positioning (Wi-Fi or Bluetooth beacons)
- Unity/Godot or native apps

**Dropped:**

- The English/Taglish sentence parser ("nasa C204 ako, papunta C311"). The UI is plain **From** and **To** fields.
  This also drops the optional on-device AI model.

## 5. Success metrics

| Metric | Target | How it's checked |
|---|---|---|
| **Speed** | Building and floor shown **within 10 s** of opening the app, with a room code typed | Timed on a real iPhone and Android phone |
| **Correctness** | **100%** of a test set of rooms (at least 20, spread across buildings) resolve to the correct building and floor | Automated test against the room data, plus a spot check on site |
| **Offline** | After the first open, search and routing work in **airplane mode** on iPhone and Android, and still work **after a week unused** | Manual test before each release |
| **Coverage (public launch gate)** | Every building has its room list **and** 3D interior | The data build prints a coverage table |

No analytics are allowed, so adoption is not measured in-app. Beta feedback comes from testers directly.

## 6. Constraints

- **Zero cost.** Free tiers only, and no credit card on any service, so a limit blocks instead of billing.
- **Phone browser** on iPhone and Android. One web codebase (PWA).
- **Offline after first open.** Nothing calls a server during use.
- **Privacy.** Location never leaves the phone and is never stored.
- **Data rights.** Evacuation-map photos are DLSU's. They are never committed or shipped (`data-src/photos/` is
  gitignored). Publishing traced floor plans needs **Facilities' OK** before the public launch.
- **OpenStreetMap credit** stays on the map (ODbL).
- **No deadline.**

## 7. Edge cases and failure states

**Typing a destination (To)** — the rule is **strict**:

| Typed | What happens |
|---|---|
| `C350` (not in the directory) | Rejected. "C350 isn't in our list. Did you mean C305, C310…?" |
| `C904` (STRC has no 9F) | Rejected, with suggestions |
| `C404` (directory lists `C404/406`) | **Resolves directly.** Every room number is its own room; combined directory entries give each number the same name ("Biology Lab"). Typing `C404/406` is read as `C404` |
| `X305` (unknown prefix) | Rejected. Suggests building names |
| `C-309`, `c309`, `C 309` | Treated as `C309` (format variants, not errors) |
| A code listed twice in the data | **The data build fails.** Fixed before release, never shown to students. Example: the STRC directory lists "Stock Room C302" under 4F; it is stored as **C402** |

**Accepted risk:** lobby directories can be out of date. Room 308 appears on the STRC 3F evacuation map but not in
the directory. Under the strict rule, a real but unlisted room is rejected. Mitigation: compare every directory
against its evacuation maps on site before the public launch.

**Other failures:**

| Situation | What happens |
|---|---|
| Go tapped with **From** empty | The app asks "Where are you?". The destination's building and floor stay visible |
| First open with no signal | "Open this once with internet to save the map" |
| iPhone cleared the app's storage after long disuse | The badge stops saying "Ready offline". It re-downloads next time there's signal |
| 3D fails or is too slow (old phone) | Text-only directions with floor and turn icons |
| A building's interior isn't traced yet (beta only) | Route ends at the entrance with "C311 is on 3F · indoor map coming" |
| An entrance, elevator or stair is unverified | Direction says "(approximate)" until checked on site |
| A map update arrives | "Map updated, reload?" prompt. Never reloads mid-route |

## 8. Priorities (MoSCoW)

| | Features |
|---|---|
| **Must** | **To** field: room code and building name, strict validation, typo-tolerant "Did you mean" · **From** by tapping the map (building → floor → spot, or a gate) · ask "Where are you?" when From is empty · show the room's name and floor from the directory · 3D outdoor campus · outdoor routing with step directions · **full 3D interiors (cutaway) and indoor routing for every building** · Stairs / Elevator / Auto per route · offline after first open · text-only fallback |
| **Should** | Shareable deep links ("meet me at C311") · reduced-motion mode |
| **Could** | Saved avoid-stairs / accessibility mode · search by room name ("Biology Lab") · D-pad explore mode · time-of-day elevator cost · QR stickers (only with Facilities' approval) |
| **Won't (v1)** | Sentence parser and on-device AI model (dropped) · live GPS avatar (later) · everything else in §4 "Later" |

## 9. Release plan

1. **Build** until every building has a room list and a 3D interior.
2. **Private beta** with blockmates. Buildings can go live one at a time here; feedback through issues or chat.
3. **Approach Facilities** once the beta has a working demo *(assumption: timing not confirmed)*.
4. **Public launch** after Facilities' OK and the coverage gate in §5.

## 10. What this changes in the existing docs

These need new entries in `docs/DECISIONS.md` (marked *proposed*) once this PRD is approved:

| Existing | Change | Why |
|---|---|---|
| D12 "campus is closed, outdoor first" | **The campus is accessible** (2026-10-19). Lobby directories are the main source of room codes | The owner can photograph each building |
| PLAN §10 Part A (v1) / Part B (later) | **v1 includes full interiors.** Part A and B both ship before the public launch | Owner's choice: one complete public product |
| D9 sentence parser | **Dropped.** Plain From/To fields | "There's no sentence in the first place" |
| D8 tap flow | Kept, and it is now the only way to set From | Confirmed by the owner |
| D14 live GPS outdoors (proposed) | **Moved to later.** Not in v1 | Owner's choice; tap-only From keeps v1 simpler |
| SUMMARY "Avoid stairs" | Moved to Could | Not a v1 priority. Per-route Elevator still covers it |
| Open question "is ground 1F or level 0?" | **Answered for STRC:** ground is "G" and its rooms are 1xx | STRC directory and evacuation maps |

## 11. Assumptions and open questions

**Assumptions (correct these if wrong):**

- Maintainers (the project team) are a secondary user with their own needs (UC5).
- Facilities is approached once the private beta has a working demo.
- Searching by room *name* is a Could; v1 search is codes and building names.

**Open:** see `docs/ARCHITECTURE.md` §9 (STRC `ST` vs `C`, Connon and Henry Sy prefixes, floor files in a public
repo). Building scope and prefixes are settled in D18 and D20.
