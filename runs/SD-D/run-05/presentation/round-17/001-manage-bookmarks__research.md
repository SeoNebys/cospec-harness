# Phase 0 Research: Manage Bookmarks

This document records the key technical decisions, why each was chosen, and what
alternatives were weighed. All spec unknowns are resolved here; no
NEEDS CLARIFICATION items remain.

## Decision 1: Delivery form — installable desktop app

- **Decision**: Ship as a cross-platform **desktop application** (macOS, Windows,
  Linux) the user installs and opens like any other app.
- **Rationale**: The spec is explicit — single user, single device, no accounts,
  no sync, fully offline-capable, must store copies of pages locally. A desktop
  app installs once, keeps everything on the user's own disk, works offline, and
  needs no server or sign-in. It matches a non-technical user's expectation of
  "an app I open".
- **Alternatives considered**:
  - *Local web app (run a server on your machine)* — rejected: a non-technical
    user should not have to start a server or use a terminal.
  - *Hosted web service* — rejected: contradicts the no-accounts/no-sync/on-device
    scope and adds privacy and hosting concerns the user explicitly does not want.
  - *Browser extension* — rejected: constrained storage, awkward for saving full
    readable copies and PDFs, and harder to offer a rich management UI.

## Decision 2: Desktop shell — Electron

- **Decision**: Build the shell with **Electron** (web UI + Node.js backend in one
  installable app).
- **Rationale**: One codebase produces installers for all three platforms. Node's
  ecosystem has the most mature libraries for exactly our hard parts — readable
  content extraction (Mozilla Readability), HTML sanitizing, and bookmark-file
  parsing. A clean main/renderer split keeps logic testable.
- **Alternatives considered**:
  - *Tauri (Rust core)* — smaller binaries, but the best readable-extraction and
    bookmark-parsing libraries are in JavaScript; using them from Rust adds
    friction with no v1 benefit.
  - *Native per-platform (Swift/WinUI/GTK)* — three codebases; far more effort for
    a single-user tool.

## Decision 3: Data storage — local SQLite + a files folder

- **Decision**: Store structured data (bookmarks, tags, saved searches, settings)
  in a single **SQLite database file**; store saved copies (extracted article
  HTML and retained PDFs) as **files in a local folder** next to it.
- **Rationale**: SQLite is a battle-tested embedded database — no server, one
  file, fast at our scale, and supports full-text search natively (see Decision 5).
  Large binary/HTML blobs live better as plain files (easy to open, back up, and
  keep the database lean), with the database holding a reference to each file.
- **Alternatives considered**:
  - *Everything in the database (blobs included)* — rejected: bloats the DB and
    slows backups; files are simpler for large saved copies.
  - *Plain JSON files only* — rejected: no efficient search/filtering at 1,000+
    items; we would reinvent indexing.

## Decision 4: Readable copy & PDF capture — at save time, best-effort

- **Decision**: When a bookmark is saved, fetch the page and run **Mozilla
  Readability** to extract the article's readable content, sanitize it with
  **DOMPurify**, and store it as an HTML file. If the address serves a **PDF**
  (detected by content type / extension), download and **retain the PDF file**
  instead. If neither can be captured (login/paywall, non-article, unreachable),
  save the bookmark anyway and mark "no saved copy available".
- **Rationale**: Directly realizes FR-007/008/009 and the client's confirmed
  intent: the copy is taken *at the moment of saving* so it survives later
  changes/removal, and is viewable offline from local files. Readability is the
  proven engine behind browser reader modes. Sanitizing prevents stored pages
  from running anything unwanted when viewed.
- **Alternatives considered**:
  - *Full pixel-faithful page archive (save all assets/CSS/JS)* — explicitly out
    of scope for v1 (client chose reader-style). Much larger storage and
    complexity.
  - *Capture lazily/on-demand later* — rejected: the whole point is that the page
    may be gone later; capture must happen at save time.

## Decision 5: Search — SQLite full-text search (FTS5)

- **Decision**: Maintain a **full-text index** over each bookmark's title,
  description, note (as plain text), tags, and address. Support case-insensitive
  keyword search, **quoted exact-phrase** search, and **tag-scoped** search
  (keyword + one or two tags, including "either" of two tags). **Saved searches**
  are stored as named rows describing the keyword/phrase/tag/state criteria.
- **Rationale**: FTS5 gives fast, case-insensitive, phrase-aware search built into
  the same database — no extra search engine. Tag scoping combines the text match
  with tag membership. Storing saved searches as criteria (not frozen result
  lists) means reopening one always shows currently matching bookmarks (FR-023).
- **Alternatives considered**:
  - *In-memory scan/filter in the UI* — rejected: does not stay instant at scale
    and duplicates what the database does well.
  - *External search engine* — rejected: overkill for a single-user local app.

## Decision 6: Rich-text notes — stored as sanitized HTML with a plain-text shadow

- **Decision**: Edit notes with a lightweight rich-text editor (**TipTap**);
  store the note as **sanitized HTML** for faithful formatted read-back, and also
  keep a **plain-text projection** of the note used only for search indexing.
- **Rationale**: Satisfies FR-014 (bold, lists, links preserved and rendered).
  The plain-text shadow lets FR-018 search "inside" notes without matching HTML
  tags. Sanitizing keeps stored/rendered notes safe.
- **Alternatives considered**:
  - *Markdown* — viable, but a WYSIWYG editor is friendlier for a non-technical
    user; HTML render is direct.
  - *Plain text only* — rejected: the client specifically wants formatting to
    survive.

## Decision 7: Import/export — standard Netscape bookmarks HTML

- **Decision**: **Import** the standard "Netscape Bookmark File" HTML format that
  every major browser exports; add each entry, skipping addresses already present
  (one-per-address rule), showing progress and an added/skipped summary. **Export**
  the collection to the same portable HTML format (re-importable).
- **Rationale**: This is the universal browser bookmark interchange format, so the
  client's existing browser bookmarks import directly (onboarding requirement,
  FR-027–030), and export guarantees no lock-in. Metadata/readable-copy capture
  for imported items runs in the background so a 500+ import stays responsive.
- **Alternatives considered**:
  - *Custom JSON-only format* — rejected for import: the client's data is in
    browser format. (A richer JSON export that preserves notes/tags may be offered
    in addition, but HTML is the compatibility baseline.)

## Decision 8: Keeping the UI responsive — background work queue

- **Decision**: Saving returns immediately; **metadata fetch, readable-copy/PDF
  capture, and per-item import processing run in the background** in the main
  process, updating each bookmark as results arrive. The UI shows a pending/"saving
  copy…" state and never blocks (FR-006, SC-001, SC-007).
- **Rationale**: Network fetches and extraction can be slow or fail; they must not
  freeze the interface. A simple queued worker in the main process serializes
  fetches politely and reports progress to the UI.
- **Alternatives considered**:
  - *Synchronous save that waits for capture* — rejected: violates FR-006 and the
    15-second save target when a page is slow.

## Testing approach

- **Unit (Vitest)**: dedupe/one-per-address, search-query parsing (phrase, tag
  scoping), import mapping, tag-suggestion matching, note HTML sanitizing.
- **Integration (Vitest + real SQLite)**: full-text search results, saved-search
  round-trip, import→dedupe→export round-trip, capture writing/reading local files.
- **End-to-end (Playwright)**: save a bookmark and see auto-filled details; open a
  saved copy with the network disabled; batch-tag a selection; import a sample
  browser file and see the summary.
