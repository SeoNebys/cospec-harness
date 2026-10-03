# Data Model: Bookmark Manager

## Conventions

- Internal primary keys are SQLite integers for compact joins and FTS row IDs. Public API identifiers are UUID strings and never expose internal row IDs.
- Times are UTC ISO-8601 strings with millisecond precision.
- Every owned record carries `user_id`; repositories require the authenticated user ID and never load an owned record by public ID alone.
- User-visible names retain their display form. Companion `*_key` fields use NFKC normalization, trimmed/collapsed whitespace, and locale-independent case folding for uniqueness.
- Every mutation that can change a library query increments `users.library_revision` in the same transaction.
- Foreign keys are enabled. Ownership-sensitive associations are checked in repositories and covered by tenant-isolation tests.

## User

| Field | Type | Rules |
|---|---|---|
| `id` | integer | Primary key |
| `public_id` | UUID text | Unique, immutable |
| `email` | text | Unique normalized email; required |
| `password_hash` | text | Argon2id hash; never returned |
| `library_revision` | integer | Starts at 0; monotonically increases |
| `created_at` | timestamp | Required |
| `updated_at` | timestamp | Required |

Authentication uses an encrypted session cookie containing only the public user ID and session metadata. Registration, password recovery, and account administration are outside this feature; development/review uses a provisioned account.

## Bookmark

| Field | Type | Rules |
|---|---|---|
| `id` | integer | Primary key and FTS content row ID |
| `public_id` | UUID text | Unique, immutable API identifier |
| `user_id` | integer | Required owner reference |
| `url` | text | User-visible normalized HTTP(S) destination |
| `normalized_url` | text | Canonical duplicate key; unique with `user_id` |
| `title` | text | Required; 1–200 characters |
| `description` | text/null | At most 2,000 characters |
| `notes_markdown` | text/null | At most 20,000 characters; raw HTML not enabled |
| `notes_search_text` | text | Derived visible text used by FTS |
| `site_icon_url` | text/null | Valid resolved HTTP(S) metadata URL |
| `preview_image_url` | text/null | Valid resolved HTTP(S) metadata URL |
| `metadata_status` | enum | `complete`, `partial`, `unavailable`, `blocked`, or `timeout` |
| `metadata_warnings_json` | JSON text | Bounded machine-readable warning codes |
| `collection_id` | integer/null | Optional collection owned by same user |
| `read_state` | enum | `unread` or `read`; defaults to `unread` |
| `archived_at` | timestamp/null | Null means active; non-null means archived |
| `title_sort_key` | text | Derived NFKC/case-folded title |
| `version` | integer | Optimistic edit version; starts at 1 |
| `created_at` | timestamp | Required |
| `updated_at` | timestamp | Required |

Indexes:

- Unique `(user_id, normalized_url)` across active and archived bookmarks.
- `(user_id, archived_at, created_at, id)` for location/newest paging.
- `(user_id, archived_at, title_sort_key, id)` for title paging.
- `(user_id, read_state, archived_at, created_at, id)` for unread.
- `(user_id, collection_id, archived_at)` for filters.

The site icon and preview URL are publisher metadata only. Page HTML and article content are never stored.

## Full-text index

`bookmark_fts` is an FTS5 external-content virtual table keyed by `bookmarks.id` with columns:

- `title`
- `normalized_url`
- `description`
- `notes_search_text`

It uses `unicode61 remove_diacritics 2` with positional detail retained for phrase matching. Insert, update, and delete triggers keep the index synchronized. Migrations expose an FTS rebuild operation, and integration tests compare indexed and source rows after every mutation type.

Search does not index Markdown syntax or tags. Tags remain relational predicates so exact tag identity survives renames.

## Tag

| Field | Type | Rules |
|---|---|---|
| `id` | integer | Primary key |
| `public_id` | UUID text | Unique API identifier |
| `user_id` | integer | Required owner reference |
| `name` | text | Required; 1–50 characters |
| `name_key` | text | Unique with `user_id` |
| `created_at` | timestamp | Required |
| `updated_at` | timestamp | Required |

Tag suggestions rank prefix matches before other substring matches, return at most 20 results, and never return another user's tags.

## BookmarkTag

| Field | Type | Rules |
|---|---|---|
| `bookmark_id` | integer | Bookmark reference |
| `tag_id` | integer | Tag reference |
| `created_at` | timestamp | Required |

Primary key: `(bookmark_id, tag_id)`. A reverse index on `(tag_id, bookmark_id)` supports tag filtering and impact counts. Both records must share the same owner.

## Collection

| Field | Type | Rules |
|---|---|---|
| `id` | integer | Primary key |
| `public_id` | UUID text | Unique API identifier |
| `user_id` | integer | Required owner reference |
| `name` | text | Required; 1–50 characters |
| `name_key` | text | Unique with `user_id` |
| `created_at` | timestamp | Required |
| `updated_at` | timestamp | Required |

Deleting a collection sets associated bookmarks' `collection_id` to null in the confirmed transaction; bookmarks are never deleted.

## SavedView

| Field | Type | Rules |
|---|---|---|
| `id` | integer | Primary key |
| `public_id` | UUID text | Unique API identifier |
| `user_id` | integer | Required owner reference |
| `name` | text | Required; 1–50 characters |
| `name_key` | text | Unique with `user_id` |
| `raw_query` | text | Editable user query; bounded to 1,000 characters |
| `search_ast_json` | JSON text | Canonical AST with stable tag public IDs |
| `filters_json` | JSON text | Tag IDs, collection ID, and read-state filter |
| `location` | enum | `active`, `unread`, or `archive` |
| `sort` | enum | `newest`, `oldest`, or `title` |
| `parser_version` | integer | Enables future AST migration |
| `created_at` | timestamp | Required |
| `updated_at` | timestamp | Required |

Saved views never contain bookmark IDs. When a referenced tag or collection is renamed, the stable ID remains valid and the displayed label refreshes. When one is deleted, the unresolved ID remains in the saved representation so opening the view returns a warning and no silently broadened results.

## MediaCacheEntry

| Field | Type | Rules |
|---|---|---|
| `cache_key` | SHA-256 text | Primary key derived from normalized asset URL and variant |
| `source_url` | text | Validated public HTTP(S) URL |
| `kind` | enum | `icon` or `preview` |
| `relative_path` | text | Path below the configured cache root only |
| `media_type` | text | Verified raster image type |
| `byte_size` | integer | Icon ≤512 KiB; preview ≤5 MiB |
| `width` / `height` | integer/null | Decoded bounded dimensions when available |
| `fetched_at` | timestamp | Required |
| `last_accessed_at` | timestamp | Used for eviction |
| `expires_at` | timestamp | Marks refresh eligibility, not guaranteed retention |

The cache is evictable and is not a source of record. Requests identify an owned bookmark and asset kind; they never accept a free-form proxy URL. No HTML or complete page copy is cached.

## Search AST

The versioned JSON AST has these node forms:

- `text(term, sourceSpan)`
- `phrase(value, sourceSpan)`
- `tag(tagPublicId, displayName, sourceSpan)`
- `not(child)`
- `and(children[])`
- `or(children[])`

Parsing limits: query ≤1,000 characters, ≤100 lexical tokens, and ≤10 parenthesis levels. Operators are recognized only when unquoted. Adjacent primaries become `and`; infix `A NOT B` is normalized to `A AND NOT B`.

Filters are applied to a user-scoped `universe` before AST set operations. Multiple selected tag filter chips use ALL semantics; OR behavior remains available through `tag:` expressions.

## State transitions

### Bookmark read state

```text
unread ──mark read──> read
read ──mark unread──> unread
```

Opening a destination causes no transition.

### Bookmark archive state

```text
active ──archive──> archived
archived ──restore──> active
active or archived ──confirmed permanent delete──> removed
```

Archiving preserves read state and all content. Permanent deletion removes tag associations and FTS content in the same transaction. There is no post-delete recycle state.

### Metadata status

```text
requested ──all supported details found──> complete
requested ──some details found───────────> partial
requested ──no usable details────────────> unavailable
requested ──destination denied───────────> blocked
requested ──deadline reached─────────────> timeout
```

Every terminal metadata state permits manual bookmark saving.

## Bulk operation consistency

Bulk preview is not persisted as a domain record. The server returns:

- canonical selection criteria or validated explicit IDs;
- action and action arguments;
- SHA-256 criteria hash;
- current `library_revision`;
- exact matched count.

Execution begins `BEGIN IMMEDIATE`, recomputes and verifies hash/revision/count, materializes target IDs in a temporary table once, validates action applicability, applies valid changes, reports invalid IDs with reasons, increments the revision, and commits. If the library revision or exact count changed, the server returns a conflict and performs no action so the user can reconfirm.

