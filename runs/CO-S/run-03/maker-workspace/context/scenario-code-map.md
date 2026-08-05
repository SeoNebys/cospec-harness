# Scenario → code mapping — Cycle 1

Basis for impact analysis in later cycles. Paths are under `implementation/`.

| Scenario | Behaviour | Code | Tests |
|----------|-----------|------|-------|
| SCN-001 Save a link | `makeBookmark`, `deriveTitle`, `fullUrl`; newest-first via `unshift` in `app.js:saveBookmark` | core.js `makeBookmark`/`deriveTitle`/`fullUrl`; app.js `saveBookmark` | core.test.js "SCN-001 …" |
| SCN-002 Group at save (multi) | `normalizeGroups`; chip UI + `addPendingGroup` | core.js `normalizeGroups`/`canonicalGroup`; app.js `addPendingGroup`, `renderChips` | "SCN-002 …" |
| SCN-003 Browse by group | `inGroup`; sidebar `renderSide` | core.js `inGroup`; app.js `renderSide`/`render` | "SCN-003 …" |
| SCN-004 Search | `search` (title/url/group, case-insensitive, all items) | core.js `search`; app.js `render` (search branch) | "SCN-004 …" |
| SCN-005 Edit groups | inline editor; `canonicalGroup` | app.js `makeEditor`; core.js `canonicalGroup` | "SCN-005 …" |
| SCN-006 Remove (confirm) | `window.confirm` then splice + persist | app.js `removeBookmark` | "SCN-006 …" |
| SCN-007 Empty group vanishes | groups derived from links; filter fallback to All | core.js `usedGroups`; app.js `renderSide` | "SCN-007 …" |
| SCN-008 Empty / no-result states | empty-state messages | app.js `render` (empty branch) | "SCN-008 …" |
| SCN-009 Reject non-links | `looksLikeLink`, `validateAdd` (empty/invalid) | core.js `looksLikeLink`/`validateAdd`; app.js `saveBookmark` | "SCN-009 …" |
| SCN-010 Prevent duplicates | `normalizeUrl`, `findDuplicate`, `validateAdd`; flash highlight | core.js; app.js `saveBookmark` (flashId) | "SCN-010 …" |
| SCN-011 Long content tidy | CSS line-clamp + ellipsis | styles.css `.title`/`.url` | Phase 3 visual check |
| SCN-012 Case-insensitive groups | `canonicalGroup` | core.js `canonicalGroup` | "SCN-012 …" |

Persistence (all scenarios): `storage.js` load/save, called from `app.js:persist`.
