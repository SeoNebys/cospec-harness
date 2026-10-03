# Phase 1 exploration backlog (cycle 1)

Additional behaviours the client wants explored and approved *before* Phase 2.
Raised in SESSION-001 after the first Phase-2 proposal was declined. We work
through these one block at a time, prototype-first, deriving scenarios as each is
approved. Not yet approved — none of these may be implemented yet.

| ID | Area | Summary | Status |
|----|------|---------|--------|
| EB-01 | Editing | Edit the address, tags, and a **personal note** (separate from the page's description), with simple formatting that renders properly when viewed | settled → SCN-013, SCN-003 |
| EB-02 | Navigation | Click a bookmark to open the original page; click a tag to filter the collection by that tag | settled → SCN-014 |
| EB-03 | Sorting | Sort by date added, title, etc. | settled → SCN-015 |
| EB-04 | Bulk actions | Select several bookmarks — or all in the current search/view — then add/remove tags, mark read/unread, archive, or delete together | settled → SCN-016 |
| EB-05 | Saved searches | Save a useful search (including/excluding tags) for reuse | settled → SCN-017 |
| EB-06 | Page copy / snapshot | Keep a saved copy of the page in case the original disappears; keep the PDF for PDFs; optionally save to the Internet Archive | settled → SCN-018 |
| EB-07 | Import / export | Import existing browser bookmarks and export them, preserving titles, tags, and original saved dates | settled → SCN-019 |
| EB-08 | Preferences | Personal display choices: default sorting, how many items are shown, text size | settled → SCN-020 |

## Notes
- EB-06 and EB-07 touch external services / real file handling; the prototype can
  only simulate these. Feasibility and honesty about what can actually be done to
  be flagged during their exploration.
- EB-08 "text size" is partly a display preference (relates to non-functional
  backlog); "default sorting" and "items shown" depend on EB-03 sorting.
- The note-vs-description separation in EB-01 supersedes the earlier assumption
  (SCN-001/003) that the description field doubled as the personal note.
