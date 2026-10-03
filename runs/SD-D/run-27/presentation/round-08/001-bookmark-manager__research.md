# Phase 0 Research: Bookmark Manager

All Technical Context unknowns are resolved below. Format per decision:
Decision / Rationale / Alternatives considered.

## 1. Application shape & runtime

**Decision**: Single Node.js (v24) process using Express to serve a JSON API and
the pre-built React SPA, listening on `0.0.0.0:4000`, started via `npm start`.

**Rationale**: The presentation environment requires one foreground start command
on port 4000 bound to `0.0.0.0`. Several required capabilities (metadata fetch,
page preservation, file storage, Internet Archive calls, import/export) cannot be
done from a browser page alone and need a server. Serving the SPA from the same
process avoids a second port (prototype/app must not share ports) and simplifies
delivery.

**Alternatives considered**: Separate frontend dev server (rejected: extra port,
not needed for delivery); pure server-rendered templates (rejected: the rich
interactions — live search, tag autocomplete, multi-select bulk bar — are far
simpler as a SPA); serverless/browser-only with IndexedDB (rejected: cannot fetch
cross-origin metadata or preserve pages).

## 2. Storage engine

**Decision**: SQLite via `better-sqlite3`, one database file under `/work/data/`,
with FTS5 for full-text search. Preserved page files stored on disk under
`/work/data/preserved/` and referenced by row.

**Rationale**: Single-user local persistence maps perfectly to an embedded
database; synchronous better-sqlite3 is simple and fast for this scale (5,000+
rows). FTS5 gives case-insensitive full-text indexing over title/description/
note/address to meet the <1s search target. Files on disk keep large preserved
HTML/PDF blobs out of the row store.

**Alternatives considered**: JSON file store (rejected: no efficient search, risk
of corruption on concurrent writes); PostgreSQL (rejected: over-provisioned for a
single-user local app, adds a service dependency); storing preserved pages as
BLOBs (rejected: bloats DB, complicates serving files to the browser).

## 3. Metadata capture (title, description, icon, preview image)

**Decision**: Use the bundled Playwright 1.61.0 + Chromium to load the target URL
and extract Open Graph / standard `<meta>` tags for title, description, and
preview image, and resolve the favicon (link[rel~=icon] or `/favicon.ico`).
Pin `playwright` to `1.61.0` and reuse browsers at `/opt/playwright-browsers`.

**Rationale**: Many pages render metadata via JS or protect against simple
fetches; a real browser yields reliable results and is already installed. Pinning
matches the installed browser revision (per environment rules) and avoids a second
browser download.

**Alternatives considered**: Plain HTTP fetch + HTML parse (rejected: misses
JS-rendered metadata, weaker favicon resolution, but retained as a fast fallback
when the browser is unavailable); third-party metadata APIs (rejected: external
dependency, privacy, and often paid).

## 4. Self-contained page preservation & PDF handling

**Decision**: For web pages, capture a single self-contained HTML file using
Playwright — inline external CSS and images as data URIs so the saved `.html`
renders offline as the original page (not a readability extract). Detect PDFs by
response `Content-Type: application/pdf` (or `.pdf` and a HEAD/GET check) and save
the raw bytes as a `.pdf`. Store files under `/work/data/preserved/<id>/` and
record the path + type on the bookmark.

**Rationale**: The spec requires a self-contained HTML representation of the
original page, not an extracted readable version, and PDFs stored as PDFs.
Inlining resources during a real browser render produces a faithful, portable
single file. Content-Type detection is the reliable way to branch PDF vs HTML.

**Alternatives considered**: MHTML/`page.mhtml` via CDP (viable; single-file but
less portable across browsers — HTML with inlined resources is more universally
openable); readability-style extraction (rejected: explicitly not wanted); saving
a directory of assets (rejected: not "self-contained single file").

## 5. Internet Archive preservation (optional)

**Decision**: Submit the URL to the Internet Archive "Save Page Now" public
endpoint (`https://web.archive.org/save/<url>`) and store the resulting snapshot
URL/timestamp reference on the bookmark. Treat it as best-effort and asynchronous;
on failure, inform the user and leave the bookmark unaffected.

**Rationale**: Meets FR-031 without hosting archive infrastructure. Storing only a
reference keeps the app light. Graceful degradation satisfies FR-032 and the
environment's "report unavailable external services honestly" guidance.

**Alternatives considered**: Internet Archive S3-style API with keys (rejected:
requires user credentials, out of scope for v1); scraping the archive UI
(rejected: brittle).

## 6. Advanced search: parsing & execution

**Decision**: A small hand-written tokenizer + recursive-descent parser producing
a boolean expression tree. Tokens: quoted phrases (`"..."`), `#tag` terms, bare
keywords, operators `AND`/`OR`/`NOT`, and parentheses. Operators are recognized
only when unquoted; quoting `"AND"`/`"OR"`/`"NOT"` makes them literal text.
Precedence: NOT > AND > OR; parentheses override; adjacent bare terms are implicitly
ANDed. Leaf terms compile to FTS5 match conditions (title/description/note/address,
case-insensitive) or tag-membership subqueries; the tree compiles to a SQL WHERE
with `INTERSECT`/`UNION`/`EXCEPT` or boolean predicates. Malformed queries
(unbalanced quotes/parens, dangling operator) raise a clear validation error.

**Rationale**: A dedicated parser is the only robust way to honor operator
precedence, parentheses, and the quoted-literal-operator rule (FR-012, FR-013).
Compiling leaves to FTS5 keeps it fast and case-insensitive at the 5,000-row scale.

**Alternatives considered**: Passing the raw string to FTS5 query syntax
(rejected: FTS5 syntax differs from the required grammar, cannot express the
quoted-literal-operator rule or tag membership cleanly, and exposes cryptic
errors); regex-only matching (rejected: no grouping/precedence).

## 7. Deduplication / URL normalization (safe-equivalence only)

**Decision**: Compute a canonical key for dedup by lower-casing the host and
dropping a default port (80 for http, 443 for https). Do NOT strip trailing
slashes, query strings, fragments, or tracking parameters. Store the original
address verbatim; store the canonical key (unique) for duplicate detection on
create, edit, and import.

**Rationale**: Directly implements the client's narrowed rule (US2, FR-007):
treat addresses as duplicates only when safely equivalent. Trailing slashes and
query/tracking params can denote genuinely different pages, so they remain
distinct. A stored unique canonical key enforces "no second copy" at the data
layer.

**Alternatives considered**: Aggressive normalization stripping tracking params
(rejected by client); exact string match only (rejected: would treat
`HTTP://Example.com` and `http://example.com:80` as different, contrary to the
"safely equivalent" intent).

## 8. Netscape bookmark HTML import/export

**Decision**: Parse the standard Netscape bookmark file (`<DT><A HREF ... ADD_DATE
... TAGS ...>`), preserving each entry's title, tags (from `TAGS` attribute and/or
enclosing `<H3>` folder names mapped to tags), and original date-added
(`ADD_DATE`, epoch seconds). Export produces the same format. Import routes every
entry through the dedup rule and reports added/skipped/failed counts.

**Rationale**: This is the format major browsers read/write (FR-026–FR-028), and
folders-as-tags plus ADD_DATE/title preservation are explicit requirements. Using
a forgiving HTML parser tolerates the loose, real-world markup browsers emit.

**Alternatives considered**: JSON export only (rejected: not the standard browser
format the client requires); strict XML parsing (rejected: bookmark files are not
valid XML).

## 9. Note formatting (simple, safe)

**Decision**: Store notes as Markdown text. Render to HTML with markdown-it and
sanitize with an allow-list (bold, italic, headings, lists, links, code) using
sanitize-html before display. No raw/unsafe HTML is rendered.

**Rationale**: Meets FR-009 ("simple formatting … neutralize unsupported or unsafe
markup") with well-known, minimal libraries; Markdown is a natural fit for
"simple formatting."

**Alternatives considered**: A full WYSIWYG rich-text editor (rejected: heavier
than "simple formatting"); storing raw HTML (rejected: XSS risk, harder to keep
"simple").

## 10. Frontend framework

**Decision**: React 18 built with Vite to static assets, served by Express.

**Rationale**: The interaction set (live search, tag autocomplete, multi-select
with "select all matching", separate read-later/archive views, preferences)
benefits from component state; React + Vite is a standard, lightweight choice that
builds to static files needing no separate runtime server.

**Alternatives considered**: Vanilla JS (rejected: state management for bulk
selection/search becomes error-prone); Next.js/SSR (rejected: unnecessary server
complexity for a single-user local app).

## 11. Performance approach

**Decision**: Index FTS5 over the text fields and index the canonical URL key and
tag-join columns; paginate list responses (items-per-page from preferences);
execute bulk "select all matching" server-side by re-running the current query and
applying the action in a single transaction.

**Rationale**: Meets SC-002/SC-003/SC-005 at the 5,000-row scale without loading
the whole collection into the client; server-side bulk keeps large operations off
the wire.

**Alternatives considered**: Client-side filtering of the full dataset (rejected:
does not scale to 5,000+, breaks the <1s and 10s targets and "select all matching"
across pages).
