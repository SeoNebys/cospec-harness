# Verification report — Cycle 1 (Phase 3)

Scope: v1 = SCN-001..016 (SCN-017 is an early follow-up, not built yet).
Run: `node implementation/tests/verify.mjs` (browser: implementation/tests/run.html for logic).

## Result: PASSED
- Internal logic tests: 35/35 ✓
- Gherkin acceptance tests: 49/49 ✓ (every approved scenario's Given/When/Then covered
  at the behaviour level against the real app code)

## Bug found and fixed during verification (Phase 3 -> 2 -> 3)
- SCN-002: `addBookmark`/`updateBookmark` canonicalized each label input but did not
  dedupe WITHIN a single bookmark, so `['recipes','Recipes']` produced two identical
  `Recipes` entries — violating "a label cannot be added twice".
- Fix: added `Store.resolveLabels()` (canonicalize + dedupe); used by add/update.
  Scenario unchanged (correct per process). Re-verified green.

## Verified by code inspection (needs a click-through in the browser to fully confirm)
Behaviour is present and correct in the source but not exercised headlessly:
- SCN-006 click=visit vs pencil=edit
- SCN-009 archived hidden from main list/search unless opt-in
- SCN-011 visit() is a peek (never marks read)
- SCN-012 select mode + bulk-delete confirm dialog
- SCN-013 favicon img + placeholder tile + uniform card height
- SCN-015 empty-state copy, CSS line-clamp, "+N more" reveal

## Explicitly confirmed (client-flagged priority)
- SCN-014 "saving always works": a plain sentence is blocked; a scheme-less link is
  accepted; readPage never throws / always resolves usably; a bookmark saves with a
  blank title and falls back to the address as its name. 5/5 ✓.

## Cycle 2 & 3 additions
- Cycle 2: SCN-017 saved views — built, verified (90 checks total), accepted.
- Cycle 3: SCN-018 keep-a-copy — built, verified (100 checks total: 35 logic + 65 acceptance).
  Ready for client acceptance. Client-only build uses a capture abstraction; real capture
  of arbitrary pages needs the blessed server piece (DD-9). No fabricated copy content.

## Known v1 limitations (by design, on record)
- Real page titles/descriptions/thumbnails need a server-side reader (DD-2); v1
  degrades gracefully (SCN-014).
- Parking lot: P3 keep-a-copy (HIGH, to be scoped), P4 dead-link help, SCN-017 saved views.
