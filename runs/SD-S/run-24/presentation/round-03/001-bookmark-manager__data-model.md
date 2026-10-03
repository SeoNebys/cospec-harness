# Data Model: Personal Bookmark Manager

## Overview

The persistent model uses three relational entities: bookmarks, tags, and their many-to-many relationship. Collection view state is represented in the browser URL and is not stored in the database.

## Bookmark

Represents one saved web destination.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | Integer | Yes | Database-generated positive primary key; immutable |
| `title` | Text | Yes | Trimmed; 1–200 Unicode characters |
| `url` | Text | Yes | Trimmed submitted value; 1–2,048 characters; valid HTTP(S) URL |
| `normalized_url` | Text | Yes | Deterministic comparison key; unique and immutable except when URL changes |
| `notes` | Text | Yes | Trimmed; empty string allowed; maximum 5,000 characters |
| `is_favorite` | Boolean integer | Yes | `0` or `1`; defaults to `0` |
| `is_archived` | Boolean integer | Yes | `0` or `1`; defaults to `0` |
| `created_at` | UTC timestamp text | Yes | Set once at creation; ISO 8601 format |
| `updated_at` | UTC timestamp text | Yes | Set at creation and changed after each successful mutation |

### Bookmark validation

1. Trim title, URL, and notes before measuring their limits.
2. Parse the URL with the WHATWG URL parser and reject protocols other than `http:` and `https:`.
3. Produce `normalized_url` by normalizing scheme/host case, default ports, percent encoding, equivalent root forms, and a trailing slash that is the sole difference at the end of a non-root path. Preserve path case, query content/order, and fragment.
4. Reject a create or update when another bookmark owns the same `normalized_url`.
5. Apply field validation before opening a database transaction; retain database constraints as the integrity backstop.

### Bookmark indexes

- Unique index on `normalized_url`.
- Index on `(is_archived, created_at, id)` for the default and date-sorted views.
- Index on `(is_archived, is_favorite, updated_at, id)` for status views.
- Title, URL, notes, and tag search uses escaped literal matching. With a maximum of 5,000 records, full-text indexing is deferred until measurements show it is necessary.

## Tag

Represents a reusable label shared by bookmarks.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | Integer | Yes | Database-generated positive primary key; immutable |
| `name` | Text | Yes | First retained display spelling; 1–40 characters |
| `normalized_name` | Text | Yes | Trimmed, Unicode-normalized, internal whitespace collapsed, lowercase comparison key; unique |

### Tag validation

- Each bookmark may have 0–20 distinct normalized tags.
- Empty tags are rejected rather than silently stored.
- Duplicate tag values within one request collapse to one tag while preserving first-entry order in the response.
- Changing or removing tags from a bookmark does not rename shared tags. Orphaned tags are removed after a successful relationship update so filters do not show unused values.

## BookmarkTag

Represents membership of a tag on a bookmark.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `bookmark_id` | Integer | Yes | Foreign key to Bookmark with delete cascade |
| `tag_id` | Integer | Yes | Foreign key to Tag with delete cascade |

The composite primary key `(bookmark_id, tag_id)` prevents duplicate membership. Both foreign-key columns are indexed as needed for filtering and cleanup.

## Collection View State

Represents presentation choices encoded in the page URL rather than persisted business data.

| Field | Type | Default | Rules |
|---|---|---|---|
| `q` | Text | Empty | Literal case-insensitive match against title, URL, notes, or tag name |
| `tags` | List of normalized tag names | Empty | All selected tags must be present |
| `favorite` | Boolean or unset | Unset | When `true`, show only favorites; unset does not constrain favorite state |
| `archived` | Boolean | `false` | Default excludes archived bookmarks; `true` shows archived bookmarks |
| `sort` | Enum | `newest` | `newest`, `oldest`, `title`, or `updated` |

Changing a bookmark may remove it from the current result set, but the view-state values themselves remain unchanged. A single reset action restores all defaults.

## Relationships

```text
Bookmark 1 ───< BookmarkTag >─── 1 Tag
```

- A bookmark has zero to twenty tags.
- A tag has one or more bookmarks after orphan cleanup.
- Deleting a bookmark cascades to its relationship rows, then removes newly orphaned tags in the same transaction.

## State Transitions

Favorite and archive state are independent.

```text
Active, not favorite  ──favorite──> Active, favorite
Active, favorite      ──unfavorite> Active, not favorite
Active, either        ──archive────> Archived, same favorite state
Archived, either      ──restore────> Active, same favorite state
Any persisted state   ──delete─────> Permanently removed (after UI confirmation)
```

- Editing title, URL, notes, or tags does not change favorite/archive state.
- Every successful edit, favorite toggle, archive, or restore advances `updated_at`.
- Canceling deletion produces no state transition and no timestamp change.
- A duplicate or invalid mutation is atomic: no bookmark field, tag, relationship, or timestamp changes.

## Transaction Boundaries

- **Create**: insert bookmark, upsert normalized tags, insert relationship rows, commit.
- **Edit details/tags**: validate duplicate ownership, update bookmark, replace relationship rows, remove orphan tags, commit.
- **Favorite/archive change**: update the bookmark and timestamp in one statement.
- **Delete**: delete bookmark with cascading relationships, remove orphan tags, commit.

## Deterministic Ordering

Every sort includes `id` as a final tie-breaker so results do not jump unpredictably:

- `newest`: `created_at DESC, id DESC`
- `oldest`: `created_at ASC, id ASC`
- `title`: case-insensitive title ascending, then `id ASC`
- `updated`: `updated_at DESC, id DESC`
