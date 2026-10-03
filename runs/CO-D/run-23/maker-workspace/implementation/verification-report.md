# Cycle 1 verification report

Date: 2026-09-25

## Outcome

All 29 approved scenarios passed. The internal test suite passed 22/22 checks, and live Chromium verification passed against the running application.

## Approved behaviour verified

- Fast save gathers page details and creates immutable readable page captures; real PDF bytes are retained and served with their original filename.
- A valid address is retained with a retry state when retrieval fails; malformed addresses are rejected with a concrete correction example.
- Duplicate recognition covers exact, fragment, and known tracking variants while retaining meaningful query parameters.
- Live, case-insensitive search covers title, description, and full address. Guided exact phrase, excluded-site, and any/all label conditions compose correctly.
- Labels, suggestions, label filtering, Read later, mark read/unread, put-away/restore, edit, live-site opening, and guarded permanent deletion behave as approved.
- The sort menu, compact expandable cards, selection mode, filtered select-all, and all forward/reverse bulk actions behave as approved.
- Browser HTML import previews before changes, retains names/folders/dates, reports unknown dates honestly, merges duplicates without overwriting edits, and rejects invalid files safely.
- Full backup/restore recovered bookmarks, saved captures, saved searches, and settings in a destructive restore drill. Portable browser export omits richer captures as disclosed.
- Saved searches remain live and persist with zero results. Page size, text size, and default order persist; temporary sorting does not alter the default.
- Capture views remain separate from live addresses, and put-away bookmarks remain outside normal search.

## Verification evidence

- `npm test`: 22 passed, 0 failed.
- Live browser flow: save, duplicate return, Read later/read, labels, filtered select-all, reverse bulk reading, guarded import, search refinement, saved search, settings reload, both downloads, edit, put-away, restore, and invalid-address recovery.
- Preservation check: reopened a 142-character saved reading copy and byte-verified a 13,264-byte PDF beginning with the PDF file signature.
- Backup drill: deleted live records, imported the full backup, and recovered all test bookmarks, capture payloads, the saved search, and preferences.
- Browser console: no unexpected page errors in the completed main flows.
