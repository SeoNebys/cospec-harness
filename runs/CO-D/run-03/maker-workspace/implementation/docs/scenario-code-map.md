# Scenario → code map

Which approved scenario is realised by which code, and which test covers it.
Basis for judging impact scope on future change requests.

| Scenario | Code | Test |
|---|---|---|
| SCN-001 Save + auto-capture; find across fields | `store.create`, `capture.captureFromHtml`, `search.searchRecords`; UI `doSave`, `card` | store.test "save captures…"; search.test |
| SCN-002 Open to the page (whole card) | UI `openViewer`/`showViewer` (Original tab, "Visit the original page"); card `data-act="open"` on whole body/thumb | manual (verification) |
| SCN-003 Correct details at save & later (inline) | `store.update`; UI `editCard`, save-time `editingId`/`justSavedId` | store.test "edit updates…" |
| SCN-004 Duplicate re-save → existing | `store.create` dup branch, `url.normUrl` | url.test; store.test "re-saving…" |
| SCN-005 Edit the web address inline | `store.update` (url), `editCard` "Web address" | store.test "edit updates…" |
| SCN-006 Delete with Undo | `store.remove`/`undelete`/`purgeExpired`; UI delete + undo toast | store.test "delete then undo" |
| SCN-007 Own-words labels + group by label | `store.update` labels, `store.list`/`scoped` label filter, `labelList`; UI chip editor, label bar | store.test "search respects label scope" (labels), importer.test |
| SCN-008 Archive vs delete; excluded from search | `store.setArchived`, `scoped`, search exclusion | store.test "archived items leave…" |
| SCN-009 Deliberate re-fetch | `store.refetch`; UI `data-act="refetch"` | store.test "refetch pulls…" |
| SCN-010 To-read: flag / pile / check off / at save | `store.setToRead`, `create({unread})`, toread view; UI toggle + save checkbox | store.test "to-read flag…" |
| SCN-011 First-run welcome | UI `renderList` welcome branch | manual (verification) |
| SCN-012 Capture fails → save anyway, needs a title | `store.create` `cap.ok===false` branch; UI needs-a-title badge | store.test "capture failure still saves" |
| SCN-013 Reject non-links | `url.looksLikeUrl`, `create` throws code 'invalid' → 400; UI inline error | url.test; store.test "obvious non-link" |
| SCN-014 Vanished page not a dead end | `getCopy` + UI `showViewer` gone-box / saved-copy fallback | manual (verification) |
| SCN-015 Keep readable copy; read anytime; search into it | `capture` copyText, stored on record; `getCopy`; `search` body field; UI saved-copy tab | store.test "save captures… body word"; search.test snippet |
| SCN-016 Ranking + loose multi-word | `search` weights, AND-groups, snippet, strong flag | search.test ranking/loose/snippet |
| SCN-017 phrase / either / exclude / literal | `search.parseQuery`, `describe`; UI interpretation bar | search.test operators + describe |
| SCN-018 Scoped search + widen back | `store.scoped` applied before search; UI scope bar + "Search all" | store.test "search respects label scope" |
| SCN-020 Import (dates/folders/dedupe/dead) + export | `importer.*`, `store.importStart`/`runImport`/`exportAll`; UI import modal + export | importer.test; store.test "import: dates kept…" |

Deferred (no code this cycle): SCN-019 saved searches, SCN-021 ordering, SCN-022 batch actions.
