# Data Model: Bookmark Manager

**Date**: 2026-09-18  
**Database**: SQLite with foreign keys enabled and WAL journaling  
**Identifiers**: Integer internal primary keys for joins/FTS row IDs; random opaque public IDs for every resource exposed through the API

## Conventions

- Timestamps are UTC epoch milliseconds and named `*_at`.
- User-owned records always contain `user_id`; repository queries require it even when a public ID is unique.
- Mutable API resources carry an integer `version`, initialized to 1 and incremented on each successful update.
- Normalized comparison values are stored separately from user-facing values.
- Hard deletion of a user cascades through all owned relational data. Media-file deletion is coordinated by the asset service.
- Boolean values use constrained integers `0` and `1`.
- Enumerated text columns use `CHECK` constraints.

## Entity Relationship Overview

```text
User
├── Session
├── PasswordResetToken
├── Collection ───────────────┐
├── Tag ──< BookmarkTag >─────┤
├── Bookmark ─────────────────┘
│   ├── favicon ──> MediaAsset
│   └── preview ──> MediaAsset
├── SavedSearch ──< SavedSearchTag >── Tag
├── MediaAsset
└── BulkConfirmation

Bookmark ──1:1 search projection── BookmarkSearch (FTS5)
```

## Entities

### User

Represents one private account and owns all library data.

| Field | Type | Rules |
|---|---|---|
| `id` | integer | Internal primary key |
| `public_id` | text | Random opaque ID, unique, immutable |
| `email` | text | Original trimmed email, maximum 320 characters |
| `email_normalized` | text | Lowercased comparison value, unique |
| `password_hash` | text | Argon2id encoded hash; never returned |
| `created_at` | integer | Required |
| `updated_at` | integer | Required |
| `version` | integer | Positive, starts at 1 |

**Validation**:

- Email must have a valid mailbox-shaped format; registration and recovery responses do not reveal whether an account already exists.
- Password input is 12–128 Unicode characters. Only the hash is persisted.

### Session

Represents a revocable authenticated browser session.

| Field | Type | Rules |
|---|---|---|
| `id` | integer | Internal primary key |
| `user_id` | integer | Required FK to User, cascade delete |
| `token_hash` | blob/text | Unique hash of the opaque cookie token |
| `csrf_secret_hash` | blob/text | Hash/binding for the client-visible CSRF token |
| `created_at` | integer | Required |
| `last_seen_at` | integer | Required |
| `expires_at` | integer | Required, indexed |

**Lifecycle**: Created or rotated after successful authentication; touched at a bounded interval; revoked on logout, password reset, expiry, or account deletion.

### PasswordResetToken

Represents one short-lived, single-use recovery link.

| Field | Type | Rules |
|---|---|---|
| `id` | integer | Internal primary key |
| `user_id` | integer | Required FK to User, cascade delete |
| `token_hash` | blob/text | Unique hash; raw token is never persisted |
| `created_at` | integer | Required |
| `expires_at` | integer | Required, indexed |
| `consumed_at` | integer/null | Null until successfully used |

### Collection

Represents an optional secondary folder-like grouping.

| Field | Type | Rules |
|---|---|---|
| `id` | integer | Internal primary key |
| `public_id` | text | Unique opaque API ID |
| `user_id` | integer | Required FK to User, cascade delete |
| `name` | text | Trimmed display name, 1–120 characters |
| `name_normalized` | text | Case-folded comparison value |
| `created_at` | integer | Required |
| `updated_at` | integer | Required |
| `version` | integer | Positive |

**Constraints**: Unique `(user_id, name_normalized)`. Deletion is a domain transaction that nulls affected bookmark `collection_id` values before deleting the collection; bookmarks and tags remain.

### Tag

Represents the primary, reusable organization label.

| Field | Type | Rules |
|---|---|---|
| `id` | integer | Internal primary key |
| `public_id` | text | Unique opaque API ID |
| `user_id` | integer | Required FK to User, cascade delete |
| `name` | text | Trimmed display name, 1–64 characters |
| `name_normalized` | text | Unicode case-folded and whitespace-normalized value |
| `created_at` | integer | Required |
| `updated_at` | integer | Required |
| `version` | integer | Positive |

**Constraints**: Unique `(user_id, name_normalized)`. Names must not begin with `#` in storage; the marker is search syntax, not part of the tag.

**Merge transition**: Renaming onto an existing normalized name requires a confirmed merge transaction. BookmarkTag and SavedSearchTag rows move to the surviving tag with duplicate joins removed; all affected bookmark search projections are refreshed; the source tag is deleted.

**Delete transition**: A preflight returns affected bookmark and saved-search counts. Confirmed deletion cascades joins, refreshes affected search projections, and leaves bookmarks intact.

### Bookmark

Represents one saved destination and all user-managed context.

| Field | Type | Rules |
|---|---|---|
| `id` | integer | Internal primary key and FTS row ID |
| `public_id` | text | Unique opaque API ID |
| `user_id` | integer | Required FK to User, cascade delete |
| `url` | text | User-facing HTTP(S) URL, 1–4096 characters |
| `url_normalized` | text | Canonical duplicate-comparison value |
| `title` | text | Required after fallback, 1–300 characters |
| `description` | text/null | Short description, maximum 1,000 characters |
| `note_markdown` | text/null | Markdown source, maximum 100,000 characters |
| `note_plain` | text/null | Derived searchable text, never accepted directly from clients |
| `favicon_asset_id` | integer/null | FK to an owned attached MediaAsset |
| `preview_asset_id` | integer/null | FK to an owned attached MediaAsset |
| `collection_id` | integer/null | FK to an owned Collection; `ON DELETE SET NULL` as safety net |
| `is_favorite` | integer | Boolean, default false |
| `reading_state` | text | `none`, `unread`, or `read`; default `none` |
| `archived_at` | integer/null | Null means active; timestamp means archived |
| `created_at` | integer | Required |
| `updated_at` | integer | Required |
| `version` | integer | Positive |

**Constraints and indexes**:

- Unique `(user_id, url_normalized)` across active and archived bookmarks.
- Index `(user_id, archived_at, created_at)` for default browsing.
- Index `(user_id, archived_at, reading_state)` for Read Later.
- Index `(user_id, archived_at, is_favorite)` for favorites.
- Index `(user_id, collection_id, archived_at)` for collections.

**URL normalization for duplicate comparison**:

1. Trim surrounding whitespace and parse with one WHATWG URL implementation.
2. Accept only `http:` and `https:` and reject embedded credentials.
3. Lowercase the scheme and ASCII/IDNA host; remove a trailing host dot.
4. Remove default ports (`80` for HTTP, `443` for HTTPS).
5. Resolve dot path segments, normalize an empty path to `/`, and remove the fragment.
6. Preserve protocol, `www`, path case, trailing slash, query parameter order, and query parameters because they may change destination semantics.

The original user-facing URL remains editable. Changing it reruns normalization and duplicate validation before commit.

**State transitions**:

```text
reading_state:
none ──mark unread/add to Read Later──> unread
unread ──mark read────────────────────> read
read ──mark unread────────────────────> unread

archive state:
active (archived_at = null) ──archive──> archived (timestamp)
archived ──restore─────────────────────> active
active or archived ──confirmed delete─> permanently removed
```

Archiving preserves reading and favorite states but removes the bookmark from active views. Restoring exposes those states again.

### BookmarkTag

Many-to-many association between bookmarks and tags.

| Field | Type | Rules |
|---|---|---|
| `bookmark_id` | integer | FK to Bookmark, cascade delete |
| `tag_id` | integer | FK to Tag, cascade delete |
| `created_at` | integer | Required |

**Constraints**: Composite primary key `(bookmark_id, tag_id)`. Domain services verify matching owners. A bookmark may carry at most 50 tags in v1 to keep entry and bulk feedback usable.

### MediaAsset

Describes a validated, user-owned icon or preview image stored outside the database.

| Field | Type | Rules |
|---|---|---|
| `id` | integer | Internal primary key |
| `public_id` | text | Unique opaque API ID |
| `user_id` | integer | Required FK to User, cascade delete |
| `purpose` | text | `favicon` or `preview` |
| `status` | text | `draft` or `attached` |
| `storage_key` | text | Unique opaque relative filename; never client-supplied |
| `source_url` | text/null | Validated remote source used for provenance |
| `mime_type` | text | Allowlisted browser-safe image type |
| `byte_size` | integer | Positive and within configured limit |
| `sha256` | text | Content digest |
| `created_at` | integer | Required |
| `expires_at` | integer/null | Required for drafts; null when attached |

**Validation**: Favicon maximum 1 MiB; preview maximum 5 MiB. Declared and sniffed media types must agree and be in the allowlist. SVG is excluded in v1 to avoid active-content complexity.

**Lifecycle**:

```text
remote candidate ──validated download──> draft
draft ──bookmark save/update───────────> attached
draft ──expiry cleanup─────────────────> deleted
attached ──replaced/unreferenced───────> grace period ──> deleted
```

The service deletes the relational record and corresponding file together using retryable cleanup bookkeeping so partial filesystem failure is recoverable.

### SavedSearch

Represents named live criteria, not a frozen result list.

| Field | Type | Rules |
|---|---|---|
| `id` | integer | Internal primary key |
| `public_id` | text | Unique opaque API ID |
| `user_id` | integer | Required FK to User, cascade delete |
| `name` | text | Trimmed display name, 1–120 characters |
| `name_normalized` | text | Case-folded comparison value |
| `query_text` | text | Valid search expression, maximum 2,000 characters; empty allowed |
| `collection_id` | integer/null | Optional owned Collection filter; `ON DELETE SET NULL` |
| `favorite_filter` | text | `any`, `favorite`, or `not_favorite` |
| `reading_filter` | text | `any`, `none`, `unread`, or `read` |
| `context` | text | `active` or `archive` |
| `sort` | text | `newest`, `oldest`, `title`, or `updated` |
| `created_at` | integer | Required |
| `updated_at` | integer | Required |
| `version` | integer | Positive |

**Constraints**: Unique `(user_id, name_normalized)`. Query syntax is validated before persistence.

### SavedSearchTag

Represents tag include/exclude filters outside the free-form query.

| Field | Type | Rules |
|---|---|---|
| `saved_search_id` | integer | FK to SavedSearch, cascade delete |
| `tag_id` | integer | FK to Tag, cascade delete |
| `polarity` | text | `include` or `exclude` |

**Constraints**: Composite primary key `(saved_search_id, tag_id)`; one tag cannot be both included and excluded. Tag rename needs no update because identity is stable. Confirmed tag deletion removes this row after its impact warning.

### BulkConfirmation

Represents a single-use confirmation for a dynamic destructive or archival operation.

| Field | Type | Rules |
|---|---|---|
| `id` | integer | Internal primary key |
| `user_id` | integer | Required FK to User, cascade delete |
| `token_hash` | text | Unique hash of raw confirmation token |
| `action` | text | `archive`, `restore`, or `delete` |
| `selection_json` | text | Server-normalized explicit-ID or all-matches selection |
| `criteria_digest` | text | Digest of normalized selection and action |
| `expected_count` | integer | Nonnegative preview count |
| `created_at` | integer | Required |
| `expires_at` | integer | Short expiry, indexed |
| `consumed_at` | integer/null | Null until execution begins |

**Lifecycle**: Preview creates; successful execution consumes; changed counts, expiry, logout, or user deletion invalidate. A consumed token cannot be replayed.

## Search Projection

### BookmarkSearch (FTS5 virtual table)

One row per bookmark, with `rowid = Bookmark.id`.

| Column | Indexed content |
|---|---|
| `title` | Bookmark title |
| `url` | User-facing URL |
| `description` | Short description or empty string |
| `note` | Derived plain text from Markdown |
| `tags` | Space-separated display names for ordinary text matching |

Owner and active/archive state remain relational predicates on Bookmark. `#tag` uses Tag/BookmarkTag equality rather than the aggregated FTS tag column.

**Consistency rule**: Create, edit, tag change, tag merge/delete, and permanent delete update the Bookmark and BookmarkSearch rows in one database transaction. A maintenance command can rebuild and verify the projection from source tables.

## Transaction Boundaries

- **Create bookmark**: Validate URL/duplicate, validate asset ownership, create Bookmark, attach assets, create missing user-approved tags, create BookmarkTag joins, and insert BookmarkSearch.
- **Edit bookmark**: Check owner/version, validate changed URL/assets/collection/tags, update Bookmark and joins, refresh BookmarkSearch, increment version.
- **Archive/restore/read/favorite**: Check owner/version, update state and version. FTS content is unchanged; archive filtering is relational.
- **Permanent delete**: Check confirmation and owner, delete Bookmark (joins/search cascade or explicit cleanup), mark assets unreferenced, consume confirmation when applicable.
- **Collection delete**: Check preflight/confirmation, unfile owned bookmarks, increment their versions, delete Collection.
- **Tag merge/delete**: Check preflight/confirmation, update joins/saved searches, refresh affected BookmarkSearch rows, delete source Tag.
- **Bulk action**: Resolve the owned selection, validate confirmation/count when required, mutate eligible items in bounded chunks inside a transaction, refresh affected search rows for tag changes, and return item-level failures for ineligible/stale records.

## Data Retention and Cleanup

- Expired sessions, reset tokens, bulk confirmations, and draft media are deleted by an idempotent scheduled cleanup invoked at startup and periodically while the process runs.
- Permanent bookmark deletion removes its record and relationships immediately; unreferenced media files enter a short cleanup grace period to allow transaction/file recovery.
- Archival is a bookmark state, not a retention rule; archived bookmarks remain until restored or permanently deleted.
- Database and `data/assets/` must be backed up together to preserve visual-asset references.
