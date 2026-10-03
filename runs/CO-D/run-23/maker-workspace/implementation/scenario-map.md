# Scenario-to-code map

| Scenarios | Implementation |
|---|---|
| SCN-001, 005, 006, 020, 028 | `capture.js`, save/retry API, saved-copy/PDF routes |
| SCN-002, 014, 015, 025 | `domain.js::filterBookmarks`, guided filters and saved-search UI |
| SCN-003 | label normalization/suggestions and label controls |
| SCN-004 | reading state actions and Read later view |
| SCN-007, 022 | `domain.js::normalizeUrl`, duplicate response/focus behavior |
| SCN-008, 009, 010, 011 | edit/delete/put-away/open controls and APIs |
| SCN-012, 019, 029 | sorting, pagination, preference storage |
| SCN-013 | selection mode and bulk endpoint |
| SCN-016, 023, 027, 029 | `import.js`, preview/commit endpoints and import dialog |
| SCN-017, 026 | full JSON and portable HTML export routes |
| SCN-018 | saved-search persistence and sidebar |
| SCN-021 | URL validation in domain and inline save error |
| SCN-024 | clamped card copy and expand/collapse control |

Acceptance coverage is in `implementation/test/acceptance.test.js`; focused domain coverage is in `implementation/test/domain.test.js`.
