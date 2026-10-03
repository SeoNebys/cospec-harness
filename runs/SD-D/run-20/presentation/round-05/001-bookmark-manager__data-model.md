# Data Model: Bookmark Manager

**Date**: 2026-09-25  
**Storage**: SQLite 3.53+ with foreign keys and WAL enabled

## Conventions

- Internal integer primary keys keep joins and FTS row IDs compact. Public API identifiers are immutable UUID strings.
- Timestamps are UTC ISO-8601 strings with millisecond precision.
- Enum-like text columns use `CHECK` constraints.
- All writes that affect bookmarks, tags, joins, media ownership, or search text occur in one database transaction.
- User-facing text is stored as Unicode. Normalized comparison values are stored separately where equality rules differ from display.
- Every migration has a monotonically increasing version and runs once before the server accepts traffic.

## Persistent entities

### Bookmark

Represents one saved web address.

| Field | Type | Rules |
|---|---|---|
| `id` | INTEGER | Primary key; also the FTS row ID |
| `public_id` | TEXT | UUID; unique; immutable; exposed by the API |
| `url` | TEXT | User-facing HTTP(S) URL; 1–2,048 characters |
| `normalized_url` | TEXT | Canonical duplicate key; unique across all lifecycle states |
| `title` | TEXT | Required after retrieval/fallback; 1–200 readable characters |
| `description` | TEXT nullable | Retrieved or edited page description; maximum 500 characters |
| `note_document` | TEXT nullable | Serialized, server-validated rich-note JSON |
| `note_text` | TEXT | Plain readable text derived from `note_document`; maximum 5,000 characters |
| `lifecycle_state` | TEXT | `active` or `archived`; default `active` |
| `reading_state` | TEXT | `none`, `unread`, or `read`; default `none` |
| `metadata_status` | TEXT | `complete`, `partial`, `failed`, `skipped`, or `fallback` |
| `icon_asset_id` | INTEGER nullable | Foreign key to `media_assets`; `SET NULL` if asset is removed |
| `preview_asset_id` | INTEGER nullable | Foreign key to `media_assets`; `SET NULL` if asset is removed |
| `created_at` | TEXT | Set once on save |
| `updated_at` | TEXT | Updated on any persisted bookmark change |
| `archived_at` | TEXT nullable | Set on archive; cleared on restore |

Indexes and constraints:

- Unique index on `public_id`.
- Unique index on `normalized_url` so an archived bookmark still blocks a duplicate.
- Index on `(lifecycle_state, created_at DESC, id DESC)`.
- Index on `(lifecycle_state, reading_state, created_at DESC, id DESC)`.
- Index on `(lifecycle_state, title COLLATE NOCASE, id)`.
- Checks enforce text limits and legal enum values.

URL normalization:

1. Trim surrounding whitespace and parse with the platform URL parser.
2. Require `http:` or `https:` and a non-empty hostname.
3. Lowercase scheme and hostname, remove the fragment, remove the default port, and normalize an empty path to `/`.
4. Preserve path/query semantics; do not reorder query parameters or remove marketing parameters because that can change resource identity.
5. Serialize the result as `normalized_url`. Preserve a clean serialization of the submitted address as `url`.

### Tag

Represents one reusable label.

| Field | Type | Rules |
|---|---|---|
| `id` | INTEGER | Primary key |
| `public_id` | TEXT | UUID; unique; exposed by suggestion responses |
| `label` | TEXT | Display label chosen on first creation; 1–30 characters |
| `normalized_label` | TEXT | Trimmed, whitespace-collapsed, Unicode-normalized, case-folded label; unique |
| `created_at` | TEXT | Creation timestamp |

Suggestion behavior:

- Compare the case-folded input against `normalized_label`.
- Exclude tags already linked to the bookmark being edited.
- Rank `starts-with` matches before `contains` matches, then sort by display label case-insensitively and internal ID for a stable tie-break.
- Return at most eight suggestions per request.
- Creating a label with an existing normalized value reuses the existing tag row.

### BookmarkTag

Many-to-many relationship between bookmarks and tags.

| Field | Type | Rules |
|---|---|---|
| `bookmark_id` | INTEGER | Foreign key to `bookmarks`; cascade on deletion |
| `tag_id` | INTEGER | Foreign key to `tags`; cascade on deletion |
| `created_at` | TEXT | When the tag was attached |

The composite primary key is `(bookmark_id, tag_id)`. A bookmark may have at most 20 relationships. Orphan tags are retained so autocomplete continues to suggest labels the user used previously; permanent tag-management is outside this release.

### MediaAsset

Represents one locally cached metadata image, never a page snapshot.

| Field | Type | Rules |
|---|---|---|
| `id` | INTEGER | Primary key |
| `public_id` | TEXT | UUID; unique; used in media URLs |
| `content_hash` | TEXT | SHA-256 of accepted bytes; unique with `media_type` |
| `media_type` | TEXT | Allowlisted raster or icon MIME type |
| `byte_length` | INTEGER | Greater than zero and no more than 2 MiB |
| `relative_path` | TEXT | Generated path beneath `data/assets`; unique; never client-supplied |
| `state` | TEXT | `temporary` or `claimed` |
| `expires_at` | TEXT nullable | Required for temporary assets |
| `created_at` | TEXT | Creation timestamp |

Allowed media types: PNG, JPEG, WebP, GIF, AVIF, and ICO. SVG and HTML are rejected. Assets are deduplicated by content hash. A cleanup job removes expired temporary assets and claimed assets with no bookmark or live preview references; database references are reconciled before deleting files.

### MetadataPreview

A short-lived server-side result produced before bookmark creation or an address-changing edit.

| Field | Type | Rules |
|---|---|---|
| `id` | INTEGER | Primary key |
| `public_id` | TEXT | Opaque UUID preview token; unique |
| `requested_url` | TEXT | Clean submitted URL |
| `normalized_url` | TEXT | Duplicate key calculated during preview |
| `final_response_url` | TEXT nullable | Final public URL after safe redirects; diagnostic only |
| `title` | TEXT | Retrieved or generated fallback title; maximum 200 characters |
| `description` | TEXT nullable | Retrieved description; maximum 500 characters |
| `icon_asset_id` | INTEGER nullable | Foreign key to a temporary media asset |
| `preview_asset_id` | INTEGER nullable | Foreign key to a temporary media asset |
| `status` | TEXT | `complete`, `partial`, `failed`, `skipped`, or `fallback` |
| `warnings_json` | TEXT | JSON string array of safe user-facing warning codes/messages |
| `created_at` | TEXT | Creation timestamp |
| `expires_at` | TEXT | Fifteen minutes after creation |

Saving a bookmark with a valid preview token copies eligible preview values, applies user edits, and changes referenced assets to `claimed` in the same transaction. An expired or mismatched token cannot contribute fetched media; saving remains possible after duplicate and input validation by regenerating the title from the URL.

### BookmarkSearch (FTS5 virtual table)

Materialized searchable text keyed by `rowid = bookmarks.id`.

| Column | Source |
|---|---|
| `title` | Bookmark title |
| `url` | User-facing URL |
| `description` | Bookmark description or empty string |
| `note_text` | Derived readable note text |
| `tags_text` | Space-separated display labels linked to the bookmark |

Use the Unicode tokenizer with diacritic removal. Application services replace the row after bookmark or tag changes inside the same transaction. A migration/maintenance command can rebuild all FTS rows from canonical tables and verify row counts.

### SchemaMigration

Tracks applied SQL migrations.

| Field | Type | Rules |
|---|---|---|
| `version` | INTEGER | Primary key; monotonically increasing |
| `name` | TEXT | Human-readable migration name |
| `applied_at` | TEXT | Completion timestamp |

## Transient client entity

### Selection

Selection is not persisted.

| Field | Type | Rules |
|---|---|---|
| `bookmark_ids` | Set of UUIDs | Explicitly selected visible results; maximum 100 per submitted action |
| `context_key` | String | Derived from view, query, tag filters, and sort context |

Changing the current view or beginning a different search invalidates the context key and clears the selection. Sorting alone may retain selection because the same result set remains visible; pagination/navigation must never act on unselected hidden IDs.

## Rich-note document rules

The root is a Tiptap/ProseMirror-style `doc` with `content`. Allowed nodes are `doc`, `paragraph`, `text`, `bulletList`, `orderedList`, and `listItem`. Allowed marks are `bold`, `italic`, and `link`.

- Unknown nodes, marks, attributes, or malformed nesting are rejected.
- Link marks require an absolute `http:` or `https:` URL and add safe external-link behavior at render time.
- Derived `note_text` uses paragraph/list boundaries as spaces or newlines and is the value counted for the 5,000-character limit and indexed for search.
- Empty documents normalize to `NULL` plus empty `note_text`.

## State transitions

### Bookmark lifecycle

```text
active ──archive──> archived ──restore──> active
                         └──confirmed permanent delete──> removed
```

- Permanent deletion from `active` is rejected.
- Archive sets `archived_at`; restore clears it.
- Reading state, text, tags, and media references are unchanged by archive/restore.
- Deleted bookmarks cascade their tag joins and search row; unreferenced cached media is garbage-collected after commit.

### Reading state

```text
none ──mark unread──> unread ──mark read──> read
  └────mark read──────────────────────────> read
read ──mark unread──> unread
```

Opening a destination never causes a transition. Archiving preserves the state. The unread view is the intersection of `lifecycle_state = active` and `reading_state = unread`.

### Metadata preview

```text
pending ──success──> complete
    ├────some unavailable──> partial
    ├────recoverable failure──> failed/fallback
    └────policy-blocked fetch──> skipped/fallback
```

All terminal states permit saving if the URL itself is valid and not a duplicate. Pending work is cancelled when the form URL changes or the user closes the draft.

## Transaction boundaries

- **Create**: validate/normalize → duplicate check → resolve/create tags → insert bookmark → attach tags → claim preview assets → insert FTS row → commit.
- **Edit**: load bookmark → validate optimistic current state → duplicate check if URL changed → update bookmark/tags/assets → replace FTS row → commit.
- **Bulk tag/read/archive/restore**: resolve all explicit IDs → evaluate per-item eligibility → apply valid mutations and FTS changes → commit → return changed/unchanged/failed groups.
- **Permanent delete**: require archive state and confirmation → remove bookmarks and joins/search rows → commit → asynchronously reconcile media files.
- Any database failure rolls back the entire SQL transaction. Expected per-item ineligibility is reported without turning valid items into failures, matching the completion-summary requirement.
