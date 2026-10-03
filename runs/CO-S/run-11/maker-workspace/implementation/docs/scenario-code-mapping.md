# Scenario ↔ code mapping (Cycle 1)

Basis for impact analysis on future change requests.

| Scenario | Behaviour | Server code | Front-end code | Tests |
|---|---|---|---|---|
| SCN-001 | Save with auto-filled details | `POST /api/bookmarks`, `GET /api/metadata` (server.js); `metadata.js` | `doSave`, `autofill` (app.js); save form (index.html) | metadata.test.js; api.test.js (save/metadata); acceptance SCN-001 |
| SCN-002 | Tags with chip entry + reuse | tags in `createBookmark`/`updateBookmark`, `listTags` (db.js) | `renderSaveTags`/`addSaveTag`/`renderSuggest`, edit tag box (app.js) | db.test.js (tags); acceptance SCN-001 (chips), SCN-004 (tag filter) |
| SCN-003 | To read / Finished, no delete | `finished` column, `PATCH /:id/status` (server.js, db.js) | `toggleFinished`, tabs/counts (app.js) | db.test.js; api.test.js (status); acceptance SCN-011 |
| SCN-004 | Find by searching | (client-side over `GET /api/bookmarks`) | `matches`, `render`, `applySearchMeta`, search box (app.js) | acceptance SCN-004 |
| SCN-005 | Empty states | — | `render` empty-state branches (app.js) | acceptance SCN-013 (empty), SCN-011 (no results) |
| SCN-006 | Prevent duplicates, go to existing | `normalizeUrl` (url.js), duplicate 409 in `POST /api/bookmarks` | duplicate branch in `doSave` (app.js) | url.test.js; db.test.js; api.test.js; acceptance SCN-006 |
| SCN-007 | Edit a bookmark | `PUT /api/bookmarks/:id` incl. conflict 409 (server.js) | `buildEditForm` (app.js) | db.test.js; api.test.js (edit/conflict); acceptance SCN-007 |
| SCN-008 | Personal note | `note` column | note field in save/edit; note render; search includes note (app.js) | db.test.js; acceptance SCN-001 |
| SCN-009 | Validation + auto-fill failure | url validation (url.js); metadata `{ok:false}` fallback (server.js) | invalid-link message, fetch-failure message (app.js) | url/metadata tests; acceptance SCN-009 |
| SCN-010 | Long content stays readable | — | `word-break` rules (styles.css) | (visual; covered by CSS) |
| SCN-011 | Archive / restore | `archived` column, `PATCH /:id/archived` | archive/restore actions, search exclusion (app.js) | db/api tests; acceptance SCN-011 |
| SCN-012 | Permanent delete + confirm | `DELETE /api/bookmarks/:id` | `askDelete` + confirm modal (app.js, index.html) | api.test.js; acceptance SCN-012 |
| SCN-013 | Sign-in + persistence | auth.js; `/api/register`,`/api/login`,`/api/logout`,`/api/me`; sessions (db.js) | auth view, `submitAuth`, `signOut`, `init` (app.js) | auth/db/api tests; acceptance SCN-013 |

## Files
- `src/url.js` — link validity + duplicate key (SCN-006, SCN-009)
- `src/metadata.js` — auto-fill fetch/parse (SCN-001, SCN-009)
- `src/auth.js` — password hashing, sessions, email check (SCN-013)
- `src/db.js` — schema + data access (all)
- `src/server.js` — HTTP API + static hosting + review-account seed (all)
- `public/{index.html,styles.css,app.js}` — front-end (all)
