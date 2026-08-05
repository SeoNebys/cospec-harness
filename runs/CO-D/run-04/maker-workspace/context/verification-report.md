# Phase 3 — Verification report (Cycle 1, SESSION-001)

Scope: first cycle → verify against all approved scenarios (SCN-001..023).

## Levels run
1. **Internal unit tests** — pure logic per slice. 46 tests, all green.
2. **Integration harness** (`test/verify-integration.test.js`) — the REAL storage
   (db.js) + core/query/porting modules driven together through an in-memory
   IndexedDB, exercising each scenario's Given/When/Then end-to-end (save/dedupe/
   newest-first, edit-in-place, back-door dup, read-later + shelf pools, saved
   copy store/stamp/delete/undo, import dates + skip-dupes + export round-trip,
   saved-view persist+identity, accent-fold search). 8 tests, all green.
   Total: **54 tests green.**
3. **Static wiring audit** — imports resolve to real exports across all modules;
   every element id referenced by handlers exists (HTML or JS templates);
   manifest files present. **Clean.**

## Findings
- **FIXED (integration bug): misleading "Keeping a copy…" on copy-less cards.**
  Cards with no saved copy always showed "Keeping a copy…", which was false for
  imported links, links saved with copies turned off, and pre-feature links.
  Now: a card truly mid-capture shows "Keeping a copy…" (tracked via a
  `capturing` set cleared on completion); otherwise it shows "No saved copy yet"
  with an inline **Keep a copy now** button — which also serves as the rescue
  affordance right on freshly-imported links. Re-verified: tests green.
- Two initial integration-test failures were **test-data/assertion errors, not
  app defects** (getCopy returns null-not-undefined for a missing copy; synthetic
  1970-era seed timestamps made a 2016 import "not oldest"). Assertions corrected;
  app behaviour confirmed right.

## Result
All approved behaviours verified at unit + integration level, with UI wiring
audited. One real defect found and fixed. Ready to propose Phase 4 (acceptance).
