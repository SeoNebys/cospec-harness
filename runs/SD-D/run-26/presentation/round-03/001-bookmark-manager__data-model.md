# Data Model: Bookmark Manager

**Date**: 2026-09-27  
**Storage**: SQLite with foreign keys and append-only migrations

## Conventions

- IDs are application-generated UUID strings so API identifiers never expose row order.
- Timestamps are UTC ISO-8601 strings with millisecond precision. Browser HTML timestamps are converted to and from Unix seconds at the boundary.
- Booleans are constrained SQLite integers (`0` or `1`).
- Text size limits are enforced before persistence and repeated as database checks where practical.
- `url_key` is the serialized WHATWG HTTP(S) URL after trimming surrounding whitespace. It preserves path, query, and fragment and performs no tracking-parameter, redirect, or canonical-page rewriting.
- Search shadows use Unicode NFKC normalization plus locale-independent case folding. Note search text is extracted from the CommonMark AST so formatting punctuation is not indexed.
- All user-controlled SQL values are bound parameters. Dynamic SQL is limited to server-owned column/operator fragments selected from enums.

## Entity Relationship Overview

```text
Bookmark 1 ─── 0..1 IconAsset
    │
    ├── * BookmarkTag * ── 1 Tag
    │
    └── * MetadataJob

ImportBatch 1 ─── * ImportEntry

OwnerSession       (single-owner authentication; no User entity)
SchemaMigration    (database lifecycle)
```

`Selection` and metadata proposals are request/client state rather than durable domain entities. Import previews are durable because confirmation may occur in a later request and must survive a process restart.

## Bookmark

| Field | Type | Rules |
|---|---|---|
| `id` | text | Primary key, UUID |
| `url` | text | Required display/original serialized HTTP(S) URL |
| `url_key` | text | Required, unique with binary comparison across active and archived rows |
| `title` | text/null | Maximum 300 Unicode scalar values; null means display `url` |
| `description` | text/null | Page description, maximum 2,000 scalar values |
| `note_markdown` | text | Default empty; maximum 50,000 scalar values; CommonMark source |
| `icon_asset_id` | text/null | Foreign key to `icon_assets.hash`, `ON DELETE SET NULL` |
| `icon_choice` | enum text | `automatic`, `removed`, or `imported`; controls refresh defaults |
| `title_origin` | enum text | `metadata`, `user`, `import`, or `fallback` |
| `description_origin` | enum text | `metadata`, `user`, `import`, or `none` |
| `is_read` | integer | `0` unread by default; `1` read |
| `archived_at` | text/null | Null means active; timestamp means archived |
| `metadata_status` | enum text | `idle`, `pending`, `complete`, `partial`, `failed`, or `blocked` |
| `metadata_fetched_at` | text/null | Last successful or partial fetch completion |
| `metadata_error_code` | text/null | Stable non-sensitive category, never a raw remote response |
| `created_at` | text | Required, immutable saved timestamp |
| `updated_at` | text | Required; changes on confirmed bookmark/tag/status edits |
| `search_title` | text | Normalized title/display label shadow |
| `search_url` | text | Normalized URL shadow |
| `search_description` | text | Normalized description shadow |
| `search_note` | text | Normalized visible note text shadow |

### Derived values

- `display_label = title` when nonblank, otherwise `url`.
- `status = archived` when `archived_at` is non-null, otherwise `active`.
- The active unread collection is `archived_at IS NULL AND is_read = 0`.

### Indexes

- Unique binary index on `url_key`.
- `(archived_at, updated_at DESC, id)` for recent active/archive views.
- `(archived_at, is_read, updated_at DESC, id)` for unread.
- `(archived_at, search_title, id)` for title sort.

## IconAsset

| Field | Type | Rules |
|---|---|---|
| `hash` | text | Primary key; lowercase SHA-256 of normalized bytes |
| `mime_type` | text | Server-owned raster type, normally `image/png` or `image/webp` |
| `bytes` | blob | Re-encoded, metadata-stripped icon; bounded size |
| `byte_count` | integer | Must match BLOB size and configured cap |
| `width` | integer | Positive and within decoded-pixel cap |
| `height` | integer | Positive and within decoded-pixel cap |
| `created_at` | text | Required |

Assets are immutable and deduplicated. An asset may be deleted only after no bookmark references it and no unexpired metadata proposal token needs it.

## Tag

| Field | Type | Rules |
|---|---|---|
| `id` | text | Primary key, UUID |
| `display_name` | text | Trimmed user-facing name, 1–100 scalar values |
| `normalized_name` | text | NFKC/case-folded identity, unique and nonempty |
| `created_at` | text | Required |

The first accepted capitalization becomes the display form. Later case-only variants resolve to the existing tag.

## BookmarkTag

| Field | Type | Rules |
|---|---|---|
| `bookmark_id` | text | Foreign key to Bookmark, cascade delete |
| `tag_id` | text | Foreign key to Tag, cascade delete |

Composite primary key: (`bookmark_id`, `tag_id`). A reverse index on (`tag_id`, `bookmark_id`) supports filters and orphan cleanup.

## MetadataJob

| Field | Type | Rules |
|---|---|---|
| `id` | text | Primary key, UUID |
| `bookmark_id` | text | Foreign key to Bookmark, cascade delete |
| `kind` | enum text | `import_missing` only in v1; interactive previews are request scoped |
| `status` | enum text | `queued`, `running`, `complete`, `partial`, `failed`, or `blocked` |
| `attempt_count` | integer | Zero or one normal attempt; interrupted `running` work may be re-queued on startup |
| `last_error_code` | text/null | Stable redacted category |
| `created_at` | text | Required |
| `started_at` | text/null | Set when leased |
| `finished_at` | text/null | Terminal completion time |

Unique active-job constraint: at most one queued/running job per bookmark and kind. Jobs fill only missing fields and never overwrite imported/user-owned values.

## ImportBatch

| Field | Type | Rules |
|---|---|---|
| `id` | text | Primary key, UUID |
| `file_name` | text | Sanitized display name only |
| `source_kind` | enum text | `generic_browser_html` or recognized `bookmark_manager_export` |
| `source_version` | integer/null | Validated app extension version |
| `status` | enum text | `previewed`, `committing`, `committed`, `cancelled`, or `expired` |
| `new_count` | integer | Nonnegative preview/result count |
| `duplicate_count` | integer | Nonnegative preview/result count |
| `invalid_count` | integer | Nonnegative preview/result count |
| `created_at` | text | Required |
| `expires_at` | text | Required for uncommitted staging cleanup |
| `committed_at` | text/null | Set once |

Only `previewed` batches may transition to `committing`; confirmation is idempotent and returns the committed result on repetition.

## ImportEntry

| Field | Type | Rules |
|---|---|---|
| `id` | integer | Primary key local to staging |
| `batch_id` | text | Foreign key to ImportBatch, cascade delete |
| `ordinal` | integer | Original file order; unique within batch |
| `classification` | enum text | `new`, `duplicate`, or `invalid` |
| `reason_code` | text/null | Stable explanation for duplicate/invalid entries |
| `duplicate_bookmark_id` | text/null | Existing bookmark when classification is duplicate |
| `url` / `url_key` | text/null | Validated candidate address/key |
| `title` | text/null | Plain text, bounded |
| `description` | text/null | Plain text, bounded |
| `note_markdown` | text | Validated app field or empty |
| `tags_json` | text | Validated array of display tag names |
| `is_read` | integer | App state or `0` for generic imports |
| `archived_at` | text/null | App state or null for generic imports |
| `icon_bytes` / `icon_mime` | blob/text null | Validated bounded app/standard icon |
| `created_at` / `updated_at` | text/null | Valid imported/app timestamps |

Raw HTML and unknown app metadata are not retained after parsing. Invalid optional metadata becomes a warning/fallback rather than invalidating an otherwise usable HTTP(S) bookmark.

## OwnerSession

| Field | Type | Rules |
|---|---|---|
| `token_digest` | blob | Primary key; SHA-256 of opaque cookie token |
| `csrf_digest` | blob | Required; digest of client CSRF token |
| `created_at` | text | Required |
| `last_seen_at` | text | Required, rate-limited updates |
| `idle_expires_at` | text | Required |
| `absolute_expires_at` | text | Required |

Expired sessions are rejected and periodically removed. Raw session and CSRF values never enter the database or logs.

## SchemaMigration

| Field | Type | Rules |
|---|---|---|
| `version` | integer | Primary key, monotonically increasing |
| `name` | text | Required |
| `checksum` | text | Required; detects edited applied migrations |
| `applied_at` | text | Required |

## State Transitions

### Bookmark lifecycle

```text
create (default unread)
      │
      ▼
active/unread ◄──────────── active/read
      │        mark unread       ▲
      └──────── mark read ────────┘
      │                           │
      └──── archive ──────────────┤
                                  ▼
                         archived (read flag retained)
                                  │
                                  └──── restore ──► prior read state in active

active or archived ── confirmed delete ──► permanently removed
```

Opening a destination causes no state transition.

### Import batch

```text
file parsed ─► previewed ─► committing ─► committed
                    ├────► cancelled
                    └────► expired
```

The `committing` transition rechecks all URL keys inside one transaction. New conflicts are reclassified as duplicates; valid nonconflicting entries commit together. Enrichment jobs are inserted in that same transaction and run only after commit.

### Metadata job

```text
queued ─► running ─► complete | partial | failed | blocked
             │
             └─ process interrupted ─► queued (startup recovery only)
```

## Transaction Boundaries and Invariants

- Bookmark creation, edit, status change, and its tag associations commit atomically.
- Exact URL uniqueness is enforced by the database, not only preflight checks.
- Each bulk action resolves its selection and applies all eligible changes in one transaction. Already-satisfied states are counted as unchanged, not errors.
- Confirmed bulk deletion removes bookmark-tag rows and pending jobs by cascade; orphan tags and icons are cleaned only after the main transaction.
- Import confirmation is atomic for all entries classified new at confirmation time. Invalid and duplicate entries are intentional skips, not transaction failures.
- Search shadows are updated in the same transaction as their source fields.
- User-owned metadata origins cannot be changed to automatic by background enrichment.
- Archived status never changes `is_read`; read status is simply hidden from the active unread view while archived.
