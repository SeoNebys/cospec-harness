# Phase 1 Data Model: Bookmark Manager

Derived from the Key Entities and Functional Requirements in [spec.md](./spec.md).
Storage engine: SQLite (see [research.md](./research.md) §2). Types are logical;
concrete column types shown for SQLite.

## Entities

### Bookmark

Represents one saved link and everything captured/authored about it.

| Field | Type | Notes / Rules |
|---|---|---|
| `id` | TEXT (uuid) PK | Stable id; also names the snapshot folder. |
| `url` | TEXT NOT NULL | Original address as entered/normalized (FR-004). |
| `url_key` | TEXT NOT NULL UNIQUE | Normalized duplicate key (FR-008); enforces no duplicates (FR-007). |
| `title_captured` | TEXT | Auto-captured title (FR-002); may be null on failure. |
| `title_user` | TEXT | User override; when present, wins for display (FR-003). |
| `description_captured` | TEXT | Auto-captured description (FR-002). |
| `description_user` | TEXT | User override; wins when present (FR-003). |
| `note_md` | TEXT | Lightweight markdown note (FR-018). |
| `favicon_path` | TEXT | Stored favicon reference (FR-002); null → placeholder. |
| `preview_image_path` | TEXT | Stored preview/OG image reference (FR-002). |
| `is_unread` | INTEGER (0/1) NOT NULL | Read-later state (FR-014). Default per save. |
| `is_archived` | INTEGER (0/1) NOT NULL DEFAULT 0 | Archive state (FR-015). |
| `snapshot_path` | TEXT | Self-contained HTML snapshot or retained PDF (FR-022). |
| `snapshot_kind` | TEXT | `html` \| `pdf` \| null. |
| `archive_org_url` | TEXT | Internet Archive snapshot reference (FR-023). |
| `capture_status` | TEXT NOT NULL | JSON: per-artifact state `pending`/`ready`/`failed` for metadata & snapshot (FR-005). |
| `date_added` | TEXT (ISO) NOT NULL | FR-027; import may set original date (FR-024). |
| `date_modified` | TEXT (ISO) NOT NULL | Updated on any edit (FR-027). |

**Derived display title**: `title_user ?? title_captured ?? deriveFromUrl(url)`
(FR-004). Same override pattern for description.

**State transitions**:
- Read state: `unread ⇄ read` via toggle (FR-014).
- Archive state: `active ⇄ archived` via archive/restore (FR-015). Archived rows
  are excluded from the normal list and default search (FR-009); shown only in the
  archive view or an explicit archived filter.

### Tag

| Field | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `name` | TEXT NOT NULL UNIQUE | Stored lowercased/trimmed; drives suggestions (FR-017). |

### BookmarkTag (join, many-to-many)

| Field | Type | Notes |
|---|---|---|
| `bookmark_id` | TEXT FK → Bookmark.id (ON DELETE CASCADE) | |
| `tag_id` | INTEGER FK → Tag.id (ON DELETE CASCADE) | |
| PK | (`bookmark_id`,`tag_id`) | A bookmark has 0..n tags (FR-016). |

### SavedView

| Field | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | |
| `name` | TEXT NOT NULL | Display name (FR-021). |
| `query` | TEXT | Advanced-search query string. |
| `include_tags` | TEXT (JSON array) | Tags that must be present. |
| `exclude_tags` | TEXT (JSON array) | Tags that must be absent. |
| `date_created` | TEXT (ISO) | |

Opening a view = run `query` combined with include/exclude tag constraints
(FR-021).

### Preferences (single row)

| Field | Type | Notes |
|---|---|---|
| `id` | INTEGER PK CHECK(id=1) | Single-user, one row (FR-026). |
| `default_sort` | TEXT | e.g. `date_added_desc` (FR-010 default). |
| `items_shown` | INTEGER | Items per page / density (FR-026). |
| `text_size` | TEXT | e.g. `small`/`medium`/`large` (FR-026). |

## Full-text search index (FTS5)

A contentless FTS5 virtual table `bookmark_fts(title, url, description, note)`
kept in sync with `Bookmark` via triggers (insert/update/delete). Search text
leaves compile to `bookmark_fts MATCH ?`; `#tag` leaves compile to
`EXISTS (SELECT 1 FROM bookmark_tag ... WHERE tag.name = ?)`. Boolean AST nodes
combine these with `AND` / `OR` / `AND NOT`. See
[contracts/search-grammar.md](./contracts/search-grammar.md).

Tokenization uses a case-insensitive tokenizer so search is case-insensitive
(FR-011). Note is indexed as raw markdown text (FR-018 searchable).

## Sorting

`default_sort` and the per-request sort accept at least: `date_added_desc`
(default), `date_added_asc`, `date_modified_desc`, `title_asc`, `title_desc`,
`unread_first` (FR-010).

## Validation rules (from requirements)

- `url` must be a well-formed http/https address after normalization; reject
  otherwise (FR-004). Whitespace-only title/url treated as empty (edge cases).
- Saving a `url_key` that already exists → return existing bookmark for edit, no
  insert (FR-007).
- Import merges on `url_key`; preserves title/tags/date_added (FR-024, SC-006).
- Malformed search query (unbalanced quotes/parens) → validation error surfaced
  to user (FR-013).
- Delete is permanent and confirmed (US4 acceptance; bulk delete FR-020); archive
  is reversible (FR-015).

## Relationships (summary)

```
Bookmark 1───n BookmarkTag n───1 Tag
Bookmark 1───1 (optional) snapshot file on disk
SavedView references Tag names (by value) + query string
Preferences: single global row
```
