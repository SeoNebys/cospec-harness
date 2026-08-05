# Session log

## SESSION-001 — Cycle 1

### Result
**Accepted (wholehearted).** The client signed off on the built app.

### Accepted scenarios (9)
- SCN-001 Find a saved bookmark back by typing whatever you remember
- SCN-002 See what each item is at a glance, and round up everything of one kind
- SCN-004 Save a new bookmark quickly, in your own words, without duplicates
- SCN-005 Change a saved bookmark after the fact
- SCN-006 Tidy the pile — set aside or delete for good, both undoable
- SCN-007 Empty screens that welcome or reassure, never look like loss
- SCN-008 Saving still works when a page can't be read, and links are required
- SCN-009 Nudge the order of the list, and have it remembered
- SCN-010 A reading pile that keeps itself honest (unread → read state)

Parked (not implemented, by client's choice): SCN-003 (gather by two+ labels at once).

### Defect found at acceptance, fixed within the cycle
- **Persistence:** opened as a double-clicked `file://` page, saved bookmarks did
  not survive a reload (the client's foundational requirement). Fixed by shipping
  a tiny local server + one-double-click launcher (stable `http://localhost`
  origin where storage persists) and a durability self-check that warns rather
  than ever losing data silently. Re-tested by the client: the reopen journey
  held. See implementation/docs/design-decisions.md.

### Notes on scope decisions
- Interface: single-user browser web app, one home, no cross-device sync (per goals.md).
- Auto-fill of title/summary is best-effort today (known sites + graceful
  "type the title" fallback). Client accepted this for now.
- Persistence via localStorage; opening via the launcher is the supported path.
  Requires Node.js on the client machine — client accepted this trade.

### Agreed follow-ups (see context/backlog.md)
- NEXT cycle (committed "next", not "someday"): full "reads the page for you"
  auto-fill for all sites.
- Someday: a way to keep a safe copy / not lose the collection if the laptop dies.
