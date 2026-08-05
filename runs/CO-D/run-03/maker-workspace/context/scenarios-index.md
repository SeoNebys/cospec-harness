# Scenario index

| ID | Title | Type | Approval status | Approval session | Cycle |
|----|-------|------|-----------------|------------------|-------|
| SCN-001 | Save a link with automatic capture, then find it again by searching across all its details | Happy Path | approved | SESSION-001 | 1 |
| SCN-002 | Open a saved item to its actual web page | Happy Path | approved | SESSION-001 | 1 |
| SCN-003 | Correct auto-captured details, at save time and later | Happy Path | approved | SESSION-001 | 1 |
| SCN-004 | Re-saving a link already saved takes the client to the existing item | Edge Case | approved | SESSION-001 | 1 |
| SCN-005 | Correct the web address in the same inline editor | Happy Path | approved | SESSION-001 | 1 |
| SCN-006 | Delete a bookmark immediately, with an Undo safety net | Happy Path | approved | SESSION-001 | 1 |
| SCN-007 | Label bookmarks in the client's own words and group/find by label | Happy Path | approved | SESSION-001 | 1 |
| SCN-008 | Archive a bookmark (tuck away but keep) vs delete-forever | Happy Path | approved | SESSION-001 | 1 |
| SCN-009 | Optionally pull fresh info when the address is changed to a different page | Edge Case | approved | SESSION-001 | 1 |
| SCN-010 | Mark a bookmark "to read", view the to-read pile, and check it off as read | Happy Path | approved | SESSION-001 | 1 |
| SCN-011 | First-run empty state welcomes the client and shows what to do | Edge Case | approved | SESSION-001 | 1 |
| SCN-012 | When auto-capture fails, save the link anyway and let the client fill in details | Error Case | approved | SESSION-001 | 1 |
| SCN-013 | Gently reject input that is not a web address | Error Case | approved | SESSION-001 | 1 |
| SCN-014 | When a saved page is no longer available, do not dead-end the client | Edge Case | approved | SESSION-001 | 1 |
| SCN-015 | Keep a readable saved copy of the page content so the content survives if the original dies | Happy Path | approved | SESSION-001 | 1 |
| SCN-016 | Search ranks title/summary hits above body-only hits, and copes with several half-remembered words | Happy Path | approved | SESSION-001 | 1 |
| SCN-017 | Deliberate-search moves: exact phrase (quotes), either-word (or), and exclude-word — without disturbing the simple default | Happy Path | approved | SESSION-001 | 1 |
| SCN-018 | Search operates within the current scope (active label group or to-read pile), not always the whole collection | Happy Path | approved | SESSION-001 | 1 |
| SCN-019 | Save a search-and-scope combination and return to it later | Happy Path | pending (next cycle) | — | — |
| SCN-020 | Import existing bookmarks from the browser in bulk; export everything back out | Happy Path | approved | SESSION-001 | 1 |
| SCN-021 | Choose the list order (e.g. newest first, by name) | Happy Path | pending (next cycle) | — | — |
| SCN-022 | Select several bookmarks and act on them together (batch archive, label, etc.) | Happy Path | pending (next cycle) | — | — |
| SCN-023 | Double-click launch on the client's Windows computer, no setup, everything stays local | Happy Path | deferred to Path B (delivery channel needed) | — | 1 |

## Delivery status (cycle 1) — see context/session-log.md

**Accepted & live in Path A** (single-file browser app, `prototypes/MyBookmarks.html`):
SCN-002, 003, 004, 005, 006, 007, 008, 010, 011, 013, 016, 017, 018, 020, and
SCN-001's save-and-find (without auto-capture). Empty-state (SCN-011) enhanced
with a backup-restore lifeline; a visible "last backup" status added.

**Deferred to Path B** (full installed program — awaits a file-transfer channel):
SCN-015 (saved copies — headline), SCN-014 (dead-link honesty), SCN-001
auto-capture, SCN-009 (re-fetch), SCN-012 (capture-failure), SCN-023 (double-click
install). Path A data carries into Path B via the shared Export/Import file.

**Deferred to a later cycle:** SCN-019 (saved searches), SCN-021 (ordering),
SCN-022 (batch actions).
