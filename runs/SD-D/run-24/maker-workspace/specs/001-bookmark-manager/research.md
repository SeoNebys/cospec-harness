# Phase 0 Research: Bookmark Manager

Resolves the unknowns from the plan's Technical Context. Each item records the
decision, rationale, and the alternatives considered.

## 1. Application shape & runtime

**Decision**: One Node.js/TypeScript service (Express) that serves a REST API and
the compiled React/Vite SPA as static files, listening on `0.0.0.0:4000`.
`npm start` runs the prebuilt server; install + build happen before review.

**Rationale**: The scope is single-user and private, so no auth tier or
multi-host topology is needed. A single process with an embedded database is the
simplest thing that satisfies the review harness (one foreground start command,
one port). Node 24 and Chromium are already in the image.

**Alternatives considered**:
- Separate frontend host + backend API — extra port/process for no benefit at
  this scope; the harness expects a single app on port 4000.
- Full-stack framework (Next.js) — heavier build/runtime than needed; SSR gives
  little value for a private, data-driven tool.

## 2. Storage engine

**Decision**: Embedded SQLite via `better-sqlite3`, with an FTS5 virtual table
for full-text search. Preserved page copies stored as files under
`data/captures/`, referenced by path from the DB.

**Rationale**: Single-user local app → a file-based database is ideal (zero
server, transactional, durable across restarts per FR-032/SC-003). FTS5 gives
fast, case-insensitive text search over title/description/note/address at the
1,000–10,000 scale (SC-002). Binary captures (MHTML/PDF) do not belong in the
row store; files on disk keep the DB small and let the browser open copies
directly.

**Alternatives considered**:
- PostgreSQL/MySQL — needs a server process; overkill for one user.
- Storing captures as BLOBs — bloats the DB and complicates opening a copy in the
  browser; filesystem paths are simpler.
- JSON flat file — no indexed search, poor concurrency/durability.

## 3. Full-page single-file local copy

**Decision**: Capture pages as **MHTML** using Playwright's Chromium over the
Chrome DevTools Protocol `Page.captureSnapshot` (format `mhtml`). Store one
`.mhtml` file per bookmark. When the saved link is a PDF (by response
`Content-Type: application/pdf` or `.pdf`), download and store the **original
PDF** instead of an MHTML capture.

**Rationale**: MHTML is a single self-contained file that inlines HTML, CSS, and
images, reproducing the page's appearance offline — exactly matching the client's
Q4 choice (full-page, single file). Chromium is already installed and Playwright
1.61.0 is pinned to its revision. PDFs are best preserved as their original bytes.

**Alternatives considered**:
- `Page.printToPDF` snapshot — renders to PDF but loses interactive fidelity and
  reflow; MHTML preserves the DOM/appearance more faithfully.
- Single-file HTML via a bundler (e.g., monolith/SingleFile) — an extra external
  tool; CDP MHTML is built into the already-present Chromium.
- Saving raw HTML only — misses images/CSS, fails the "preserves appearance"
  requirement.

**Capture limit**: Enforce a **25 MB** cap per captured file (configurable). If a
capture exceeds it (or capture fails / page needs login), the bookmark is still
created and its local copy is marked `unavailable` (FR-028, edge cases).

## 4. Page metadata extraction

**Decision**: Fetch the page and parse HTML `<head>` for title, description
(`meta[name=description]` / `og:description`), preview image (`og:image` /
`twitter:image`), and site icon (`link[rel~=icon]`, falling back to
`/favicon.ico`). Reuse the Playwright page context where a plain fetch is blocked;
otherwise a lightweight HTTP fetch + `node-html-parser` is sufficient. All fields
are best-effort and editable (FR-003/FR-004/FR-005).

**Rationale**: OpenGraph/standard meta tags are the interoperable source for
title/description/preview; favicons via `<link rel=icon>` with the well-known
fallback cover site icons. Editable fields let the user correct fetched values.

**Alternatives considered**:
- Headless render for every save — slower and heavier; only needed when static
  fetch is blocked, so use it as a fallback.
- Third-party metadata API — adds an external dependency and privacy exposure for
  a private tool.

## 5. Rich search language

**Decision**: A custom **tokenizer + recursive-descent parser** produces a boolean
AST with node types: `AND`, `OR`, `NOT`, `Group`, `Tag(name)`, `Phrase(text)`,
`Term(text)`. Precedence: `NOT` > `AND` > `OR`; parentheses override; adjacent
terms without an explicit operator are implicitly `AND`. The tokenizer treats
`AND`/`OR`/`NOT` as operators only when **unquoted**; inside quotes they are
literal phrase text (spec FR-011, US4). The evaluator compiles the AST to a
SQLite `WHERE` predicate: `Term`/`Phrase` → FTS5 match over
title/description/note/address (case-insensitive); `Tag` → `EXISTS` against the
bookmark_tags join; `NOT` → `NOT (...)`. Archived bookmarks are excluded unless
the archive view is active. Malformed input yields a clear parse error, never a
crash or misleading result (FR-012).

**Rationale**: FTS5's own query syntax cannot express the exact requested
semantics (quoted operators-as-literals, `#tag` membership, custom precedence),
so a purpose-built parser over FTS primitives is the reliable path and is fully
unit-testable. SQLite evaluation scales to the target volume well within SC-002.

**Alternatives considered**:
- Use FTS5 query syntax directly — cannot honor "quoted AND/OR/NOT as literal"
  and `#tag` semantics; ambiguous error handling.
- In-memory filtering in JS — simpler but loses index scaling and duplicates DB
  logic; DB-side evaluation reuses FTS and joins.

## 6. Saved filters

**Decision**: Persist saved filters as a name + search expression + included-tags
set + excluded-tags set. Applying a filter ANDs the parsed search with
`has all included tags` and `has none of the excluded tags` (FR-016).

**Rationale**: Reuses the same parser/evaluator; included/excluded tags map to
the same tag-membership predicates, keeping one evaluation path.

**Alternatives considered**: Encoding tag include/exclude directly into the
search string — less discoverable and harder to edit in a dedicated UI.

## 7. Read-later, archive & bulk "apply to all matching"

**Decision**: `read` (boolean, default true = read) and `archived` (boolean)
flags on each bookmark. The read-later view lists `read = false`; the archive
view lists `archived = true`; the main list and ordinary search list
`archived = false`. Bulk actions accept either an explicit id set or a
"select-all-matching" flag; the latter re-runs the current search/filter
server-side and applies the action to the full matching set, excluding archived
items unless the archive view is active (FR-020/FR-021, SC-006).

**Rationale**: Simple boolean state matches the client's Q2 decision (new saves
are read; read-later is opt-in). Server-side re-evaluation guarantees bulk actions
cover matches beyond the current page.

**Alternatives considered**: A separate "collections/queue" table — unnecessary;
boolean flags are sufficient and keep queries simple.

## 8. Duplicate detection (URL normalization)

**Decision**: Compute a `normalized_url` per the client's Q1 choice: lowercase
scheme + host, drop a leading `www.`, unify `http`/`https`, remove a trailing
slash, strip common tracking params (`utm_*`, `fbclid`, `gclid`, `mc_eid`,
`igshid`, …); keep the path and all other query parameters significant. Enforce
uniqueness on `normalized_url`; saving an existing one opens that bookmark
(FR-006).

**Rationale**: Matches the agreed light normalization; storing the normalized
form lets a UNIQUE index do duplicate detection cheaply and deterministically.

**Alternatives considered**: Normalizing at query time — repeated work and no DB
uniqueness guarantee; aggressive stripping of all params — rejected by the client.

## 9. Import / export (Netscape bookmark HTML)

**Decision**: Parse/generate the Netscape Bookmark File format. On export, write
`<A HREF ADD_DATE TAGS="tag1,tag2">Title</A>`; on import, read `HREF`, `ADD_DATE`
(→ saved date), and the `TAGS` attribute (comma-separated). Missing tags/dates
fall back to defaults (import time as saved date). Import merges
non-destructively into existing bookmarks by `normalized_url` per the client's Q3
choice: union tags, keep the earliest saved date, preserve existing
title/description/note, fill only empty fields (FR-029/030/031, SC-008).

**Rationale**: The `TAGS` attribute is the de-facto convention (Firefox/Pocket)
and keeps a flat multi-tag set intact through a round-trip without folder
duplication (client Q5). Non-destructive merge protects user-authored content.

**Alternatives considered**: Folder-per-tag mapping — duplicates multi-tag
bookmarks and creates round-trip duplicates; JSON export — not the requested
interoperable format.

## 10. Markdown notes (safe rendering)

**Decision**: Store raw Markdown; render with `markdown-it` and sanitize output
with `DOMPurify` before display, stripping scripts/embedded active content
(FR-007, edge case "Markdown safety"). Note text is included in the FTS index so
it is searchable (US7).

**Rationale**: `markdown-it` is a well-tested renderer; sanitizing the rendered
HTML guarantees no active content executes, independent of Markdown quirks.

**Alternatives considered**: Trusting the renderer's own escaping — insufficient
against raw-HTML-in-Markdown; a bespoke renderer — needless risk.

## 11. Internet Archive integration

**Decision**: Query the Wayback availability API
(`https://archive.org/wayback/available?url=<url>`) to offer the latest snapshot
link; when none exists, indicate so and offer to submit the page for archiving
(`https://web.archive.org/save/<url>`). Treated as best-effort: if the service is
unreachable, show that the archive copy is currently unavailable (FR-027, edge
cases). This external dependency and any unavailability are reported honestly.

**Rationale**: The availability API is the documented way to find snapshots; save
is the standard submission endpoint. Both require outbound internet, which may be
restricted in the review container — hence best-effort with honest degradation.

**Alternatives considered**: Bundling our own archiving — out of scope; the local
MHTML copy already covers offline durability, so Internet Archive is
complementary.

## 12. Display preferences & readable list

**Decision**: Persist a single preferences record: default sort (saved-date
new/old, title A–Z/Z–A, recently-updated), page size (items per view), and text
size. The list emphasizes readability, showing title, description, tags, and site
icon per bookmark (FR-008/FR-033).

**Rationale**: One small settings record is enough for a single user; applying it
on load satisfies US14 persistence.

**Alternatives considered**: Per-view preferences — more than the spec asks for
in v1.

## Resolved unknowns summary

| Unknown (from Technical Context) | Resolution |
|----------------------------------|------------|
| Full-page single-file format | MHTML via Chromium CDP `Page.captureSnapshot`; PDFs kept as original |
| Search engine / semantics | Custom parser → boolean AST → SQLite FTS5 + tag joins |
| Storage | SQLite (better-sqlite3) + FTS5; captures as files on disk |
| Metadata extraction | Fetch + parse OG/meta/favicon; Playwright fallback |
| Markdown safety | markdown-it + DOMPurify sanitize |
| Local-copy size limit | 25 MB cap (configurable); oversize → copy unavailable |
| Internet Archive behavior | Wayback availability + save; best-effort, honest degradation |
| Duplicate normalization | Stored `normalized_url` with UNIQUE index |
| Import merge | Non-destructive merge by normalized URL |
| Scale | 1,000–10,000 bookmarks; SQLite/FTS well within targets |
