# Contract: Bookmark Operations (UI ↔ core)

These are the named operations the interface calls to save and manage bookmarks.
Each lists its inputs, outputs, and the rules it must uphold, traced to
functional requirements. (This is a behavioral contract, not final code.)

## saveBookmark

- **Input**: `url` (text), optional `title`, optional `description`.
- **Behavior**:
  - Validate `url` is a well-formed http/https address; if not → return
    `{ ok: false, error: "invalid-url", message }` (FR-002).
  - If a bookmark with this `url` already exists → return
    `{ ok: true, duplicate: true, bookmark }` so the UI opens the existing one
    for editing; **no second record is created** (FR-017, SC-011).
  - Otherwise create the bookmark (active, unread), immediately return
    `{ ok: true, bookmark }`, and **enqueue background capture** of metadata,
    favicon, and saved copy (FR-003, FR-006, Decision 8).
- **Output**: created or existing bookmark record.

## updateBookmark

- **Input**: `id`, any of `title`, `description`, `url`, `note_html`.
- **Behavior**: Persist edits; keep `note_text` in sync from `note_html` for
  search; update `updated_at`. Editing `url` to one that already exists is
  rejected as a duplicate (FR-004, FR-010, FR-013, FR-014, FR-017).
- **Output**: updated bookmark.

## setReadState / setArchivedState

- **Input**: `id`, `value` (boolean).
- **Behavior**: Toggle `is_read` (FR-031) or `is_archived` (FR-016). Archiving is
  reversible via restore (set archived = false).
- **Output**: updated bookmark.

## deleteBookmark

- **Input**: `id`, `confirmed` (boolean).
- **Behavior**: Requires `confirmed = true` (accidental-deletion guard, FR-015).
  Permanently removes the bookmark, its tag links, and its saved-copy files.
- **Output**: `{ ok: true }`.

## openOriginal

- **Input**: `id`.
- **Behavior**: Open the bookmark's `url` in the user's **default browser**
  (FR-012). (Distinct from viewing the saved copy — see capture-operations.)
- **Output**: `{ ok: true }`.

## listBookmarks

- **Input**: `view` (`active` | `archived`), `sort` (`newest` | `oldest` | `title`).
- **Behavior**: Return bookmarks for the chosen view in the chosen order; the
  chosen sort is remembered as a Setting (FR-008, FR-011, FR-032). Returns an
  empty result the UI renders as an empty state (FR-033).
- **Output**: ordered list of bookmark summaries (title, description, favicon,
  tags, read/archived state, copy status).

## Tag operations

- **assignTags(id, tagNames[])** / **removeTag(id, tagName)**: attach/detach tags,
  creating tags on first use (FR-019).
- **suggestTags(prefix)**: return existing tag names matching the typed prefix, to
  encourage reuse over near-duplicates (FR-022).
