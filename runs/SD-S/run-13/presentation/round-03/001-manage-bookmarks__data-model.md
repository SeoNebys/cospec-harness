# Data Model: Bookmark Manager

## Overview

The model stores bookmarks, normalized free-form tags, their many-to-many relationships, and applied schema migrations. Search/filter/sort preferences are transient client state and are not persisted in v1.

## Bookmark

Represents one saved web destination.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | UUID string | Yes | Generated at creation; immutable |
| `url` | String | Yes | Normalized absolute HTTP(S) URL; maximum 2,048 characters; public destination when metadata is retrieved |
| `normalized_url` | String | Yes | Canonical comparison form used for duplicate detection; indexed; not displayed as user content |
| `title` | String | Yes | Trimmed, non-empty, maximum 200 characters; retrieved, user-edited, or hostname fallback |
| `description` | String or null | No | Trimmed plain text, maximum 500 characters |
| `notes` | String or null | No | Trimmed user-authored text, maximum 2,000 characters |
| `is_favorite` | Boolean | Yes | Defaults to false |
| `created_at` | UTC timestamp | Yes | Set at creation; immutable |
| `updated_at` | UTC timestamp | Yes | Set at creation and advanced on each successful edit |

### URL normalization

- Add `https://` when the input resembles a hostname but omits a scheme.
- Accept only `http:` and `https:` and reject embedded credentials.
- Lowercase scheme and hostname, remove the fragment, remove default ports, and preserve path/query semantics.
- Serialize through the platform URL parser to obtain `url`.
- Build `normalized_url` from the serialized URL for case-stable duplicate comparisons; do not treat distinct non-default ports, paths, or query strings as duplicates.
- Duplicate URLs are permitted only when the create request explicitly confirms the duplicate warning.

### Update rules

- An address change recalculates `normalized_url` and `updated_at`.
- Existing title and description remain stored until the user explicitly accepts replacements from a retrieval result.
- All field limits are checked before a transaction starts.

## Tag

Represents one reusable organizational label.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | Integer | Yes | Generated at creation |
| `name` | String | Yes | Trimmed display spelling, non-empty, maximum 40 characters |
| `normalized_name` | String | Yes | Case-folded comparison value; unique |

Tags are created as needed during bookmark writes. An existing normalized tag is reused while retaining its established display spelling. Orphaned tags are removed after a bookmark update or deletion.

## BookmarkTag

Junction between bookmarks and tags.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `bookmark_id` | UUID string | Yes | Foreign key to Bookmark with cascading delete |
| `tag_id` | Integer | Yes | Foreign key to Tag with cascading delete |

The composite `(bookmark_id, tag_id)` key prevents repeats. A bookmark may have 0–20 tags.

## SchemaMigration

Tracks applied migrations.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `version` | Integer | Yes | Primary key matching migration filename prefix |
| `name` | String | Yes | Human-readable migration name |
| `applied_at` | UTC timestamp | Yes | Recorded when the transaction succeeds |

## Derived Library View

The following values are request/client state rather than stored entities:

| Field | Values | Default |
|---|---|---|
| `query` | 0–200 characters | Empty |
| `tag` | One normalized tag name or absent | Absent |
| `favorite` | `true` or absent | Absent |
| `sort` | `newest`, `oldest`, `title` | `newest` |

Filtering composes with logical AND. Text matching is case-insensitive across bookmark title, URL, description, notes, and associated tag names. Results use `id` as a stable final tie-breaker.

## Metadata Retrieval Result

Transient response; not stored independently.

| Field | Type | Meaning |
|---|---|---|
| `requestedUrl` | String | Normalized address submitted by the client |
| `finalUrl` | String | Final validated destination after redirects |
| `title` | String | Retrieved title or hostname-derived fallback |
| `description` | String or null | Retrieved description, otherwise null |
| `status` | `retrieved` or `fallback` | Whether page metadata was successfully extracted |
| `warningCode` | String or null | Stable reason for fallback, suitable for UI messaging |

## State Transitions

### Bookmark editor

```text
empty → address-entered → retrieving → metadata-ready → dirty → saving → saved
                            └────────→ fallback-ready ────────┘

Any editable state → validation-error → same editable state
Saved → editing → saving → saved
Saved → delete-requested → confirmed → deleted
                         └→ cancelled → saved
```

Changing the address after `metadata-ready` marks retrieved fields stale. A later retrieval may populate untouched fields, but user-edited fields change only after explicit replacement confirmation.

## Indexes

- Index `bookmarks.normalized_url` for duplicate lookup.
- Index `bookmarks.created_at` and `bookmarks.updated_at` for ordering.
- Index `bookmarks.is_favorite` for filtering.
- Unique index `tags.normalized_name`.
- Reverse index `bookmark_tags(tag_id, bookmark_id)` in addition to the composite primary key.

At the approved 10,000-bookmark scale, case-insensitive substring search may scan bookmark text while using the relationship and filter indexes to narrow candidates. Performance tests determine whether a later full-text index is warranted; it is not part of v1.
