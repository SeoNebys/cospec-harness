# Data Model: Bookmark Manager

## Overview

SQLite is the source of truth. Dates are UTC timestamps. Booleans use constrained integers. Multi-table writes use transactions, and foreign-key enforcement is enabled for every connection.

## Bookmark

Represents one unique saved destination.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID text | Primary key; immutable |
| `url` | text | Required; valid `http` or `https`; trimmed; no embedded credentials |
| `normalized_url` | text | Required; unique; scheme and host lowercased; path, query, and fragment preserved |
| `title` | text | Required after metadata/manual entry; 1–200 characters |
| `note_source` | text | Optional constrained Markdown; maximum 2,000 characters |
| `note_search_text` | text | Plain text derived from supported note content; maintained with note changes |
| `is_favorite` | boolean | Required; default false |
| `is_read_later` | boolean | Required; default false |
| `is_read` | boolean | Required; default false |
| `is_archived` | boolean | Required; default false |
| `created_at` | timestamp | Required; immutable |
| `updated_at` | timestamp | Required; changes on user-visible mutation |

### Invariants

- `normalized_url` is unique across active and archived bookmarks.
- Editing a URL re-runs normalization and duplicate enforcement.
- Adding to read later sets `is_read_later = true` and `is_read = false`.
- Marking read retains `is_read_later = true` and sets `is_read = true`.
- Marking unread sets `is_read_later = true` and `is_read = false`.
- Removing from read later sets both read-later and read flags false.
- Favorite and reading changes never mutate each other.
- Archiving never erases favorite, reading, note, tag, or media data.

### State transitions

```text
Not in read later --add--> Unread --mark read--> Read
        ^                   ^                  |
        |                   |--mark unread-----|
        +-------remove------+------------------+

Active --archive--> Archived --restore--> Active
```

## Tag

| Field | Type | Rules |
|---|---|---|
| `id` | integer | Primary key |
| `name` | text | Required; trimmed display value; 1–40 characters |
| `normalized_name` | text | Required; case-folded; unique |

Tags with no bookmark relationships are deleted in the same transaction that removes their final relationship.

## BookmarkTag

| Field | Type | Rules |
|---|---|---|
| `bookmark_id` | UUID text | Foreign key to Bookmark; cascade on bookmark delete |
| `tag_id` | integer | Foreign key to Tag; cascade on tag delete |

The composite key is (`bookmark_id`, `tag_id`). A bookmark may have at most 20 tags.

## MediaAsset

Optional cached site icon or preview image.

| Field | Type | Rules |
|---|---|---|
| `id` | UUID text | Primary key |
| `bookmark_id` | UUID text | Foreign key to Bookmark; cascade on delete |
| `kind` | enum text | `icon` or `preview`; unique per bookmark/kind |
| `content_type` | enum text | PNG, JPEG, WebP, or GIF MIME type |
| `bytes` | blob | Required; maximum 2 MiB |
| `source_url` | text | Original public image URL for traceability; never loaded by the client |
| `created_at` | timestamp | Required |

Retrieval failure leaves no row and resolves to a neutral placeholder. Replacing media is transactional; a failed refresh retains the last valid asset until explicit replacement or removal.

## Search projection

Each bookmark exposes normalized searchable text containing title, URL, plain note text, and tag names. The parser in `contracts/search-grammar.md` evaluates against this projection plus exact normalized tag membership.

Indexes support normalized URL uniqueness, state filtering, created/title ordering, and tag lookup/joins.

## Delete semantics

Confirmed deletion is permanent. Bookmark-tag relationships and cached media cascade; newly orphaned tags are removed in the same transaction. No soft-delete state is introduced because archive already provides reversible removal.
