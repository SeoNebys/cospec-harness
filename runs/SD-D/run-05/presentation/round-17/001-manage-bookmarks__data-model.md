# Phase 1 Data Model: Manage Bookmarks

All data is stored locally on the user's device in a single SQLite database, plus
a local files folder for saved copies. This document describes the entities,
their fields, relationships, and rules. It maps directly to the spec's Key
Entities and Functional Requirements.

## Entity: Bookmark

The central record: one saved web page (or PDF).

| Field | Type | Notes / Rules |
|-------|------|---------------|
| `id` | text (UUID) | Primary key |
| `url` | text | The web address. **Unique across the collection** (FR-017). Validated as a well-formed http/https address before save (FR-002). |
| `title` | text | Auto-fetched, user-editable; falls back to site name or the address when unavailable (FR-003/004/005). Never empty when displayed (SC-011). |
| `description` | text | Short summary, auto-fetched, user-editable (FR-003/004). |
| `favicon_path` | text (nullable) | Local file reference to the saved site icon (FR-003). |
| `note_html` | text (nullable) | Personal note as **sanitized HTML** (bold, lists, links preserved) (FR-014). |
| `note_text` | text (nullable) | Plain-text projection of the note, used only for search (FR-018). |
| `is_read` | boolean | `false` = unread / "read later"; `true` = read (FR-031). Defaults per Decision. |
| `is_archived` | boolean | `false` = active (main list); `true` = archived/set aside (FR-016). |
| `saved_copy_id` | text (nullable) | Reference to the associated Saved Copy, or null when none was captured (FR-009). |
| `created_at` | timestamp | When the bookmark was saved (FR-034; recency sort). |
| `updated_at` | timestamp | When last modified (FR-034). |

**Rules & relationships**:

- Exactly **one bookmark per `url`** — enforced by a unique constraint; on a
  save collision the app opens the existing bookmark instead of inserting
  (FR-017, SC-011). The same rule governs import (FR-028).
- A bookmark has **many Tags** (via `bookmark_tags`).
- A bookmark has **zero or one Saved Copy**.
- Deleting a bookmark is permanent and also removes its tag links and its saved
  copy files (FR-015). Archiving only flips `is_archived` (reversible, FR-016).

**State transitions**:

```text
            save (capture runs in background)
   (none) ─────────────────────────────────▶ Active, unread, copy pending
Active  ──mark read/unread──▶ Active (is_read toggled)
Active  ──archive──▶ Archived ──restore──▶ Active
Active/Archived ──delete (confirmed)──▶ (removed permanently, files deleted)

Copy capture (background):  pending ──▶ captured  |  ──▶ unavailable
```

## Entity: Saved Copy

A preserved rendition captured **at save time** so content survives if the
original page changes or disappears (FR-007/008/009).

| Field | Type | Notes / Rules |
|-------|------|---------------|
| `id` | text (UUID) | Primary key |
| `bookmark_id` | text | Owning bookmark (one-to-one) |
| `kind` | text | `reader` (extracted article HTML) or `pdf` (retained PDF file) (FR-007/008). |
| `file_path` | text | Local file holding the sanitized reader HTML or the PDF. |
| `status` | text | `pending`, `captured`, or `unavailable` (FR-009; background capture, Decision 8). |
| `captured_at` | timestamp (nullable) | When the copy was successfully stored. |

**Rules**:

- Reader HTML is **sanitized** before storage and before display (Decision 4/6).
- Viewable **offline** — served from the local file, never re-fetched (SC-003, FR-007).
- `unavailable` records the "no saved copy" case shown to the user (FR-009).

## Entity: Tag

A short user-defined keyword grouping bookmarks.

| Field | Type | Notes / Rules |
|-------|------|---------------|
| `id` | text (UUID) | Primary key |
| `name` | text | Unique (case-insensitive). Reuse is encouraged via suggestions during entry to avoid near-duplicates like "recipe"/"recipes" (FR-022). |

**Relationships**:

- Many-to-many with Bookmark via **`bookmark_tags`** (`bookmark_id`, `tag_id`).
- Clicking a tag filters the collection to it (FR-019). Search can be scoped to
  one or two tags, including "either of two" (FR-021).
- A tag with no remaining bookmarks may be pruned or kept for reuse (kept, so it
  still appears in suggestions).

## Entity: Saved Search

A named, reusable search/filter definition (stored as **criteria**, not frozen
results, so reopening reflects the current collection) (FR-023).

| Field | Type | Notes / Rules |
|-------|------|---------------|
| `id` | text (UUID) | Primary key |
| `name` | text | User-given name (e.g. "unread recipes"). |
| `keywords` | text (nullable) | Free-text/phrase criteria (phrases in quotes = exact) (FR-020). |
| `tag_filter` | text (nullable) | One or two tag names, with an "or" option between two (FR-021). |
| `unread_only` | boolean | Restrict to unread (FR-031). |
| `include_archived` | boolean | Whether archived items are included. |
| `created_at` | timestamp | For listing order. |

## Entity: Setting (key–value)

Small app preferences remembered between sessions.

| Key | Meaning |
|-----|---------|
| `sort_order` | Current collection sort: `newest`, `oldest`, or `title` — remembered for next visit (FR-032). |
| `data_dir` | Location of the database and saved-copy files (informational). |
| `schema_version` | For migrations. |

## Full-Text Search Index

A dedicated FTS index (Decision 5) covering, per bookmark: `title`,
`description`, `note_text`, joined `tag` names, and `url`. Powers FR-018
(case-insensitive keyword across all fields), FR-020 (quoted exact phrase), and,
combined with `bookmark_tags`, FR-021 (tag-scoped search). Optionally also
indexes reader-copy text so users can find a bookmark by words inside the saved
article (nice-to-have; confirmed cheap with FTS).

## Relationship summary

```text
Bookmark 1───1 SavedCopy        (a bookmark may have zero or one)
Bookmark *───* Tag              (via bookmark_tags)
SavedSearch  (independent; defines criteria evaluated against Bookmarks)
Setting      (independent key–value)
```

## Validation & integrity rules (traceability)

- **FR-002**: `url` must be a well-formed http/https address; invalid → rejected with guidance.
- **FR-017 / SC-011**: `url` unique; duplicate save routes to the existing record.
- **SC-011**: displayed `title` is never empty (fallback applied).
- **FR-014 / FR-018**: `note_html` sanitized; `note_text` kept in sync for search.
- **FR-007–009**: every bookmark has a Saved Copy row that is `pending` → `captured`/`unavailable`.
- **FR-016**: archive is reversible; **FR-015**: delete is permanent and cascades to tags-links + copy files.
