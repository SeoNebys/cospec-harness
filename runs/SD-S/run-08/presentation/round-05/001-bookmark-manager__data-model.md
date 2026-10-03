# Data Model: Bookmark Manager

## Bookmark

| Field | Type | Rules |
|---|---|---|
| `id` | UUID string | Primary key; generated on create |
| `url` | string | Canonical display URL; HTTP(S) only |
| `urlKey` | string | Unique normalized comparison key |
| `urlSearch` | string | Unicode-normalized search shadow |
| `title` | string | Required, trimmed, 1–300 characters |
| `titleSearch` | string | Unicode-normalized search shadow |
| `titleOrigin` | enum | `fetched`, `fallback`, or `user` |
| `note` | string | Optional, maximum 5,000 characters |
| `noteSearch` | string | Unicode-normalized search shadow |
| `iconAsset` | string/null | App-controlled relative asset identifier |
| `createdAt` | timestamp | Set once on create |
| `updatedAt` | timestamp | Updated on visible modification |

Rules:

- `urlKey` is unique. Normalization adds HTTPS when omitted, canonicalizes scheme, host, and default ports, strips fragments, and preserves path/query semantics.
- A title override or later edit sets `titleOrigin=user`; metadata never overwrites a `user` title.
- Search shadows update transactionally with display fields.
- Deleting a bookmark cascades to joins; unreferenced cached icons are cleaned safely after commit.

## Tag

| Field | Type | Rules |
|---|---|---|
| `id` | integer | Primary key |
| `name` | string | First-entered display spelling, 1–50 characters |
| `nameKey` | string | Unique Unicode-normalized comparison/search key |

Names are trimmed and internal whitespace collapsed. `nameKey` applies Unicode NFKC and locale-independent case folding. Empty normalized tags are rejected. The last removed association causes orphan cleanup in the same transaction.

## BookmarkTag

| Field | Type | Rules |
|---|---|---|
| `bookmarkId` | UUID string | Bookmark foreign key, cascade delete |
| `tagId` | integer | Tag foreign key, cascade delete |

The composite `(bookmarkId, tagId)` is the primary key. A reverse `(tagId, bookmarkId)` index supports filters.

## MetadataPreview

Transient browser result, not a database entity.

| Field | Type | Rules |
|---|---|---|
| `normalizedUrl` | string | Server-normalized HTTP(S) URL |
| `title` | string | Fetched title or editable fallback |
| `titleOrigin` | enum | `fetched` or `fallback` |
| `iconToken` | string/null | Expiring opaque reference to normalized icon |
| `warning` | string/null | Safe fallback explanation |
| `existingBookmarkId` | UUID/null | Existing duplicate when present |

Tokens expire and cannot reference arbitrary paths or remote URLs.

## Query model

- Text queries match escaped substrings across normalized title, URL, note, and tag keys.
- Text and tag filters combine with AND.
- Stable sorts: newest `(createdAt DESC, id DESC)`, oldest `(createdAt ASC, id ASC)`, alphabetical `(titleSearch ASC, id ASC)`.
- Opaque cursors encode and validate the active sort tuple; pages default to 50 and cap at 100.

## Transaction boundaries

- Create commits bookmark, tag upserts, and joins together.
- Update commits fields, shadows, tag upserts, join replacement, and orphan cleanup together.
- Delete commits bookmark cascade and orphan cleanup together; icon cleanup is retryable after commit.
- Constraint/service failure rolls back. URL uniqueness conflicts map to the existing bookmark ID.

## State transitions

```text
Metadata preview: requested → fetched
                         └──→ fallback

Title origin: fetched ──user edit──→ user
              fallback ─user edit──→ user

Bookmark: absent ─create──→ saved ─edit/tag──→ saved ─confirmed delete──→ absent
```
