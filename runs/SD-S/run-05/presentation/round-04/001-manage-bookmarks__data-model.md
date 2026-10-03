# Data Model: Bookmark Manager

## Bookmark

Represents one saved web resource.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID string | Generated on creation; immutable primary key |
| `url` | string | User-visible submitted URL after trimming and standard URL serialization; HTTP(S) only |
| `normalizedUrl` | string | Canonical comparison key; unique; never shown as a replacement for the user's address |
| `title` | string | Required after fallback; trimmed plain text; maximum 300 characters |
| `description` | string or null | Trimmed plain text; maximum 300 characters; null when empty |
| `createdAt` | UTC timestamp | Generated on creation; immutable |
| `updatedAt` | UTC timestamp | Generated on creation and replaced on each successful edit |

### URL identity

Normalization uses standard URL parsing after trimming, lowercases scheme/host through serialization, removes the fragment, removes default ports, and treats the resulting serialized address as the duplicate key. Query parameters remain significant. The stored display URL and normalized key are updated atomically.

### Validation

- Scheme must be `http` or `https`; credentials are rejected.
- Title falls back to the valid URL when retrieval/manual entry supplies none.
- User-entered and retrieved text is normalized as text, never stored as executable markup.
- Updating a URL cannot collide with another bookmark's `normalizedUrl`.

## Tag

Represents a reusable organizational label.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID string | Generated on first use; immutable primary key |
| `name` | string | Trimmed display spelling; 1–40 characters |
| `normalizedName` | string | Unicode-normalized, case-folded comparison key; unique |

Tags that differ only by capitalization/normalization resolve to the existing Tag. Empty tags are discarded after trimming. A bookmark may have at most 20 distinct tags.

## BookmarkTag

Join relation between Bookmark and Tag.

| Field | Type | Rules |
|---|---|---|
| `bookmarkId` | UUID string | Foreign key to Bookmark; cascades on bookmark deletion |
| `tagId` | UUID string | Foreign key to Tag; cascades on tag deletion |

The composite pair is unique. Tags with no remaining bookmark associations are removed in the same transaction as bookmark edits/deletion.

## Derived metadata preview (not persisted independently)

| Field | Type | Rules |
|---|---|---|
| `status` | enum | `complete`, `partial`, or `unavailable` |
| `title` | string or absent | Normalized page title when available |
| `description` | string or absent | Normalized and clamped page description when available |
| `finalUrl` | string or absent | Safe diagnostic redirect destination; does not replace bookmark URL automatically |
| `reason` | enum or absent | Stable fallback category, never raw network details |

Failure reasons: `invalid_url`, `blocked_destination`, `timeout`, `unsupported_content`, `unavailable`, and `metadata_missing`.

## Relationships and indexes

- Bookmark many-to-many Tag through BookmarkTag.
- Unique indexes: `bookmarks.normalized_url`, `tags.normalized_name`, and `(bookmark_id, tag_id)`.
- Query indexes: `bookmarks.created_at DESC`, `bookmark_tags.tag_id`, and `bookmark_tags.bookmark_id`.
- With only 1,000 expected records, case-insensitive substring search spans bookmark text plus joined tag names without a separate search service.

## State transitions

### Bookmark form

`empty` → `retrieving` after a valid pasted URL → `ready` for complete/partial metadata or `fallback` for failure → `saving` → `saved` or `save-error`.

Changing the URL during `retrieving`, `ready`, or `fallback` invalidates the prior preview and begins a new retrieval when valid. Editing title/description marks that field dirty until the URL changes or the form resets.

### Persisted bookmark

`active` → `editing` → `active` on successful update; failed/cancelled updates retain the prior record. `active` → `delete-pending` → `deleted` only after confirmation; cancellation returns to `active` unchanged.

## Transaction boundaries

- Create: bookmark, new tags, and join rows commit together.
- Update: bookmark fields, tag creation/removal, join rows, and orphan cleanup commit together.
- Delete: bookmark, cascading joins, and orphan cleanup commit together.
- Any failure rolls back the complete mutation and leaves unrelated data unchanged.
