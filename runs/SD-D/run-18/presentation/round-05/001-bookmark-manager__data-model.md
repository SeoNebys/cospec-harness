# Data Model: Bookmark Manager

**Date**: 2026-09-24  
**Database**: SQLite with foreign keys and WAL enabled  
**Conventions**: UUID text identifiers; UTC ISO-8601 timestamps; booleans stored as constrained integers; all user-facing strings trimmed at validation boundaries

## Relationship Overview

```text
Bookmark 1 ── 0..1 current SavedCopy
Bookmark 1 ── * CaptureAttempt 1 ── 1 Job
Bookmark * ── * Tag (through BookmarkTag)
Bookmark 1 ── * BlobReference ── 1 Blob
SavedCopy 1 ── * SavedCopyAsset ── 1 Blob
SavedView * ── * Tag (through SavedViewTagFilter)
ImportRun 1 ── * ImportIssue
PreferenceSet (single row)
```

## Entities

### Bookmark

| Field | Type | Rules |
|---|---|---|
| `id` | UUID text | Primary key, immutable |
| `url` | text | Required HTTP/HTTPS URL as displayed/edited by user |
| `normalized_url` | text | Required, unique across active and archived bookmarks |
| `title` | text | Required, 1–500 Unicode characters after trimming |
| `description` | text/null | Up to 4,000 characters |
| `note_markdown` | text/null | Up to 100,000 characters; raw HTML disabled |
| `note_text` | text | Derived searchable text from `note_markdown` |
| `read_status` | enum | `unread` by default or `read` |
| `archived_at` | timestamp/null | Null means active; non-null means archived |
| `current_saved_copy_id` | UUID/null | Points to the last confirmed available immutable copy |
| `copy_status` | enum | `pending`, `available`, or `failed`; derived/update-controlled from attempts/current copy |
| `copy_error_code` | text/null | Stable actionable code for current failed initial capture |
| `created_at` | timestamp | Immutable saved date |
| `updated_at` | timestamp | Changes when user-visible bookmark state/content changes |
| `url_revision` | integer | Starts at 1; increments whenever `url` changes |

**Indexes**:

- Unique `normalized_url`.
- Partial active/archive indexes for `(created_at, id)`, `(updated_at, id)`, and normalized title with ID tie-breakers.
- Partial `(read_status, created_at, id)` for active unread items.

**Validation and invariants**:

- URL normalization uses the WHATWG URL model: lowercase host, canonical internationalized host form, default port removed, empty path normalized to `/`, fragment removed, and query/path semantics otherwise preserved.
- Editing the URL increments `url_revision`; it does not mutate or relabel the current saved copy.
- `archived_at` affects visibility only. It never changes `read_status` or `current_saved_copy_id`.
- Permanent deletion cascades logical references and schedules unreferenced blob cleanup after commit.

### Tag

| Field | Type | Rules |
|---|---|---|
| `id` | UUID text | Primary key |
| `canonical_name` | text | Unicode-normalized and case-folded; unique |
| `display_name` | text | Consistent user-facing spelling, 1–100 characters |
| `created_at` | timestamp | Required |

`BookmarkTag(bookmark_id, tag_id)` has a composite primary key and reverse `(tag_id, bookmark_id)` index. Removing a relation does not delete a tag until no bookmark or saved-view filter references it; orphan cleanup is transactional.

### Bookmark Metadata Blob Reference

Site icons and preview images use explicit bookmark/blob relations rather than filesystem paths on Bookmark:

| Field | Type | Rules |
|---|---|---|
| `bookmark_id` | UUID | Bookmark foreign key |
| `role` | enum | `site_icon` or `preview_image`; unique with bookmark |
| `blob_digest` | SHA-256 text | Blob foreign key |
| `media_type` | text | Allowlisted image type |
| `updated_at` | timestamp | Required |

Replacing/removing an image updates the relation; orphan collection removes unreferenced content after commit.

### SavedCopy

| Field | Type | Rules |
|---|---|---|
| `id` | UUID text | Primary key, immutable |
| `bookmark_id` | UUID | Owning bookmark |
| `source_url` | text | Bookmark URL used when capture began |
| `effective_url` | text | Final allowed URL after redirects |
| `url_revision` | integer | Bookmark revision captured; never rewritten |
| `kind` | enum | `html` or `pdf` |
| `manifest_digest` | SHA-256 text | Blob containing canonical capture manifest |
| `primary_blob_digest` | SHA-256 text | Static HTML document or original PDF |
| `total_size_bytes` | integer | Non-negative, checked against manifest |
| `primary_media_type` | text | Known allowlisted media type |
| `captured_at` | timestamp | Immutable |
| `capture_version` | text | Capture pipeline version |
| `sanitizer_version` | text/null | Required for HTML |
| `warning_count` | integer | Non-negative |

Only `Bookmark.current_saved_copy_id` designates the current visible copy. Older candidate copies are inaccessible and garbage-collected after a successful confirmed swap or failed/cancelled attempt cleanup.

### SavedCopyAsset

| Field | Type | Rules |
|---|---|---|
| `saved_copy_id` | UUID | SavedCopy foreign key |
| `asset_key` | text | Opaque manifest-authorized identifier; unique within copy |
| `blob_digest` | SHA-256 text | Blob foreign key |
| `media_type` | text | Allowlisted safe type |
| `size_bytes` | integer | Must match Blob |
| `role` | enum | `image`, `style`, `font`, `diagnostic`, or `viewer_resource` |

Remote URLs and arbitrary file paths are never stored as asset keys.

### Blob

| Field | Type | Rules |
|---|---|---|
| `digest` | SHA-256 text | Primary key and content identity |
| `size_bytes` | integer | Non-negative |
| `media_type` | text | Validated before publication |
| `created_at` | timestamp | Required |
| `state` | enum | `staged`, `published`, `delete_pending` |

The physical path is deterministically derived from the digest and never accepted from API input. A blob becomes `published` only after its file is fully written, hashed, synchronized, and atomically renamed. Physical deletion occurs only when no live relation references it.

### CaptureAttempt

| Field | Type | Rules |
|---|---|---|
| `id` | UUID text | Primary key/idempotency key |
| `bookmark_id` | UUID | Required |
| `source_url` | text | Immutable attempted URL |
| `url_revision` | integer | Revision at enqueue time |
| `purpose` | enum | `initial`, `retry`, `recapture`, or `import` |
| `status` | enum | `queued`, `running`, `available`, `failed`, or `cancelled` |
| `progress_phase` | enum/null | `fetching`, `rendering`, `packaging`, `validating`, `publishing` |
| `candidate_saved_copy_id` | UUID/null | Set after validation, before/at publication |
| `error_code` | text/null | Stable code such as `blocked_destination`, `timeout`, `too_large`, `unsupported_type`, `invalid_pdf`, `render_failed`, `unsafe_output` |
| `error_detail` | text/null | Sanitized actionable explanation |
| `warnings_json` | JSON text | Bounded structured warnings |
| `attempt_number` | integer | Positive |
| `created_at` / `started_at` / `finished_at` | timestamp/null | Lifecycle timing |

### Job

| Field | Type | Rules |
|---|---|---|
| `id` | UUID text | Primary key |
| `kind` | enum | Initially `capture`; extensible for import maintenance/GC |
| `subject_id` | UUID | CaptureAttempt ID for capture jobs |
| `state` | enum | `queued`, `leased`, `completed`, `dead`, `cancelled` |
| `run_after` | timestamp | Retry scheduling |
| `lease_owner` / `lease_until` | text/timestamp/null | Reclaimable ownership |
| `attempts` / `max_attempts` | integer | Bounded retries |
| `last_error_code` | text/null | Stable operational error |
| `created_at` / `updated_at` | timestamp | Required |

Claiming uses a short `BEGIN IMMEDIATE` transaction. Duplicate processing is harmless because `subject_id` is unique for the job kind and publication checks attempt state, bookmark deletion, and URL revision.

### SavedView

| Field | Type | Rules |
|---|---|---|
| `id` | UUID text | Primary key |
| `name` | text | Required, unique case-insensitively, 1–100 characters |
| `query_text` | text | Verbatim validated search, up to 2 KiB |
| `scope` | enum | `active` for v1 |
| `created_at` / `updated_at` | timestamp | Required |

`SavedViewTagFilter(saved_view_id, tag_id, position)` stores match-all tag chips by stable tag ID. The query reparses against current data when opened; no SQL or version-dependent AST is persisted.

### PreferenceSet

One row with fixed key `default`:

| Field | Type | Rules |
|---|---|---|
| `default_sort_field` | enum | `title`, `created_at`, or `updated_at` |
| `default_sort_direction` | enum | `asc` or `desc` |
| `text_size` | enum | `small`, `medium`, or `large` |
| `updated_at` | timestamp | Required |

Defaults are `created_at`, `desc`, and `medium`.

### ImportRun and ImportIssue

`ImportRun` tracks filename, byte size, status (`parsing`, `committed`, `failed`), counts for imported/duplicate/skipped/failed/capture queue totals, and timestamps. `ImportIssue` stores bounded entry number, code, and safe detail. Fatal parse/limit/database failure yields no new bookmarks; individual invalid entries are reported without making valid entries fail.

## Search Indexes

### `bookmark_fts`

Regular FTS5 table keyed by bookmark ID with columns:

- `title`
- `address`
- `description`
- `note_text`

### `tag_fts`

Regular FTS5 table keyed by tag ID with `display_name`. Plain text tag matches join through `BookmarkTag`; `#tag` bypasses FTS and matches `Tag.canonical_name` exactly.

All source-row and FTS-row changes occur in one transaction. A maintenance operation rebuilds both indexes and verifies row coverage.

## State Transitions

### Bookmark archive state

```text
active ──archive──> archived
archived ──restore──> active
active|archived ──confirmed permanent delete──> deleted
```

Archive/restore never changes reading status or saved copy.

### Reading state

```text
unread ──mark read──> read
read ──mark unread──> unread
```

Opening the original or saved copy does not transition state.

### Initial capture

```text
queued -> running -> available
   |         |          |
   |         +-> failed +-> immutable current copy
   +-> cancelled
failed -> new retry attempt
```

Only a fully validated artifact becomes available. Missing nonessential resources may publish with warnings; truncated/unsafe/unreadable output fails.

### Explicit recapture

```text
current copy A + candidate queued/running
  ├─ candidate fails/cancels -> A remains current
  └─ candidate validates -> await confirmation -> atomically point to B -> GC A if unreferenced
```

If the bookmark URL revision changes, the candidate retains its original source and cannot silently publish for the new revision.

### Bulk operations

Each eligible item is mutated in a transactionally bounded batch. The result records per-item success or failure. Permanent deletion confirmation covers both bookmarks and saved copies. A partial outcome is never labeled full success.

## Retention and Backup

- Archive is indefinite and preserves blobs.
- Permanent deletion removes logical access immediately after confirmation; physical unreferenced-blob cleanup is idempotent and retryable.
- Capture failures retain attempt diagnostics but no unvalidated output; staged files expire through GC.
- A recoverable backup consists of a consistent SQLite backup, blob manifest, and every referenced published blob from the same backup boundary.
