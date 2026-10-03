# Data Model: Bookmark Manager

**Date**: 2026-09-18  
**Source**: [Approved specification](./spec.md)

## Overview

The persistent model has three tables: `bookmarks`, `tags`, and the many-to-many join `bookmark_tags`. Library view state and metadata-preview state are transient browser state and are defined separately so they cannot accidentally become durable product behavior.

## Persistent Entities

### Bookmark

Represents one saved web destination.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | UUID string | Yes | Generated on creation; immutable primary key |
| `url` | String | Yes | Serialized HTTP/HTTPS destination shown and opened for the user; maximum 2,048 code points |
| `canonical_url` | String | Yes | Comparison key produced by the shared URL normalizer; unique |
| `title` | String | Yes | 1–300 code points after trimming; uses `url` when neither user nor page supplies a title |
| `description` | String or null | No | Up to 1,000 code points after trimming; empty input stored as null |
| `is_favorite` | Boolean | Yes | Defaults to false |
| `archived_at` | UTC timestamp or null | No | Null means active; timestamp means archived |
| `created_at` | UTC timestamp | Yes | Set once at creation |
| `updated_at` | UTC timestamp | Yes | Refreshed after any persisted change, archive, or restore |

Indexes:

- Unique index on `canonical_url` for authoritative duplicate prevention.
- Index on `(archived_at, created_at)` for active/archive newest and oldest views.
- Index on `(archived_at, is_favorite)` for the favorite filter.

Notes:

- The saved `url` retains meaningful path, query, and fragment components. The retrieval service omits the fragment only for its network request.
- Metadata provenance is not persisted. Once saved, title and description are ordinary user-editable bookmark values.
- Search normalization is applied by the service over this bounded collection so Unicode comparison behavior is not tied to SQLite's default collation.

### Tag

Represents one reusable, flat organizational label.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | UUID string | Yes | Generated on creation; immutable primary key |
| `name` | String | Yes | Display form; 1–50 code points after trimming |
| `normalized_name` | String | Yes | Unicode-normalized, case-folded comparison key; unique |
| `created_at` | UTC timestamp | Yes | Set once at creation |

Rules:

- Tags that differ only by case, Unicode normalization, or surrounding whitespace refer to the same entity.
- The first accepted display form is retained until no bookmark uses the tag.
- Orphan tags are removed after bookmark/tag updates so filters contain only usable tags.

### BookmarkTag

Joins bookmarks and tags.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `bookmark_id` | UUID string | Yes | Foreign key to `bookmarks.id`, cascading on bookmark delete |
| `tag_id` | UUID string | Yes | Foreign key to `tags.id`, cascading on tag delete |

The composite `(bookmark_id, tag_id)` is the primary key. One bookmark may have at most 20 tags.

## Transient Models

### LibraryViewState

Encoded in browser URL search parameters, not stored in SQLite.

| Field | Values | Default |
|---|---|---|
| `view` | `active`, `archived` | `active` |
| `q` | Search string up to 200 code points | Empty |
| `tags` | Zero or more normalized tag names | Empty |
| `favorite` | `true` or absent | Absent |
| `sort` | `newest`, `oldest`, `title` | `newest` |

Unknown or invalid values are ignored or replaced with defaults. Search matches normalized title, URL, description, or any tag. Multiple selected tags use AND semantics; tag/favorite/search filters also combine with AND semantics.

### MetadataPreview

Represents the best-effort result for the current save-form URL; it is never persisted.

| Field | Type | Meaning |
|---|---|---|
| `request_id` | Monotonic client token | Prevents a stale response from applying to a newer URL |
| `normalized_url` | String | URL interpretation used by the server |
| `status` | `available`, `partial`, `unavailable` | Whether title and/or description were found |
| `title` | String or null | Sanitized page-provided title |
| `description` | String or null | Sanitized page-provided description |
| `message` | String or null | Safe user-facing outcome; contains no internal network detail |

The save form separately tracks `titleDirty` and `descriptionDirty`. A response can populate only a non-dirty field and only when its request token and URL still match the current form.

## Relationships

```text
Bookmark 1 ─────< BookmarkTag >───── 1 Tag

LibraryViewState ──queries──> Bookmark + Tag
MetadataPreview ──proposes values──> unsaved Bookmark form
```

## State Transitions

### Bookmark lifecycle

```text
new form
   │ save (metadata available, partial, pending, or unavailable)
   ▼
active ──archive──> archived
  ▲                    │
  └──────restore───────┘

active or archived ──confirmed delete──> removed (terminal)
```

- Canceling delete makes no transition.
- Editing may occur in active or archived state and does not change the state.
- Opening the external destination makes no data transition.

### Metadata preview

```text
idle ──valid URL──> loading ──details found──> available/partial
  ▲                    └────failure/timeout──> unavailable
  └────URL changed or request canceled───────────────┘
```

Save is permitted from every metadata-preview state. Saving from `idle`, `loading`, or `unavailable` uses the entered title or normalized URL fallback and permits a blank description.

## Transaction Boundaries

- Create bookmark: insert bookmark, upsert normalized tags, and insert join rows in one transaction.
- Edit bookmark: update bookmark, replace tag joins, and remove newly orphaned tags in one transaction.
- Archive/restore: update `archived_at` and `updated_at` atomically.
- Delete: remove bookmark and cascading joins, then remove orphaned tags in one transaction.
- A unique-canonical-URL violation is translated to a duplicate response with the existing bookmark ID; it never produces two rows.

## Validation Invariants

- Only HTTP and HTTPS bookmark URLs are accepted; embedded URL credentials are rejected.
- Metadata retrieval is stricter than saving: a valid bookmark may be saved even when its destination address or port is ineligible for server retrieval.
- Title fallback is applied on the server so an empty or bypassed client cannot persist a blank title.
- Auto-filled values and user-entered values use the same storage limits and plain-text rules.
- All timestamps are stored in UTC and emitted as RFC 3339 strings.
- All database writes use prepared statements and foreign-key enforcement.

