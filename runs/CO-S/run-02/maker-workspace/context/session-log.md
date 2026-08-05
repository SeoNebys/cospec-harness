# Session log

## SESSION-001 — Cycle 1 — 2026-07-13

**Goal:** Save a link fast and reliably find it again (see context/goals.md).
**Interface:** Web app (browser). Single user.

### Phase 1 notes
- Goal confirmed WHY-first: the pain is *finding again*, not saving.
- Interaction forks resolved by alternative prototypes:
  - Auto-title timing → "on paste, editable before save" (Version B).
  - Organization model → tags (multi-label) over folders (single-parent).
  - Tag entry → suggestions/reuse over unconstrained freeform.
- Edge cases explored across all four perspectives; dead-link detection and
  large-collection pagination handled (deferred / not-needed respectively).
- Text substitution used (per edge-case.md) for two time/volume edge cases
  (dead links, hundreds of bookmarks) — not reproducible in a prototype.

### Phase 2/3 notes
- Implemented in implementation/ (zero-dependency Node + vanilla-JS web app).
- Pure core (core.js) + title parser (title.js) fully unit/acceptance tested;
  18/18 tests pass. Server serves app + /api/title with graceful failure.
- Traceability: implementation/docs/scenario-code-map.md.

### Accepted scenarios
- SCN-001 Save a link and see it appear in the list — Happy Path
- SCN-002 Page title fetched on paste, editable before saving — Happy Path
- SCN-003 Find a saved link by searching as you type — Happy Path
- SCN-004 Organize with multiple tags and browse by tag — Happy Path
- SCN-005 Assign tags on save with suggestions from existing tags — Happy Path
- SCN-006 First-run / empty state guides the new user — Edge Case
- SCN-007 Save-time error and exception handling — Error Case
- SCN-008 Long text and large tag sets stay tidy — Edge Case
- SCN-009 Large collections handled by search/tags, no pagination — Edge Case

**Cycle:** 1
**Acceptance result:** APPROVED (all 9 scenarios accepted by client)
