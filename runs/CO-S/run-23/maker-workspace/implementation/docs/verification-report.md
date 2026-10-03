# Verification report — Cycle 1

Status: Passed

## Automated runs

- `npm test`: 6 test groups passed, 0 failed.
- Browser acceptance test completed the daily workflow in Chromium against an isolated persistent database.
- Production entry point returned HTTP 200 and reached `data-harness-ready="true"` without console or page errors at 1440×1000 and 390×844.

## Approved-scenario evidence

| Scenario | Result | Evidence |
|---|---|---|
| SCN-001 | Pass | Browser saved a page and rendered collected title, description, source, and saved time. |
| SCN-002 | Pass | Browser and API matched an uppercase query against lowercase saved text. |
| SCN-003 | Pass | Browser assigned tags through editing, filtered through a tag button, and restored the collection. |
| SCN-004 | Pass | Browser added a bookmark to read later, opened the separate view, marked it read, and retained it in all bookmarks. |
| SCN-005 | Pass | Browser and API rejected an exact repeat and returned the existing bookmark. |
| SCN-006 | Pass | Browser edited the existing title and tags in place without changing the item count. |
| SCN-007 | Pass | Browser required confirmation and removed only the selected bookmark. |
| SCN-008 | Pass | Unit, API, and browser checks rejected invalid text with a corrective message. |
| SCN-009 | Pass | API saved a valid page after metadata failure with source fallback and editable missing-details copy. |
| SCN-010 | Pass | Browser showed a no-match state and restored all bookmarks when search was cleared. |
| SCN-011 | Pass | Unit and API checks treated tracking parameters and fragments as the existing page. |
| SCN-012 | Pass | Browser verified two-line clamps, four visible tags, and an additional-tag summary. |
| SCN-013 | Pass | Integration test closed and reopened the SQLite store and retained bookmark edits, tags, and read-later status; browser reload cleared search. |
| SCN-014 | Pass | Browser deleted the last bookmark, rendered the empty state, and focused the save field. |
| SCN-015 | Pass | API and browser checks blocked an edit-address conflict, preserved both bookmarks, and focused the address field. |

## Internal checks

- Canonical address normalization, metadata parsing, protocol validation, and case-insensitive tag deduplication passed unit tests.
- SQLite persistence, query and tag filtering, metadata fallback, conflict handling, read-later updates, and deletion passed integration tests.
- The review server listens on `0.0.0.0:4000`; the harness manifest points to the prepared application start command.
