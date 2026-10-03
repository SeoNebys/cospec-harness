# Internal design record — My Bookmarks (Cycle 1)

Implementation basis: the approved scenarios' behaviour (context/scenarios/SCN-*.md).
Not derived from the Phase 1 prototype code.

## Design decisions

- **Dependency-free Node stack.** Node 24 built-ins only: `node:http` (server),
  `node:sqlite` (storage), `node:crypto` (password hashing + session ids), global
  `fetch` (page/PDF/Archive). Chosen to avoid an install step and lockfile drift in
  the shared image, and because the built-ins cover every need. Alternative
  (Express + better-sqlite3) dropped: adds native build + registry dependency for no
  behavioural gain.
- **Server as source of truth (cross-device sync).** All data lives in SQLite keyed
  by user; the browser is a thin client over a JSON API. This is what lets bookmarks
  AND preferences follow the user across devices (a build-scope requirement). Login
  uses an httpOnly session cookie (SameSite=Lax, not Secure, so it works over http in
  review; production would add Secure + a domain).
- **Rich filtering on the client.** The query language, tag include/exclude, reading
  filter, sort and pagination run in the browser over the user's fetched list. For a
  personal collection this is simple and fast, and keeps one implementation of the
  behaviour. The query language, URL normalization, Markdown and visuals live in
  `src/public/shared/*` as ES modules imported by BOTH the browser and Node tests, so
  the tested code is the shipped code.
- **PDF by real content type (SCN-011).** `metadata.js` decides PDF-ness from the
  fetched response's `content-type`, not the address suffix; the `.pdf` suffix is only
  a fallback hint when no content type is present.
- **Snapshots.** Page copy = a single self-contained HTML document: scripts and inline
  event handlers removed (safety), stylesheets and images inlined as data URIs (bounded)
  so it renders even if the original disappears; stored as `text/html` and served at
  `/snapshot/file` (strict CSP, viewed in a sandboxed iframe). PDF copy = the actual
  bytes stored as a BLOB, served with `application/pdf`. Internet Archive = best-effort
  Save-Page-Now submission storing the archived-version URL; all forms coexist.
- **Full backup (JSON) is complete.** `/api/export` and `repo.exportAll` include the
  saved-copy content (page HTML / PDF base64), Internet-Archive reference, tags, note,
  reading + archive state, and dates; import restores all of them (merge-and-skip).
- **Merge-only import (SCN-012).** Import always merges and skips duplicates (by the
  normalize rule); there is deliberately no replace-all, per the client, to avoid
  accidental data loss.
- **Review account.** `seed.js` seeds review@example.com / review-access with sample
  data so the app is reviewable immediately.

## Scenario → code mapping

| Scenario | Where |
|---|---|
| SCN-001 save + review + fetched details | server `/api/fetch-metadata`, `/api/bookmarks` POST; `metadata.js#fetchMetadata`; client `openAddFlow`/`mSave` |
| SCN-002 duplicate rule | `shared/normalize.js#normalize`; server dedup in POST; client saver submit |
| SCN-003 edit title/desc/address (+clash, validation) | `/api/bookmarks/:id` PATCH; `repo.update`; client `openEdit`/`mSave` |
| SCN-004 search query language | `shared/search.js`; client search input |
| SCN-005 read-later queue + filters | `to_read` column; client filters + `toggleRead`; opt-in checkbox in editor |
| SCN-006 tags + suggestions + tag filter | `tags_json`; client `makeTagPicker`, tag chips, `#tag` search |
| SCN-007 archive/delete + ⋯ menu | `archived` column; client menu, `setArchived`, `askDelete` |
| SCN-008 notes + Markdown viewer | `note` column; `shared/md.js`; client `openNote` |
| SCN-009 bulk actions | `/api/bookmarks/bulk`; client select mode + bulk bar |
| SCN-010 saved views | `views` table; `/api/views`; client include/exclude pickers, `applyView` |
| SCN-011 preserve page/PDF/Archive | `/api/bookmarks/:id/snapshot` + `/archive`; `metadata.js`; `repo.setSnapshot/setArchive` |
| SCN-012 import/export | `/api/bookmarks/import`; client export builders + import parsers |
| SCN-013 open original link | client card anchor `target=_blank`; state unchanged on open |
| Prefs (sort/page size/text size) sync | `prefs` table; `/api/prefs`; client `applyPrefs` |
| Accounts + cross-device sync | `auth.js`, `db.js`, session cookie |

## Tests

- `test/shared.test.js` — normalize, search language, include/exclude, Markdown safety.
- `test/data.test.js` — accounts, CRUD, dedup, edit, reading state, archive/delete,
  snapshot (page/pdf/archive), views, prefs, per-account isolation.
- Run: `npm test` (node --test). UI smoke-tested with Playwright during development.

## Notes / limits honestly recorded

- Real page/PDF fetch and Internet Archive submission depend on outbound network at
  runtime; all fail gracefully to a usable fallback.
- Page-copy extraction is plain-text (scripts/styles/tags stripped); a richer reader
  extraction could be a later refinement.
