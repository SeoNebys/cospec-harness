# Cycle 1 verification

Verified against all 40 approved scenarios on 2026-09-25.

## Automated results

- `npm test`: 8/8 tests passed.
- Core coverage: canonical duplicate URLs; case-insensitive captured-text search; loose label OR; explicit AND/OR/NOT; grouping; quoted literal operators; precise-search syntax errors; active-view ordering.
- Isolated Chromium acceptance: real metadata/page capture, optional Read later, preserved-text search, malformed-query result preservation, finishing/Undo/empty queue, preferences, permanent capture deletion, and page-size-bounded selection.
- Production Chromium matrix on port 4000: label filter and scoped sort, grouped search, archive/Undo, living saved search after adding a match, nested-folder import with original title/date, browser export, and complete export.
- Production HTTP check: `/` returned 200 with the application HTML; client readiness marker appeared after state load.

## Approved-scenario matrix

| Scenario(s) | Verification evidence | Result |
|---|---|---|
| SCN-001–004 | Capture acceptance plus browser edit/address code path; independent personalization flags inspected and syntax checked | Pass |
| SCN-005–006 | Label editor/suggestion/remove handlers inspected; production Cooking filter returned only its three current bookmarks | Pass |
| SCN-007–015 | Core search suite plus Chromium captured-text and grouped-expression runs | Pass |
| SCN-016–017 | Chromium save-to-queue, finish-last, Finished preservation, and Undo journey | Pass |
| SCN-018–019 | Rich-note editor/render/search paths inspected; seed formatted note renders bold and list distinctly | Pass |
| SCN-020, 030 | Canonical URL unit test plus save-path early duplicate return inspected | Pass |
| SCN-021 | Chromium confirmation/deletion; state record and physical capture both absent afterward | Pass |
| SCN-022–023 | Production archive/Undo plus dedicated Archived restore path and preserved object identity | Pass |
| SCN-024–025 | URL gate and retrieval-fallback/retry branches inspected; no mutation before validation | Pass |
| SCN-026 | Real HTML captured to disk, indexed from stored text, reopened through retained path | Pass |
| SCN-027 | PDF binary capture/open/download and retained-size/date presentation verified at endpoint/code level | Pass |
| SCN-028–029 | Empty rendering and malformed-query Chromium check; prior result count remains unchanged | Pass |
| SCN-031 | Chromium last-item completion showed “You’re all caught up” and preserved collection data | Pass |
| SCN-032 | CSS two-line/card clamps and full-details dialog checked at desktop and responsive layout rules | Pass |
| SCN-033 | Chromium nested Work/Research import; original title and 2020 date retained; confirmation precedes write | Pass |
| SCN-034 | Browser HTML contained dated links under label folders; complete gzip contained current non-deleted state/captures only | Pass |
| SCN-035 | Unit sort plus production sort in active Cooking view | Pass |
| SCN-036–037 | Page-size selection regression, additive-label code path, production archive batch semantics and shared Undo | Pass |
| SCN-038–039 | Query-only saved-search structure inspected; production rerun included a newly added matching bookmark | Pass |
| SCN-040 | Chromium immediate preview and persisted 48/title/large defaults | Pass |

## Verification findings corrected

1. Malformed precise-search feedback initially disabled the previous valid filter. Fixed and regression-tested.
2. Permanent deletion initially left an orphan capture, and complete export could include it. Fixed by deleting the file and exporting only referenced captures.
3. “Select all shown” initially selected beyond the current page-size limit. Fixed and regression-tested at 12 shown items.

No approved scenario remains failing or unverified.
