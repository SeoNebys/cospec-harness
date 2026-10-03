# "Manage bookmarks" — areas to explore (Cycle 1, Phase 1)

Requested by the client before approving Phase 2. To be explored one at a time
via prototype + guided confirmation, then turned into approved scenarios.

| # | Area | Exploration status |
|---|------|--------------------|
| A | Permanent delete | approved (SCN-014) |
| B | Archive + Archive view + restore (hidden from normal list & ordinary search) | approved (SCN-015) |
| C | Bulk actions (add/remove tags, mark read/unread, archive, delete) on selected items | approved (SCN-016, SCN-017) |
| C2| Apply an action to all results in the current view/search | approved (SCN-016) |
| D | Sorting (at least: date added, title) | approved (SCN-018) |
| E | Notes with simple formatting, shown formatted when viewed | approved (SCN-019) |
| F | Preserved page copy: self-contained page for normal pages; PDF preserved for PDFs | approved (SCN-020) |
| F2| Option to send a page to the Internet Archive | approved (SCN-021) |
| G | Reusable saved searches (text + include/exclude tags) | approved (SCN-022) |
| H | Import/export standard browser-bookmarks file, keeping titles, tags, original saved dates | approved (SCN-023) |
| I | Display preferences: default sorting, items shown, text size | approved (SCN-024) |

## Notes on honesty / dependencies (for implementation, not client-facing)
- F (self-contained page snapshot, PDF preservation) and F2 (Internet Archive)
  depend on real fetching and an external service; prototype simulates them.
- H import/export uses the standard Netscape bookmarks HTML format.
