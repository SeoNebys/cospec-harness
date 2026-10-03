# Data Model: Personal Bookmark Manager

**Date**: 2026-09-16  
**Source**: [Approved specification](spec.md)

## Model Overview

```text
Bookmark 1 ──< BookmarkTag >── 1 Tag
```

`CollectionViewState` is client presentation state and is not persisted. Bookmark and tag changes are persisted transactionally.

## Bookmark

Represents one saved web destination.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | UUID string | Yes | Generated on creation; immutable |
| `url` | String | Yes | Absolute `http:` or `https:` address; 1–2048 characters after trimming |
| `normalizedUrl` | String | Yes | Server-generated canonical value used for duplicate comparison; not user-editable |
| `title` | String | Yes | Trimmed; 1–300 characters |
| `notes` | String | Yes | Trimmed; empty string permitted; maximum 10,000 characters |
| `isFavorite` | Boolean | Yes | Defaults to `false` |
| `status` | Enum | Yes | `active` or `archived`; defaults to `active` |
| `createdAt` | UTC timestamp | Yes | Generated once; immutable |
| `updatedAt` | UTC timestamp | Yes | Refreshed after any content, tag, favorite, or lifecycle mutation |
| `archivedAt` | UTC timestamp or null | Yes | Set when archived; cleared when restored |
| `tags` | Tag array | Yes | Derived through `BookmarkTag`; empty array permitted |

### Address Normalization

1. Trim surrounding whitespace.
2. Parse as an absolute URL.
3. Reject schemes other than `http:` and `https:`.
4. Lowercase the scheme and host through standards-based URL serialization.
5. Remove the default port (`80` for HTTP or `443` for HTTPS).
6. Preserve path, query, and fragment because each may identify a distinct destination in a bookmark collection.
7. Serialize the result as `normalizedUrl`; store the same safe canonical serialization as `url`.

Two active bookmarks with the same `normalizedUrl` trigger the duplicate-decision flow. Duplicates are permitted only when create input explicitly includes `allowDuplicate: true`. An archived match does not trigger the warning.

### Bookmark Invariants

- `status = active` implies `archivedAt = null`.
- `status = archived` implies `archivedAt` is populated.
- Permanent deletion is valid only when `status = archived`.
- Editing never changes `id` or `createdAt`.
- A change to URL, title, notes, tags, favorite state, or archive state changes `updatedAt`.
- A failed transaction changes no bookmark or tag association.

### State Transitions

```text
create
  └──> active
        ├── edit/favorite ──> active
        └── archive ────────> archived
                                ├── restore ──> active
                                └── delete ───> removed permanently
```

Invalid transitions:

- Archiving an already archived bookmark.
- Restoring an active bookmark.
- Permanently deleting an active bookmark.
- Updating or acting on a missing bookmark.

The API reports invalid transitions without mutating data.

## Tag

Represents a reusable organizational label.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | UUID string | Yes | Generated when the normalized tag is first used; immutable |
| `name` | String | Yes | Trimmed display value; 1–40 characters |
| `normalizedName` | String | Yes | Case-folded comparison value; unique |
| `createdAt` | UTC timestamp | Yes | Generated once; immutable |

### Tag Normalization and Lifecycle

- Trim surrounding whitespace and collapse internal runs of whitespace to one space.
- Compare names case-insensitively through `normalizedName`.
- De-duplicate tags within one bookmark submission while preserving first-entered display casing.
- Limit a bookmark to 20 tags.
- Reuse an existing tag record when normalized names match.
- Remove a tag record when it has no bookmark associations, within the same transaction that removed the final association.

## BookmarkTag

Join entity connecting bookmarks and tags.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `bookmarkId` | UUID string | Yes | Foreign key to Bookmark with cascade delete |
| `tagId` | UUID string | Yes | Foreign key to Tag with cascade delete |

The composite key `(bookmarkId, tagId)` prevents duplicate associations.

## CollectionViewState

Ephemeral client state controlling what the user sees.

| Field | Type | Default | Rules |
|---|---|---|---|
| `scope` | `active` or `archived` | `active` | Selects lifecycle view |
| `query` | String | Empty | Trimmed; maximum 200 characters |
| `tag` | String or null | null | One normalized tag filter at a time |
| `favorite` | Boolean or null | null | `true` shows favorites; null applies no favorite filter |
| `sort` | Enum | `newest` | `newest`, `oldest`, `updated`, or `title` |

Search, tag, and favorite criteria combine with logical AND. Search matches a bookmark when the query is a case-insensitive substring of at least one of title, URL, notes, or associated tag display name.

## Relational Storage Shape

### `bookmarks`

- Primary key: `id`
- Columns mirror persisted Bookmark fields using integer booleans and ISO-8601 UTC text timestamps.
- Check constraints enforce status values and archive timestamp consistency.
- Indexes support `(status, created_at)`, `(status, updated_at)`, `(status, title COLLATE NOCASE)`, and `(status, is_favorite)`.
- Non-unique index on `normalized_url` supports duplicate lookup.

### `tags`

- Primary key: `id`
- Unique constraint on `normalized_name`.
- Case-insensitive index on display `name` supports tag ordering.

### `bookmark_tags`

- Composite primary key: `(bookmark_id, tag_id)`.
- Foreign keys cascade when a bookmark or tag is deleted.
- Reverse index on `(tag_id, bookmark_id)` supports tag filters.

### `schema_migrations`

- `version`: ordered unique migration identifier.
- `applied_at`: UTC timestamp.

Migration execution and recording occur atomically. Foreign-key enforcement is enabled before migration or application queries run.

## API Projection

API bookmark responses include the public Bookmark fields except `normalizedUrl`; normalization is an internal persistence concern. Tags are projected as ordered display-name strings. Timestamps use RFC 3339 UTC strings.

List responses contain:

- `items`: bookmarks matching the full view state.
- `total`: count matching the current criteria.
- `availableTags`: tag names available in the selected active/archive scope before the tag filter is applied, so the UI can keep filter choices understandable.
- `criteria`: normalized criteria actually applied by the server.

## Data Retention and Recovery

- Active and archived bookmarks persist until explicitly deleted from the archive.
- Permanent deletion removes the bookmark and join records transactionally, then removes orphan tags.
- Destination availability does not alter or delete the bookmark.
- The database file is the durable asset; generated build output contains no user bookmark data.
