# Exploration backlog (Cycle 1, Phase 1)

Additional behaviour areas the client wants settled before the real build.
Explored one at a time via prototype + guided confirmation. Not "later cycle"
items — these are in scope for the current cycle's requirement exploration.

| # | Area | Status |
|---|------|--------|
| E-1 | Click a label to filter the list to that label | approved (SCN-015) |
| E-2 | Select several links and act on them together (add/remove labels, mark read/unread, archive, delete); also apply an action to every result in the current search/view | approved (SCN-016) |
| E-3 | Archive separate from "Finished": archived links are hidden from the normal list and searches, live in an Archived view, and can be restored; Delete is permanent removal | approved (SCN-017) |
| E-4 | Save useful searches (including labels to include/exclude) as reusable collections | approved (SCN-018) |
| E-5 | Notes support simple formatting, displayed properly | approved (SCN-019) |
| E-6 | Preserve a viewable copy of a saved page; retain the PDF itself for PDFs; optional save via the Internet Archive | approved (SCN-020) |
| E-7 | Import existing browser bookmarks and export in the usual bookmark HTML format, preserving titles, labels, and dates where possible | approved (SCN-021) |
| E-8 | Display preferences: font size and how many items are shown, alongside remembered sort order | approved (SCN-022) |

## Notes on external dependencies (to be honest about during exploration)
- E-6 (viewable copy / Internet Archive): capturing a page copy and Internet Archive
  submission depend on network/external services. In prototypes these are simulated to
  settle the *behaviour*; real capability and its limits are a build-time concern.
- E-7 (import/export): the standard Netscape bookmark HTML format is the interchange
  target.
