# Scenario-to-code mapping

| Scenario | Main production code | Acceptance coverage |
|---|---|---|
| SCN-001 | `app.mjs` POST `/api/bookmarks`; `lib/metadata.mjs`; add dialog in `public/app.js` | `tests/acceptance.test.mjs` SCN-001 |
| SCN-002 | `lib/store.mjs#addLabel`; labels API; inline label UI | SCN-002 |
| SCN-003 | `lib/store.mjs#list`; search UI and view reload | SCN-003 |
| SCN-004 | `lib/store.mjs#setReadLater`; bookmark PATCH; Read later view | SCN-004 |
| SCN-005 | `lib/store.mjs#setArchived`; Archive view; More actions menu | SCN-005 |
| SCN-006 | `lib/metadata.mjs#fallbackDetails`; retry API; Needs details card state | SCN-006 |
| SCN-007 | `lib/metadata.mjs#validateWebAddress`; add-form field error | SCN-007 |
| SCN-008 | case-insensitive `labels` schema and `addLabel`; inline error | SCN-008 |
| SCN-009 | empty search result from `list`; searched empty-state rendering | SCN-009 |
| SCN-010 | later view filter and later empty-state rendering | SCN-010 |
| SCN-011 | archive view filter and archive empty-state rendering | SCN-011 |
| SCN-012 | archive SQL clears `read_later`; UI refreshes current view | SCN-012 |
| SCN-013 | unique bookmark address and POST conflict handling | SCN-013 |
| SCN-014 | `setReadLater(false)`; active button toggle | SCN-014 |
| SCN-015 | no automatic fetch on list; stored snapshot fields | SCN-015 |
| SCN-016 | `editDetails`; bookmark PATCH; edit dialog | SCN-016 |
| SCN-017 | restore SQL clears archive and Read later; Restore menu action | SCN-017 |

Cross-cutting metadata validation and private-destination checks are covered by
`tests/metadata.test.mjs`. Browser interaction coverage is recorded during
Phase 3 verification.
