# Session log

## SESSION-001 — Cycle 1

**Result: ACCEPTED (approved).**

The client ran the built app in their browser and confirmed every scenario behaves as
approved, including the make-or-break import and the export round-trip.

### Accepted scenarios (16)
| ID | Title |
|----|-------|
| SCN-001 | Paste a link and it becomes a readable entry |
| SCN-002 | Saving a link already saved does not create a duplicate |
| SCN-003 | Open a saved link to fix its name and summary |
| SCN-004 | Put several labels on one link, reusing existing labels |
| SCN-005 | Pull up every link under a label |
| SCN-006 | Find a link by typing remembered words |
| SCN-007 | Mark links "to read" and check them off |
| SCN-008 | Saving a link whose page can't be read — never lose it |
| SCN-009 | Pasting something that isn't a link |
| SCN-010 | The empty / first-run screen |
| SCN-011 | Delete a link for good (with an undo beat) |
| SCN-012 | Put a link away (hidden but recoverable) |
| SCN-013 | Jot a personal note on a link |
| SCN-014 | Change the order of the list |
| SCN-015 | Bring in my existing bookmarks in one go |
| SCN-016 | Take my whole collection back out |

### Verification
- 28/28 automated tests passing (19 core-logic + 9 behaviour/acceptance): `npm test`
  (or `node tests/run.mjs`) in `implementation/`.
- Visual/interaction scenarios confirmed by the client in-browser during Phase 4.

### Facilitation substitutions / notes
- Title reading uses a third-party read-through proxy in cycle 1 (documented in
  implementation/DESIGN.md); the never-lose-a-link fallback (SCN-008) covers any failure.
  To be replaced by first-party fetching alongside cycle-2 snapshots.

### Firm commitment carried to Cycle 2 (client is counting on this first)
- **Page snapshots** so a saved link survives even if the original site dies, **and PDFs
  kept as the real file** (not a snapshot of a wrapper). See context/deferred-ideas.md #7.

### Other deferred ideas (not forgotten)
- Rename/delete a label everywhere at once; narrow by two labels at once (AND);
  scope search to the current pile; label bar tidiness at scale; phone/mobile access.
  See context/deferred-ideas.md and context/non-functional-backlog.md.
