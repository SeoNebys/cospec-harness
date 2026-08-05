---
name: bookmarks-path-a-b
description: Bookmarks app shipped as Path A (browser file) now; Path B (installed app with saved copies) is the deferred goal
metadata: 
  node_type: memory
  type: project
  originSessionId: c135e18c-9638-4938-8e2e-839a008d53d4
---

The bookmark manager (cycle 1) shipped in two paths after delivery couldn't get a
real program onto the client's machine (see [[delivery-channel-constraint]]):

- **Path A — accepted & live:** `prototypes/MyBookmarks.html`, a single-file
  browser app. Data in IndexedDB; real Import (browser bookmarks HTML + own JSON)
  and Export backup. Delivers the core: one-paste save, own-words labels, ranked
  search with phrase/either/not operators + scoped search, to-read pile, archive,
  edit, delete, honest move-in with dates + folders-as-labels. Its Export file is
  the real, portable home of the data (browser storage is fragile).

- **Path B — the goal, deferred:** the full Node backend + browser front-end in
  `implementation/` (built, tested, works — real auto-capture + saved copies
  verified). Adds the headline missing feature: **saved readable page copies**,
  and with them searching inside page content and honest dead-link flags. Blocked
  ONLY on a file-transfer channel to the client's machine.

**Bridge:** Path A and Path B speak the same Export/Import JSON, so the client's
pile carries over losslessly when Path B is deliverable.

**Also deferred to a later cycle:** saved searches (SCN-019), list ordering
(SCN-021), batch actions (SCN-022). Full record: `context/session-log.md`.
