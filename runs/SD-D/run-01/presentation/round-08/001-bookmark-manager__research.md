# Phase 0 Research: Bookmark Manager

Decisions resolving the open technical questions behind the plan. Each entry: what was
chosen, why, and what was rejected.

## 1. Application shape: local web app vs. pure browser app vs. native desktop

**Decision**: Local web application — a backend process the user runs, used via their browser.

**Rationale**: Three required behaviors are impossible or painful in a pure in-browser app:
(a) fetching arbitrary pages' `<title>`/favicon/meta-description is blocked by CORS from
browser JS; (b) parsing the Netscape bookmark HTML export for import; (c) writing that
same format for export. All three are trivial server-side. A local web app also keeps the
UI in the tool the user already opens links with, satisfying "open in browser" naturally.

**Alternatives considered**:
- *Pure client-side (browser extension or static page)*: avoids a backend but hits the
  CORS wall for metadata and has awkward file access for import/export. A browser
  extension would also tie the app to one browser.
- *Native desktop app (Electron/Tauri/Qt)*: heavier to build and ship for a single-user
  v1; no requirement demands native OS integration. Rejected as over-engineering (YAGNI).

## 2. Storage engine

**Decision**: Local SQLite database file, with an FTS5 full-text index.

**Rationale**: Single-user/local means no need for a client/server database. SQLite is a
zero-configuration embedded file, trivially backed up/moved (reinforces the portability
the client cares about), and handles the 5,000–10,000 bookmark scale with room to spare.
FTS5 gives fast, case-insensitive search across title/URL/note/tags (FR-012, SC-004).

**Alternatives considered**:
- *Flat JSON file*: simplest, but full-collection rewrites and linear scans degrade at the
  thousands-scale search target; no indexed search.
- *PostgreSQL/MySQL*: violates simplicity — a server DB for a one-user local app is
  unjustified.

## 3. Page metadata capture (title, favicon, description)

**Decision**: Server-side best-effort fetch with `httpx`, parse with an HTML parser;
time-boxed (~5s). On failure/timeout: save anyway with URL as title, blank icon/description.

**Rationale**: Directly satisfies FR-002/FR-002a and the "unreachable page" edge case.
Favicon resolved from `<link rel="icon">` when present, else the site's `/favicon.ico`.
Description from `<meta name="description">` or OpenGraph `og:description`. Time-boxing
protects SC-001 (save under 15s) so a slow site never blocks the user.

**Alternatives considered**:
- *Third-party metadata/preview API*: adds an external dependency and a privacy concern
  (sending every saved URL to a third party) — rejected for a local-first, single-user tool.
- *No fetch, manual entry only*: fails FR-002a and SC-003.

## 4. Favicon handling

**Decision**: Fetch the icon bytes once at save time and store them locally (small blob),
serving them from the backend.

**Rationale**: Keeps the list rendering fast and offline-capable (SC-004) and avoids
re-hitting remote sites on every list render; icons are tiny. Aligns with local-first.

**Alternatives considered**:
- *Hotlink the remote favicon URL*: simpler but breaks offline, leaks browsing to sites on
  every render, and shows broken icons when a site changes its favicon path.

## 5. Import format (browser bookmarks)

**Decision**: Parse the Netscape Bookmark File Format (the `bookmarks.html` all major
browsers export). Map each enclosing `<H3>` folder (including nested levels) to tags;
read the `ADD_DATE` attribute as the original save date; skip URLs already present.

**Rationale**: This single format is the universal export from Chrome, Firefox, Edge, and
Safari, so one parser covers "my browser" for essentially every user. It carries folder
structure and `ADD_DATE`, exactly what FR-016a/FR-016b need.

**Alternatives considered**:
- *Per-browser proprietary formats/DBs*: brittle, browser-version-specific — rejected.
- *CSV*: loses folder hierarchy and dates.

## 6. Export format

**Decision**: Write the same Netscape Bookmark File Format on export.

**Rationale**: Guarantees the round-trip the client asked for (SC-008): the exported file
re-imports into this app and into any browser. Reuses the import parser's schema knowledge.

**Alternatives considered**:
- *JSON export*: good for re-import here but not directly browser-importable; would fail
  the "move somewhere else" reassurance. Could be added later as a secondary format.

## 7. Rich-text notes

**Decision**: A small WYSIWYG editor (Tiptap) limited to links, bold, and bullet lists;
store as HTML; sanitize server-side with a strict allowlist (`bleach`) before persisting.

**Rationale**: Meets FR-015 ("basic formatting, shown formatted") without a heavyweight
editor. Server-side sanitization keeps stored/rendered HTML safe. Search indexes the
plain-text content so formatting never hides a note from search (edge case).

**Alternatives considered**:
- *Markdown source stored, rendered on display*: viable, but a WYSIWYG surface matches the
  "write a note and see it formatted" expectation more directly. Markdown remains a valid
  fallback if the editor proves heavy.
- *Full rich text (images, tables, colors)*: beyond the stated "nothing elaborate" scope.

## 8. Duplicate detection & URL identity

**Decision**: Normalize URLs (lowercase scheme/host, strip default ports and trailing
slash; keep path/query/fragment) and treat the normalized form as the uniqueness key.
Saving an existing URL routes to that bookmark's edit view (FR-004).

**Rationale**: Prevents trivial `http://Example.com/` vs `http://example.com` duplicates
while not over-merging genuinely different pages. Supports the import "skip duplicates" rule.

**Alternatives considered**:
- *Exact string match*: too many false "new" bookmarks from case/slash differences.
- *Aggressive normalization (stripping query strings)*: risks merging distinct pages — rejected.

## 9. Sorting & search implementation

**Decision**: Sorting by `date_saved DESC` (default) or `title` (case-insensitive) handled
in SQL. Search via FTS5 over a synthesized document (title + URL + note text + tags).

**Rationale**: Push sorting/filtering to SQLite for the sub-second target at scale
(SC-004, FR-012, FR-014).

**Alternatives considered**:
- *In-memory JS filtering of the whole set*: fine for hundreds, degrades toward the
  5,000+ target and duplicates logic across pages.
