# Data Model: Bookmark Manager

## Overview

The model stores a personal library of bookmarks and a reusable, normalized tag vocabulary. Search/filter inputs are transient browser state and are not persisted.

## Bookmark

Represents one saved web destination.

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `id` | Integer | Yes | Generated positive identifier; immutable |
| `url` | Text | Yes | Canonical absolute `http` or `https` URL; maximum 2,048 characters |
| `normalized_url` | Text | Yes | Derived duplicate-comparison form; indexed but not unique because confirmed duplicates are allowed |
| `title` | Text | Yes | Trimmed, non-empty, maximum 300 characters; retrieved, fallback-derived, or user-edited |
| `description` | Text or null | No | Trimmed; empty input stored as null; maximum 1,000 characters |
| `created_at` | UTC timestamp | Yes | Set once when created |
| `updated_at` | UTC timestamp | Yes | Set when created and changed on successful edit |

### URL normalization

- Parse with the platform URL parser; reject parse failures, schemes other than HTTP(S), and embedded credentials.
- Lowercase scheme and host, convert internationalized hostnames to their ASCII form, remove default ports, and remove the fragment.
- Preserve path, query parameter order, and query values because they may identify distinct resources.
- Treat an empty path and `/` consistently.
- Preserve the canonical URL as the openable destination and calculate `normalized_url` from it for duplicate comparisons.

### Bookmark validation

- A bookmark always has a title. Metadata retrieval supplies it, or fallback generation does when retrieval cannot.
- A user-provided title or description replaces the automatically supplied value.
- URL changes during editing use the same syntactic validation as creation. Automatic metadata refresh on edit is not required by v1.
- Duplicate normalized URLs are permitted only when the create or update request explicitly confirms the duplicate warning.

## Tag

Represents a reusable organizational label.

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `id` | Integer | Yes | Generated positive identifier; immutable |
| `name` | Text | Yes | Trimmed display form, maximum 50 characters |
| `normalized_name` | Text | Yes | Lowercased and whitespace-normalized; unique |

### Tag validation

- Blank tags are discarded.
- Equivalent values such as `Research`, ` research `, and `RESEARCH` share one normalized tag.
- A bookmark may have at most 20 distinct tags.
- The first stored display spelling remains the shared tag name until all associations are removed and a later bookmark recreates it.

## BookmarkTag

Many-to-many association between bookmarks and tags.

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `bookmark_id` | Integer | Yes | References `Bookmark.id`; cascades on bookmark deletion |
| `tag_id` | Integer | Yes | References `Tag.id`; cascades on tag deletion |

The pair `(bookmark_id, tag_id)` is the primary key. Tags left with no bookmark associations are removed after create/update/delete transactions.

## Relationships

```text
Bookmark 1 ──< BookmarkTag >── 1 Tag
```

- A bookmark has zero to twenty tags.
- A tag belongs to one or more bookmarks while it exists.

## Transient Metadata Preview

Not persisted. It bridges URL entry and bookmark creation.

| Field | Type | Rules |
|-------|------|-------|
| `url` | Text | Canonical openable URL |
| `normalizedUrl` | Text | Duplicate-comparison form |
| `title` | Text | Retrieved or fallback title |
| `description` | Text or null | Retrieved description or null |
| `source` | Enum | `remote` or `fallback` |
| `warning` | Text or null | Non-blocking explanation when fallback is used |

## Transient Library View State

Kept in browser state while the page is open.

| Field | Type | Rules |
|-------|------|-------|
| `query` | Text | Trimmed for matching; case-insensitive across bookmark and tag fields |
| `tag` | Text or null | One normalized tag filter at a time |

## State Transitions

### Create

```text
URL entered
  → invalid/unsafe: correction required
  → valid: metadata lookup
      → retrieved: editable remote title/description
      → unavailable: editable fallback title + warning
  → duplicate detected: cancel or explicitly continue
  → saved: bookmark and tag associations committed atomically
```

### Edit

```text
Saved → editing → validation failure (unchanged)
                → valid update (bookmark + tag associations committed atomically)
```

### Delete

```text
Saved → deletion requested → cancelled (unchanged)
                           → confirmed → permanently deleted
```

## Indexes and Query Behavior

- Index `bookmarks.created_at` with `id` as a stable newest-first tie-breaker.
- Index `bookmarks.normalized_url` for duplicate checks.
- Enforce a unique index on `tags.normalized_name`.
- Index both directions of `bookmark_tags` for lookup and cleanup.
- Search uses case-insensitive containment across title, URL, description, and associated tag names, optionally intersected with one normalized tag filter.
