# Scenario → code mapping — cycle 1

Basis for later-cycle impact analysis. Paths are relative to `implementation/`.

| Scenario | Behaviour | Server | Frontend | Tests |
|----------|-----------|--------|----------|-------|
| SCN-001 | Save link; group under topic; alphabetical; counts | `POST /api/bookmarks` (`src/server.js`), `store.addBookmark` | `saveLink`, `render` grouping in `public/app.js` | e2e "SCN-001"; unit store CRUD |
| SCN-002 | Live search across title/url/topic; count; highlight; no-match message | (client-side over `/api/bookmarks`) | `render` filter, `highlight`, `#search-meta` | e2e "SCN-002" ×2 |
| SCN-003 | Topic buttons filter; combine with search; All clears search | (client-side) | `renderChips`, chip onclick, `render` | e2e "SCN-003" |
| SCN-004 | Edit in place; re-group; refresh buttons; address required | `PUT /api/bookmarks/:id` | `renderEditForm` | e2e "SCN-004" |
| SCN-005 | Delete with inline confirm; remove empty topic button | `DELETE /api/bookmarks/:id` | `renderDeleteConfirm` | e2e "SCN-005" |
| SCN-006 | Empty state | — | `render` empty branch | e2e "register lands in the empty state" |
| SCN-007 | Blank title→address; blank topic→"Uncategorized"; long text wraps | stores verbatim | `topicOf`, `renderRow`, CSS `word-break` | (covered via SCN-009 render + CSS) |
| SCN-008 | Duplicate address opens existing for edit | `POST` duplicate branch, `store.findByUrl`+`sameLink` | `saveLink` duplicate branch | e2e "SCN-008"; unit urls/store |
| SCN-009 | Add missing scheme | `normalizeUrl` in `POST`/`PUT` | (server authoritative) | e2e "SCN-009"; unit urls |
| SCN-010 | Address required | `POST`/`PUT` `address_required` | `saveLink`/edit guards | e2e "SCN-010" |
| SCN-011 | Account, sign-in, cross-device, keep-signed-in, wrong creds, sign-out | `/api/register`,`/api/login`,`/api/logout`,`/api/session`, `store` sessions/account | auth view in `public/app.js` | e2e "SCN-011" ×3; unit store account/session |

## Non-functional (see ../context/non-functional-backlog.md)
- NF-1 password/session hardening: `bcryptjs` hashing in place; HTTPS/secure
  cookies deferred. NF-2 responsive layout: CSS media query at 560px. NF-3/NF-4
  performance & sync latency: not specifically tuned.
