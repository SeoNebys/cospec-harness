# Session log

## SESSION-001 — Cycle 1

### Outcome: PARTIALLY APPROVED — accepted as delivered (Path A), remainder deferred to Path B by the client's informed agreement.

The client accepted a delivered interim ("Path A") and knowingly deferred the
capture/copy features and the installed-program delivery ("Path B").

### Why two paths
The full app (Node backend + browser front-end) was built, tested, and verified
to work (real auto-capture and saved copies confirmed against a live site). But
it could not be delivered to the client's machine: the only channel that reaches
the client is small HTML files that render in-tool (the `prototypes/` bundle);
downloads, large files, binaries, and hosted links all failed to cross. See
[[delivery-channel-constraint]].

Rather than stay stuck at the doorway, we agreed a fork:
- **Path A (accepted, live):** a single self-contained HTML app
  (`prototypes/MyBookmarks.html`) that reaches the client the same way the demos
  do. Real app: stores data in the browser (IndexedDB), imports the browser
  bookmarks file, real Export/Import backup. The client moved in, poured in their
  real pile, and watched a backup rebuild the whole collection from scratch.
- **Path B (goal, deferred):** the full installed program with saved page copies.
  Blocked only on a real file-transfer channel onto the client's machine.

### Accepted in Path A (delivered + confirmed by the client)
SCN-002 (open to live page), SCN-003 (edit at save/later), SCN-004 (dedupe),
SCN-005 (edit address), SCN-006 (delete + undo), SCN-007 (own-words labels +
grouping), SCN-008 (archive vs delete), SCN-010 (to-read pile), SCN-011 (empty
state — enhanced with a reassuring "your bookmarks aren't showing / Import your
backup" lifeline), SCN-013 (reject non-links), SCN-016 (ranking + loose
multi-word), SCN-017 (phrase/either/exclude/literal), SCN-018 (scoped search),
SCN-020 (import with dates + folders-as-labels + dedupe; full Export/Import
backup). Plus SCN-001's save-and-find (minus auto-capture).

Two safety refinements added at acceptance and accepted:
- Visible "Last backup: …" status (amber after a week; click to back up).
- Empty screen never reads as a fresh start — always shows the Import-your-backup
  lifeline (because a true wipe can erase the evidence that data existed).

### Deferred to Path B (client at peace with waiting) — the honest casualties
- **SCN-015 saved readable copies** (the headline reason for Path B), and with it
  **searching inside page content** and **SCN-014 honest dead-link flags**.
- **SCN-001 automatic capture** of title/image/summary for newly pasted links
  (Path A guesses a title from the address and drops into edit).
- **SCN-009 deliberate re-fetch** (needs capture).
- **SCN-012** capture-failure handling (moot without capture; "needs a title"
  flow is present).
- **SCN-023** the double-click installed Windows program (Path A is the
  browser-file delivery; the installed program awaits a transfer channel).

### Deferred to a later cycle (pre-existing "now I'd live in it" wishes)
SCN-019 saved searches, SCN-021 list ordering options, SCN-022 batch actions.

### Key learning
Delivery/launch is a first-class requirement and must be elicited in Phase 1, not
assumed in Phase 2. We discovered the client's environment only after building.
See [[delivery-channel-constraint]] and [[bookmarks-path-a-b]].
