# Data Model: Bookmark Management

## Bookmark

Represents one saved web destination.

| Field | Type | Rules |
|---|---|---|
| `id` | opaque identifier | Required, immutable, unique |
| `url` | text | Required HTTP/HTTPS URL; preserved for navigation and editing |
| `normalized_url` | text | Required canonical comparison value; indexed but not globally unique because intentional duplicates are allowed |
| `title` | text | Required after metadata review; trimmed; 1–300 characters |
| `description` | text or null | User-editable gathered text; trimmed; maximum 1,000 characters |
| `notes` | text or null | User-authored text; trimmed; maximum 10,000 characters |
| `site_icon_url` | text or null | Resolved HTTP/HTTPS metadata URL |
| `preview_image_url` | text or null | Resolved HTTP/HTTPS metadata URL |
| `favorite` | boolean | Defaults to false |
| `reading_status` | enum | `to_read` or `read`; defaults to `to_read` |
| `archived_at` | timestamp or null | Null while active; set when archived |
| `created_at` | timestamp | Required, immutable |
| `updated_at` | timestamp | Required; advances on user-visible changes |

### Derived states

- **Active**: `archived_at` is null.
- **Archived**: `archived_at` has a value.
- **To Read view membership**: active and `reading_status = to_read`.
- **Favorites view membership**: active and `favorite = true`.

### State transitions

```text
active/to_read  <──reading change──>  active/read
      │                                  │
      └──────── archive ─────────────────┤
                                         ▼
                       archived (reading status retained)
                                         │
                                      restore
                                         ▼
                    active with prior reading status retained

active or archived ──confirmed permanent delete──> removed
```

Archiving and restoring retain all content, tag relationships, reading status, and favorite state. Permanent deletion removes the bookmark and its tag links in one transaction.

## Tag

Represents a reusable organizational label.

| Field | Type | Rules |
|---|---|---|
| `id` | opaque identifier | Required, immutable, unique |
| `name` | text | Required display value; trimmed; 1–50 characters |
| `normalized_name` | text | Required case-folded comparison value; unique |
| `created_at` | timestamp | Required, immutable |

A tag with no remaining bookmark relationships is removed and ceases to appear as a filter.

## BookmarkTag

Joins bookmarks and tags.

| Field | Type | Rules |
|---|---|---|
| `bookmark_id` | identifier | References Bookmark; cascade on permanent deletion |
| `tag_id` | identifier | References Tag; cascade when tag is removed |

The pair (`bookmark_id`, `tag_id`) is unique.

## MetadataPreview

A transient result returned before bookmark persistence; it is not stored independently.

| Field | Type | Rules |
|---|---|---|
| `requested_url` | text | The submitted address |
| `final_url` | text | Validated address after redirects |
| `title` | text or null | Selected from available page metadata |
| `description` | text or null | Selected from available page metadata |
| `site_icon_url` | text or null | Absolute validated HTTP/HTTPS candidate |
| `preview_image_url` | text or null | Absolute validated HTTP/HTTPS candidate |
| `warnings` | list of codes | Missing fields or non-fatal retrieval limitations |

## Query model

Library requests accept one scope (`active`, `to_read`, `favorites`, or `archived`), optional search text, one optional tag, optional favorite state, optional reading status, one sort choice, and pagination. Scope is always applied before user filters. Search matches title, URL, description, notes, or associated tag names case-insensitively. Sort choices are `created_desc`, `title_asc`, and `updated_desc`, each with `id` as a stable final tie-breaker.

## Integrity and indexes

- Foreign keys are enforced.
- Bookmark/tag replacement and orphan-tag cleanup occur transactionally.
- Index bookmarks by `archived_at`, `reading_status`, `favorite`, `created_at`, and `updated_at` for scoped lists.
- Index bookmark tags in both relationship directions.
- Index `normalized_url` for duplicate checks and `normalized_name` uniquely for canonical tags.
