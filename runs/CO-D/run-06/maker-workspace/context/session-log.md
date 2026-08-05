# Session log

## SESSION-001 — Cycle 1

- Cycle: 1
- Interface: web app (desktop browser), single user, local storage.
- Phases: Phase 1 (facilitation) → Phase 2 (development) → Phase 3 (verification)
  → Phase 4 (acceptance). Phase 2 entered on explicit client approval; Phase 4 acceptance
  done via guided confirmation in the built app.

### Acceptance result: APPROVED
Client formally accepted version one after a guided walkthrough of all behaviours,
including a hands-on pass over the six interaction behaviours that couldn't be tested
headlessly (peek-not-read, set-aside opt-in search, guarded bulk delete, click-vs-pencil,
visuals/placeholder, empty/clamp). Client quote: "I formally accept version one. Cycle 1
is done, and I'm genuinely happy with it."

### Accepted scenarios (built in v1)
SCN-001, SCN-002, SCN-003, SCN-004, SCN-005, SCN-006, SCN-007, SCN-008, SCN-009,
SCN-010, SCN-011, SCN-012, SCN-013, SCN-014, SCN-015, SCN-016.

### Approved but not yet built at acceptance
- SCN-017 (saved views) — scheduled as the immediate follow-up (now Cycle 2).

### Notes / carried forward
- Verification found & fixed one bug (label dedupe within a bookmark, SCN-002).
- Parking lot: P3 keep-a-copy of the page (HIGH — client's most-anticipated next thing),
  P4 dead-link help (behaviour (c)).
- Known limitation: real title/description/thumbnail auto-fill needs a server-side reader.

---

## SESSION-001 (cont.) — Cycle 2: SCN-017 saved views
- Goal: build SCN-017 (saved views), already approved in Cycle 1.
- Facilitation (Phase 1) already complete (approved via prototype p19); implemented in
  Phase 2, verified in Phase 3 (90 checks total: 35 logic + 55 acceptance, all green).
- Acceptance result: APPROVED. Client confirmed a saved view restores the full filter
  including the search word, applies live, and removes cleanly. Quote: "Cycle 2, saved
  views, accepted."
- Accepted scenario: SCN-017.

## SESSION-001 (cont.) — Cycle 3: keep-a-copy (P3) — OPENING (Phase 1 scoping)
- Client's most-anticipated feature: the app keeps its own copy of a page so the saved
  content survives even if the site dies ("so the stuff I save is mine").
- Client asked to open it honestly — scope how much of "save a real copy" is feasible
  for a first pass rather than over-promise. Facilitation with feasibility leveling +
  comparison prototypes (p20 fidelity flavours, p21 whole flow).
- Direction settled & experience approved: readable copy (A) is "mine"; captured
  automatically/quietly at save for everything; searchable with a "why matched" snippet;
  view any time; honest "no copy" marker + archive fallback (C) when uncapturable; note
  always kept. B (pixel) and P4 (dead-detect) deferred. Client blessed a back end.
- Built (Phase 2) behind a capture abstraction; verified (Phase 3): 100 checks total
  (35 logic + 65 acceptance), all green.
- Acceptance result: APPROVED. Client understands real capture lights up when the server
  piece is deployed; experience stays identical. Quote: "Cycle 3 accepted… This is the
  app I set out to build."
- Accepted scenario: SCN-018.
- NEW roadmap item from acceptance: P5 — backfill copies for already-saved bookmarks when
  the server goes live (not just new saves). Client-flagged as important.

## Status after Cycle 3
- Idle. Scenarios SCN-001..018 all accepted across Cycles 1–3.
- Honest roadmap (all deferred, on record): stand up the server piece (lights up real
  page-capture AND real auto-fill titles/thumbnails together) → then P5 backfill,
  P4 dead-link help, B pixel snapshot.
