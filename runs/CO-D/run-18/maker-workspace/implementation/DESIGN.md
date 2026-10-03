# Implementation design

## Decisions

- A dependency-free Node.js HTTP service keeps deployment and review startup predictable. Bookmark data is persisted in a JSON file through an isolated store abstraction.
- The browser interface is a single-page application using semantic HTML, CSS, and JavaScript. It talks only to JSON endpoints and never mutates durable state optimistically.
- Page metadata is fetched by the server with a timeout. Failure returns an explicit manual-entry path rather than blocking saving.
- Duplicate identity removes in-page fragments, trailing slashes, and recognized advertising/tracking parameters while preserving genuine paths and meaningful query values.
- Saved metadata is never refreshed automatically. An explicit edit-screen check previews fresh details and requires an additional choice before fields change.
- Rich notes store a deliberately small HTML subset (paragraphs, bold, lists, and line breaks). The browser sanitizes note markup before saving and rendering.
- Permanent deletion endpoints reject active bookmarks. Both single and batch deletion therefore retain the Archive-only safety rule independently of the UI.

## Alternatives not selected

- Prototype source was not reused. Production behavior was rebuilt from the approved scenarios.
- A framework and database were not added because the single-person local scope does not need their operational overhead. The store boundary permits a future database without changing browser behavior.
- Automatic metadata refresh was rejected because it could overwrite owner-approved wording.

## Scenario-to-code map

- SCN-001, SCN-010: `metadata.mjs`, `/api/preview`, save dialog in `public/app.js`
- SCN-002, SCN-014: `normalizeUrl`, `BookmarkStore.findByUrl`, duplicate editor in `public/app.js`
- SCN-003, SCN-004, SCN-011: `visibleItems`, sidebar/search rendering in `public/app.js`
- SCN-005: `canonicalTag`, tag editor and suggestions in `public/app.js`
- SCN-006: read-later card and batch handlers in `public/app.js`
- SCN-007: formatting toolbar, note sanitation, card note preview in `public/app.js`
- SCN-008, SCN-009: archive/restore/delete store methods and card actions
- SCN-012: card line clamps/fade in `public/styles.css`, full edit dialog in `public/app.js`
- SCN-013: explicit `/api/refresh-preview` and review-before-apply UI
- SCN-015: card-title links in `public/app.js`
- SCN-016: `visibleItems` ordering and the collection order control
- SCN-017: selection state, batch bar, `/api/bulk`, and `/api/bulk-delete`

## Tests

- `tests/store.test.mjs`: URL identity, persistence rules, tags, read later, archive/delete, and batch mutations.
- `tests/metadata.test.mjs`: fetched metadata and optional-image behavior.
- Browser verification in Phase 3 exercises integrated UI workflows against a disposable data file.
