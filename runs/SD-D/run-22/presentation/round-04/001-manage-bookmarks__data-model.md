# Data Model: Personal Bookmark Manager

## Bookmark

| Field | Type | Rules |
|-------|------|-------|
| `id` | UUID text | Primary key; generated on creation |
| `url` | text | Original user-facing absolute HTTP/HTTPS URL; required |
| `normalized_url` | text | Required and unique; lowercase scheme/host, remove fragment and default port, normalize an empty path to `/`, preserve query |
| `title` | text | Required; 1–300 normalized characters; retrieved, user-edited, or generated fallback |
| `description` | nullable text | At most 2,000 normalized characters |
| `icon_path` | nullable text | App-controlled path to a validated cached raster icon; never arbitrary markup |
| `notes` | nullable text | Plain text; at most 10,000 characters |
| `read_later` | boolean | Defaults to false |
| `is_read` | boolean | Defaults to false; meaningful only while `read_later` is true |
| `created_at` | timestamp text | Required, immutable UTC instant |
| `updated_at` | timestamp text | Required UTC instant; changes on user-visible mutation |

Indexes cover `normalized_url`, `created_at`, normalized title, and `(read_later, is_read)`. The displayed URL is preserved even though duplicate detection uses the normalized form. Changing a URL reruns validation, normalization, duplicate detection, and metadata preview only when the user explicitly requests new suggestions.

## Tag

| Field | Type | Rules |
|-------|------|-------|
| `id` | integer | Primary key |
| `display_name` | text | Required; trimmed, 1–100 characters |
| `normalized_name` | text | Required and unique; Unicode NFKC, whitespace normalized, locale-independent case fold |

Tags are flat. A consistent existing display label is reused when a case-equivalent tag is entered.

## BookmarkTag

| Field | Type | Rules |
|-------|------|-------|
| `bookmark_id` | UUID text | Foreign key to Bookmark; cascade on deletion |
| `tag_id` | integer | Foreign key to Tag; delete unused tags after associations are removed |

The pair is the primary key. Updating a bookmark's tag set occurs in the same transaction as the bookmark update.

## SearchQuery (Transient)

| Field | Type | Rules |
|-------|------|-------|
| `raw` | text | At most 1,000 characters |
| `clauses` | ordered list | At most 50 parsed text, phrase, or tag-alternative conditions |
| `labels` | list of text | Human-readable active-condition descriptions returned to the client |

Search queries are parsed, validated, and discarded; they are not stored. Equivalent clauses and tag alternatives are deduplicated after normalization.

## MetadataPreview (Transient)

Contains the requested URL, optional final URL, overall outcome (`complete`, `partial`, or `failed`), warnings, and independent title, description, and icon results. Each field records a status and source. It is never persisted automatically; the user confirms the bookmark values to store.

## Relationships

- Bookmark has zero or more Tags through BookmarkTag.
- A Tag may belong to zero or more Bookmarks; unused tags may be removed.
- MetadataPreview proposes values for one unsaved or existing Bookmark but has no persisted relationship.
- SearchQuery selects Bookmarks without changing them.

## State Transitions

### Read-later state

```text
ordinary (read_later=false, is_read=false)
  └─ add to read later → unread (true, false)

unread (true, false)
  ├─ mark read → read (true, true)
  └─ remove from read later → ordinary (false, false)

read (true, true)
  ├─ mark unread → unread (true, false)
  └─ remove from read later → ordinary (false, false)
```

Opening a bookmark does not change this state. Deleting a bookmark removes all tag associations and any cached icon that no other record uses.

### Metadata preview state

```text
idle → loading → complete
               ↘ partial
               ↘ failed
```

All terminal preview states allow save when the URL itself is valid. Responses populate only untouched fields; user edits remain authoritative.

## Transaction Boundaries

- Create: duplicate check, bookmark insert, tag upserts, and associations commit together.
- Edit: duplicate check when URL changes, bookmark update, tag reconciliation, and orphan-tag cleanup commit together.
- Delete: bookmark and associations are removed together; cached icon cleanup may occur after commit.
- Reading-state changes update a single bookmark atomically.
