# Scenario to implementation map

| Scenario | Primary implementation | Acceptance coverage |
|---|---|---|
| SCN-001 | `public/app.js` save/open flow; `lib/metadata.js`; `lib/store.js#create` | `scenarios.spec.js` SCN-001 |
| SCN-002 | `public/app.js` review step; title/description create payload | SCN-002 |
| SCN-003 | Edit dialog; `store.update`; URL/site-name recalculation | SCN-003 |
| SCN-004 | Sidebar label counts; label search query; `store.overview` | SCN-004 |
| SCN-005 | Edit label chooser; `store.#replaceLabels` | SCN-005 |
| SCN-006 | `lib/search.js`; search input and scoped list API | SCN-006 |
| SCN-007 | Read later row action/view; `read_later` persisted field | SCN-007 |
| SCN-008 | Archive/restore row action, scoped list API, preserved edit data | SCN-008 |
| SCN-009 | Edit delete action, confirmation dialog, DELETE API | SCN-009 |
| SCN-010 | Metadata duplicate check; `focusExisting`; canonical unique constraint | SCN-010 |
| SCN-011 | `parseWebAddress`; inline save-address error | SCN-011 |
| SCN-012 | `fetchPageDetails` unavailable response; manual review fallback | SCN-012 |
| SCN-013 | Search empty state and clear control | SCN-013 |
| SCN-014 | Label Enter action, case-insensitive label store, sidebar count | SCN-014 |
| SCN-015 | Save/edit title validation; optional description storage | SCN-015 |
| SCN-016 | `canonicalizeAddress` tracking removal; clean URL preservation | SCN-016 |
| SCN-017 | `.bookmark-title`/`.bookmark-description` CSS; complete edit fields | SCN-017 |
| SCN-018 | `SearchSyntaxError`; browser result preservation | SCN-018 |
| SCN-019 | `state.limit`; Show 20 more; bounded `store.list` | SCN-019 |
| SCN-020 | Stored-only bookmark details; no automatic external revalidation | SCN-020 |

Shared acceptance tests: `implementation/tests/acceptance/scenarios.spec.js`  
Internal tests: `implementation/tests/unit/*.test.js`
