# Phase 0 Research: Bookmark Manager

Decisions that resolve the plan's open questions, most-consequential first. The
two items the client explicitly asked to be flagged (export fidelity,
saved-search effort) are called out as **⚑ CLIENT DECISION**.

## 1. Application shape — why a local backend, not a pure browser app

- **Decision**: Local web app = a small backend on the user's machine serving a
  browser UI at `localhost`.
- **Rationale**: Three requirements are impossible or unreliable in a pure
  in-browser app: (a) **metadata capture** (FR-003) — browsers block reading
  arbitrary third-party pages via cross-origin rules; a backend fetch avoids
  this; (b) **file import/export** (FR-014/015) — reading a chosen file and
  writing an export is cleaner and more reliable server-side; (c) **persistence**
  (FR-012) of a growing indexed collection. All stays local; the backend binds
  to localhost only.
- **Alternatives considered**: *Browser-only + IndexedDB* — rejected: cannot
  fetch page metadata (the core "recognisable at a glance" value) and file access
  is clumsy. *Desktop shell (Electron/Tauri)* — deferred: adds packaging weight;
  a localhost app meets "just me, on my own device" without it. Can be wrapped
  later without changing the model.

## 2. Storage — SQLite

- **Decision**: One SQLite file in the OS per-user data directory.
- **Rationale**: Indexed search/multi-tag filtering stays fast at 1,000+
  bookmarks; transactional bulk actions; zero-config, single-file (easy to back
  up). Matches single-user local scope.
- **Alternatives**: JSON/flat file — rejected: whole-file rewrites and linear
  scans get slow and risk corruption on bulk writes.

## 3. Metadata capture (title, site icon, description) — FR-003

- **Decision**: Backend fetches the page with a short (~3 s) timeout, parses
  `<title>`, OpenGraph/`meta[name=description]`, and the favicon
  (`<link rel="icon">`, fallback `/favicon.ico`). Saving **never waits**: the
  bookmark is stored immediately (title falling back to the address), then
  enriched asynchronously when/if metadata returns.
- **Rationale**: Satisfies "best-effort, never blocks saving" and the
  unreachable-page edge case. Site icons are cached locally so the list renders
  without per-item network calls.
- **Alternatives**: Third-party metadata/preview API — rejected: sends the
  user's browsing to an external service, breaking the "all local" principle.

## 4. ⚑ CLIENT DECISION — Export fidelity vs. the standard bookmark file

**The concern (client)**: export should carry **tags** and ideally **notes**, so
organising work is not lost when moving the collection out (FR-015).

**What the standard format can and cannot hold** — the universal browser format
is the *Netscape Bookmark File* (the HTML file every browser imports/exports).
Verified capabilities:

| Data | In the standard file? | Notes |
|------|----------------------|-------|
| Address, title | ✅ Yes | Core fields. |
| Original date added | ✅ Yes (`ADD_DATE`) | So import preserves dates and export re-emits them. |
| Site icon | ✅ Yes (`ICON`) | Can be embedded. |
| **Tags** | ⚠️ Partial | A `TAGS="a,b"` attribute exists (Firefox reads it; our own re-import reads it perfectly). Chrome/Safari ignore it. To stay portable we **also mirror tags as folders**, since folders are universal. |
| **Notes (formatted)** | ⚠️ Lossy | A `<DD>` description field carries *plain text*. Bold/lists/links flatten to text; app-only fields (read/unread, archived, saved searches) have nowhere to live. |

**Recommendation (needs your call)**: offer **two export choices**:

- **A. Standard browser file (`.html`)** — maximum portability into any browser.
  Tags travel as folders + a `TAGS` attribute; notes travel as plain text;
  read/unread & archived are not represented. *Some fidelity loss, by nature of
  the format.*
- **B. Full backup (`.json`)** — our own format. **Loses nothing**: tags,
  formatted notes, read/unread, archived, dates, saved searches — perfect
  round-trip back into this app.

Building both is low extra cost (they share the same data-gathering step), so the
plan assumes **both** unless you say otherwise. **Your call at the plan gate:**
both / HTML-only / JSON-only, and whether the HTML tags-as-folders + `TAGS`
approach is acceptable given other browsers may only see folders.

- **Decision (pending confirmation)**: Import = Netscape HTML (folders→tags,
  `ADD_DATE`→date, de-dupe). Export = **both** HTML (portable, lossy) and JSON
  (lossless). SC-008 ("re-import with no loss of tags") is met by the JSON path;
  the HTML path meets it too for apps/browsers that honour `TAGS`.

## 5. ⚑ CLIENT DECISION — Saved searches: the honest effort read (FR-019)

- **Honest read**: **Low effort — recommend keeping it.** A saved search is just
  a stored name plus the same filter values the UI already produces (keyword,
  included tags, excluded tags, unread flag). It adds one small table and two
  endpoints (save, list/apply); the filtering logic already exists for live
  search, so applying a saved search reuses it. No new data model concepts.
  Estimated ~half a day, isolated from everything else.
- **Recommendation**: keep it, at its P3 priority (built last, so if anything
  slips it's the first to drop with zero impact on the rest).
- **Your call at the plan gate**: keep (default) or drop. If dropped, FR-019,
  the SavedSearch entity, and User Story 7 come out cleanly; nothing else changes.

## 6. Search semantics — FR-009/010

- **Decision**: Parse the query: substrings in double quotes are exact-phrase
  matches; bare words are case-insensitive substring matches across title,
  address, description, notes, and tag names. Tag filter is structured
  (not free text): a set of **included** tags (match any / OR) and a set of
  **excluded** tags (NOT), combinable with the keyword query (AND between the
  keyword result and the tag filter). Case-insensitivity via normalised
  comparison.
- **Rationale**: Directly implements scenarios 1, 2, 10, 11 and search-within-a-
  tag; keeps the query language tiny and predictable.
- **Alternatives**: Full boolean query language — rejected as over-scoped for a
  personal tool.

## 7. Tag normalisation & suggestions — FR-004a

- **Decision**: Tags are stored case-insensitively unique (canonical form). As
  the user types, the backend returns existing tags matching the prefix;
  selecting one reuses it. Prevents "recipe"/"Recipes"/"Recipe" drift.
- **Rationale**: Implements FR-004a and the client's stated worry directly.

## 8. Rich notes — FR-004b

- **Decision**: Notes stored as **Markdown** (bold, lists, links cover the
  client's examples); displayed rendered read-only, edited as Markdown with a
  small toolbar. Markdown is plain text, so it round-trips cleanly and is safe to
  store.
- **Rationale**: Faithful "laid out, not a blob" display with minimal complexity;
  degrades to readable plain text in the HTML export.
- **Alternatives**: Full WYSIWYG/HTML rich text — rejected: heavier, and storing
  arbitrary HTML raises sanitisation burden for a personal tool.

## 9. Bulk actions incl. "select everything matching" — FR-018

- **Decision**: Bulk endpoints accept **either** an explicit list of bookmark ids
  **or** the current filter/search criteria ("apply to all matching"). Server
  resolves the criteria to the target set and applies the action in one
  transaction. Delete-all-matching still requires one confirmation.
- **Rationale**: Avoids shipping 600 ids from the client and makes "archive the
  whole filtered set" a single fast operation (SC-009).

## 10. Testing approach

- **Decision**: pytest for backend units (metadata parse, Netscape parse, query
  parsing, dedupe) and API integration against a temp DB; Playwright E2E driving
  the quickstart scenarios end to end.
- **Rationale**: Every FR has an automatable acceptance check.
