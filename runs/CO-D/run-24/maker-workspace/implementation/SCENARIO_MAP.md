# Scenario → code mapping (Cycle 1)

Basis for later-cycle impact analysis. Each approved scenario and where it lives.

| SCN | Title | Server code | Client code | Tests |
|-----|-------|-------------|-------------|-------|
| 001 | Quick-save + auto-fill, dedupe | src/bookmarks.js `create`, src/metadata.js, src/urls.js `normalizeKey` | app.js saver submit, `render` favicon/preview | urls.test, api.test (create/duplicate), acceptance SCN-001 |
| 002 | Edit details, note (Markdown), tags | src/bookmarks.js `update` (+ conflict guard), `cleanTags` | app.js editor, `renderMarkdown`, tag chips + suggestions | api.test (edit/conflict), acceptance (implicit via edit) |
| 003 | Read later + tab | src/bookmarks.js `update` read_later | app.js `inView`, tabs, readlater button | api.test lifecycle, acceptance SCN-003 |
| 004 | Search query language | (client-side) | public/query.js, app.js `visible` | query.test, acceptance SCN-004 |
| 005 | Archive / restore | src/bookmarks.js `update` archived | app.js archive/restore buttons, archived tab | api.test lifecycle, acceptance SCN-005 |
| 006 | Delete with confirmation | src/bookmarks.js `remove` | app.js confirm dialog | api.test lifecycle, acceptance SCN-006 |
| 007 | Sort dropdown | (client-side) | app.js `visible` sort, #sortSelect | acceptance SCN-007 |
| 008 | Click a tag to filter | (client-side) | app.js `filterByTag` | acceptance SCN-004 (tag search) |
| 009 | Large collection / long content | — | styles.css desc clamp, density | (visual) acceptance density |
| 010 | Save edge cases | src/bookmarks.js `create` (invalid/duplicate/fetch fail), src/urls.js `looksLikeUrl` | app.js save error, duplicate→editor, fetch-warn | urls.test, api.test (invalid/duplicate) |
| 011 | Shared account + sign-in | src/db.js users/sessions, src/auth.js, server.js auth gate | login.html/js, app.js 401→/login | api.test (login/401), acceptance SCN-011 |
| 012 | Bulk select + actions | src/bookmarks.js `bulk` | app.js selection mode, bulk bar, bulk tag modal | api.test bulk, acceptance SCN-012 |
| 013 | Saved live collections | server.js collections routes | app.js collections chips, save-search | api.test collections, acceptance SCN-013 |
| 014 | Auto preserved copy + PDF + Internet Archive | src/snapshot.js, src/archiveorg.js, src/bookmarks.js `runSnapshot`/`runArchiveOrg`, server.js /snapshots, /archiveorg | app.js snapshot area, badges, polling | api.test (snapshot/pdf), acceptance SCN-014 |
| 015 | Import / export bookmarks HTML | src/bookmarksHtml.js, server.js /import, /export | app.js import file + export | bookmarksHtml.test, api.test import/export, acceptance SCN-015 |
| 016 | Settings (sort/density/font) | server.js /settings, src/db.js settings | app.js settings modal, `applyPrefs` | api.test settings, acceptance SCN-016 |

Later-cycle backlog: context/later-cycle-requests.md, context/non-functional-backlog.md.
