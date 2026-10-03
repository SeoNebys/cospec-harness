# Data Model: Personal Bookmark Manager

## Conventions

- Database timestamps are UTC ISO-8601 strings with millisecond precision.
- Boolean values are stored as constrained integers `0` or `1`.
- User-visible text remains in its entered/retrieved form; separate shadow values support consistent search.
- Search normalization applies Unicode NFKC and consistent Unicode lowercase conversion.
- Tag identity normalization additionally trims surrounding whitespace and collapses internal whitespace runs.
- All multi-table create, edit, tag, and delete changes occur in transactions.

## Bookmark

Represents one saved public web destination.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | integer | yes | Generated primary key; never reused |
| `url` | text | yes | Final safely resolved URL when known; otherwise the normalized requested URL |
| `normalized_url` | text | yes | Canonical duplicate key; unique |
| `title` | text | yes | Retrieved, user-edited, or hostname fallback; 1–512 Unicode code points |
| `description` | text/null | no | Retrieved or user-edited summary; at most 2,000 code points |
| `notes` | text/null | no | User-authored content; whitespace-only becomes null; at most 10,000 code points |
| `icon_asset_id` | integer/null | no | Foreign key to a validated cached icon asset |
| `is_favorite` | boolean | yes | Defaults to false |
| `is_unread` | boolean | yes | Defaults to false; changed only by explicit user action |
| `created_at` | timestamp | yes | Set once at creation |
| `updated_at` | timestamp | yes | Updated on persisted user changes |
| `url_search` | text | yes | Search-normalized `url` |
| `title_search` | text | yes | Search-normalized `title` |
| `description_search` | text | yes | Search-normalized description or empty string |
| `notes_search` | text | yes | Search-normalized notes or empty string |

### Relationships

- Zero or one `IconAsset` through `icon_asset_id`.
- Zero or more `Tag` records through `BookmarkTag`.

### Invariants

- `normalized_url` is unique even under concurrent create/edit attempts.
- Title is never empty; metadata failure uses a normalized-hostname fallback.
- Source and shadow fields update together in the same transaction.
- `is_favorite` and `is_unread` are independent.
- Opening `url` is not a Bookmark mutation and cannot change `is_unread`.

### State transitions

```text
favorite: not-favorite <-> favorite       explicit user toggle only
reading:  read/not-tracked <-> unread     explicit user action only
lifecycle: absent -> saved -> edited* -> deleted
```

## Tag

Represents a reusable organizational label.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | integer | yes | Generated primary key |
| `display_name` | text | yes | First accepted visible form; 1–64 code points |
| `normalized_name` | text | yes | Tag identity normalization; unique |
| `search_name` | text | yes | Search normalization for ordinary substring search |
| `created_at` | timestamp | yes | Creation time |

### Invariants

- Names differing only by case, Unicode compatibility form, or collapsed surrounding/internal whitespace share one Tag.
- `#tag` search compares the complete `normalized_name`.
- Prefix suggestions compare normalized input to normalized existing names and omit tags already attached to the current bookmark.
- A tag with no bookmark relationships is removed in the transaction that orphaned it.

## BookmarkTag

Many-to-many relationship between bookmarks and tags.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `bookmark_id` | integer | yes | Foreign key to Bookmark; cascade delete |
| `tag_id` | integer | yes | Foreign key to Tag; cascade delete |

The composite primary key `(bookmark_id, tag_id)` prevents duplicate attachment.

## IconAsset

Stores one app-owned, verified site icon so the browser never hotlinks an untrusted remote asset.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | integer | yes | Generated primary key |
| `content_type` | enum text | yes | One of verified PNG, JPEG, GIF, WebP, or ICO media types |
| `bytes` | blob | yes | Verified decoded asset; maximum 256 KiB |
| `content_hash` | text | yes | Unique digest for deduplication |
| `created_at` | timestamp | yes | Cache creation time |

### Invariants

- Declared media type and verified signature agree.
- SVG, HTML, and unknown formats are never stored.
- Asset responses use the recorded fixed type and `X-Content-Type-Options: nosniff`.
- An asset no longer referenced by any bookmark is eligible for transactional removal.

## MetadataDraft (transient)

Represents the result of one guarded metadata request before the user saves a bookmark. It is never the source of truth for a saved Bookmark.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `request_id` | string | yes | Correlates response with the current form URL snapshot |
| `status` | enum | yes | `success`, `partial`, `unavailable`, or `rejected` |
| `requested_url` | text | yes | User-submitted value after trimming |
| `normalized_url` | text/null | no | Safe canonical requested URL |
| `final_url` | text/null | no | Present only after a fully validated redirect chain |
| `title` | sourced text | yes for non-rejected results | Retrieved value or hostname fallback plus source |
| `description` | sourced text/null | no | Retrieved value plus source |
| `icon_upload_token` | string/null | no | Short-lived reference to a validated pending icon asset |
| `warnings` | list | yes | Stable non-sensitive codes |

Client-only dirty flags for `title` and `description` determine whether a matching response may populate each field. A late or mismatched `request_id` cannot mutate the form.

## SearchExpression (transient)

Represents a parsed query, never persisted as bookmark data.

```text
SearchNode = Term(value, span)
           | Phrase(value, span)
           | Tag(value, normalizedValue, span)
           | Not(child, span)
           | And(children, span)
           | Or(children, span)
```

### Validation limits

- At most 1,000 source characters.
- At most 128 leaf expressions.
- At most 64 nested groups/unary levels.
- Every node retains original start/end offsets.
- Parsing returns either a complete AST or one typed syntax error; partial ASTs are not queried.

## CollectionViewState (client transient)

Mirrored in URL query parameters so navigation away to an external bookmark does not discard the view.

| Field | Type | Default | Rules |
|---|---|---|---|
| `query` | text | empty | Original unmodified search expression |
| `tag_filters` | list of normalized tag names | empty | Conjoined with each other and the query |
| `favorite_filter` | boolean/null | null | Null means either state |
| `unread_filter` | boolean/null | null | Null means either state |

Filters are conjoined with the parsed search expression. Results use stable order `created_at DESC, id DESC`.

## Database constraints and indexes

- Unique indexes: `bookmarks.normalized_url`, `tags.normalized_name`, `icon_assets.content_hash`, and `bookmark_tags(bookmark_id, tag_id)`.
- Foreign-key indexes on both directions of `bookmark_tags` and on `bookmarks.icon_asset_id`.
- Collection indexes on `(created_at DESC, id DESC)`, `(is_favorite, created_at DESC, id DESC)`, `(is_unread, created_at DESC, id DESC)`, and `(is_favorite, is_unread, created_at DESC, id DESC)`.
- Search shadow fields intentionally use bounded scans after indexed filters at the approved 5,000-row scale. FTS is not part of the first-release model.
