# Data Model: Bookmark Manager

**Date**: 2026-09-24

## Model overview

```text
User 1 ─── * Session
User 1 ─── * Account
User 1 ─── * Bookmark
User 1 ─── * Tag
Bookmark * ─── * Tag   (through BookmarkTag, owner constrained)
```

Authentication tables are managed by Better Auth through the same Drizzle schema and SQLite database. Domain code reads the authenticated `User.id` but does not own credential or session lifecycle.

## User

Identity record managed by Better Auth.

| Field | Type | Rules |
|-------|------|-------|
| `id` | text | Primary key; opaque stable identifier |
| `name` | text | Required display name |
| `email` | text | Required and globally unique after auth normalization |
| `emailVerified` | boolean | Managed by authentication infrastructure |
| `image` | text or null | Optional; unused by bookmark v1 |
| `createdAt` | timestamp | Required |
| `updatedAt` | timestamp | Required |

Related Better Auth tables include `session`, `account`, and `verification`. Sessions are revocable and expire according to auth configuration. Password material belongs only in the auth-managed account record and is never exposed to domain code.

## Bookmark

A web destination owned by exactly one user.

| Field | Type | Rules |
|-------|------|-------|
| `id` | text | Primary key; application-generated opaque identifier |
| `ownerId` | text | Required foreign key to `User.id`; cascade on user deletion |
| `url` | text | Required normalized HTTP(S) destination; maximum 2,048 characters |
| `normalizedUrl` | text | Required duplicate key; same canonical serialization rules as `url` |
| `title` | text | Required after retrieval/fallback/user edit; trimmed; 1–300 characters |
| `description` | text or null | Optional; trimmed; empty becomes null; maximum 1,000 characters |
| `createdAt` | timestamp | Required; set once |
| `updatedAt` | timestamp | Required; refreshed after a successful edit |

### Bookmark constraints and indexes

- Unique constraint: `(ownerId, normalizedUrl)`.
- Unique support key: `(ownerId, id)` for ownership-safe associations.
- Listing index: `(ownerId, createdAt DESC, id DESC)`.
- Every select, update, and delete includes `ownerId`; clients never provide it.
- A different owner may save the same normalized URL.
- The fragment is removed during normalization. Scheme, host, default port, path, and query are serialized deterministically; query values/order are otherwise preserved.

## Tag

A case-insensitive organizational label owned by exactly one user.

| Field | Type | Rules |
|-------|------|-------|
| `id` | text | Primary key; application-generated opaque identifier |
| `ownerId` | text | Required foreign key to `User.id`; cascade on user deletion |
| `name` | text | Required display spelling; trimmed/collapsed; 1–50 characters |
| `normalizedName` | text | Required Unicode-normalized, case-folded uniqueness key |
| `createdAt` | timestamp | Required |

### Tag constraints and indexes

- Unique constraint: `(ownerId, normalizedName)`.
- Unique support key: `(ownerId, id)`.
- Lookup index: `(ownerId, normalizedName)`.
- Empty names are discarded. A bookmark may have at most 20 tags.
- Reusing a tag preserves its existing display spelling rather than creating a differently capitalized duplicate.

## BookmarkTag

Join record between bookmarks and tags.

| Field | Type | Rules |
|-------|------|-------|
| `ownerId` | text | Required; participates in both ownership-safe foreign keys |
| `bookmarkId` | text | Required |
| `tagId` | text | Required |

### BookmarkTag constraints and indexes

- Primary key: `(bookmarkId, tagId)`.
- Foreign key `(ownerId, bookmarkId)` references `Bookmark(ownerId, id)` with cascade delete.
- Foreign key `(ownerId, tagId)` references `Tag(ownerId, id)` with cascade delete.
- Index: `(ownerId, tagId, bookmarkId)` for filtered listings.
- The redundant `ownerId` is intentional: it makes cross-owner associations invalid at the database layer.

## Metadata preview (transient)

Metadata preview is a response model, not persisted independently.

| Field | Type | Rules |
|-------|------|-------|
| `requestId` | text | Correlates the latest editor request; never a credential |
| `url` | text | Normalized usable destination |
| `title` | text | Retrieved or fallback value; 1–300 characters |
| `description` | text or null | Retrieved page-provided description; maximum 1,000 characters |
| `status` | enum | `retrieved` or `fallback` |
| `warningCode` | enum or null | Safe category such as `unreachable`, `blocked`, `timeout`, `non_html`, or `missing_title` |
| `duplicate` | object or null | Existing owner-scoped bookmark ID/title when detected |

Internal resolved IP addresses, TLS details, and raw fetched markup never appear in this model.

## Validation rules

### URL

- Trim surrounding whitespace and parse with WHATWG URL behavior.
- Add `https://` only to a recognizable scheme-less hostname.
- Accept HTTP and HTTPS bookmarks only; reject credentials, malformed hosts, unsupported schemes, and values longer than 2,048 characters.
- Metadata inspection additionally requires a public multi-label destination on port 80/443. A safe but non-inspectable valid bookmark uses fallback metadata.
- Remove fragments and default ports. Do not strip query parameters or infer equivalence between HTTP and HTTPS.

### Retrieved text

- Decode entities; normalize Unicode; collapse whitespace; remove control and bidirectional formatting characters.
- Treat extracted markup only as text.
- Title priority: document title, Open Graph title, Twitter title.
- Description priority: standard page description, Open Graph description, Twitter description.
- A missing/unusable title produces a fallback from hostname plus a readable final path segment.

### Search

- Trim the query. Empty text means no text constraint.
- Match title, URL, description, or associated tag name case-insensitively.
- Escape SQL wildcard characters so user input is treated as text.
- An active tag filter is exact on the normalized tag name.
- Text and tag conditions combine with AND.

## Transactions

### Create bookmark

1. Resolve the authenticated owner.
2. Validate and normalize submitted fields.
3. Begin a transaction.
4. Insert the bookmark.
5. Upsert normalized owner tags.
6. Insert bookmark/tag associations.
7. Commit and return the complete bookmark.
8. Map `(ownerId, normalizedUrl)` constraint failure to `409 DUPLICATE_BOOKMARK` with the existing owner-scoped bookmark summary.

### Update bookmark

1. Resolve the owner and find `(ownerId, bookmarkId)`; otherwise return `404`.
2. Validate/normalize changes.
3. Begin a transaction.
4. Update fields and `updatedAt` with owner scope.
5. Upsert requested tags and replace associations.
6. Delete now-unused owner tags after association replacement.
7. Commit; map duplicate constraint failure to `409` without partial changes.

### Delete bookmark

Delete by `(ownerId, bookmarkId)` in a transaction. Join rows cascade; unreferenced owner tags are removed. A foreign or absent ID returns `404` with no observable distinction.

## State transitions

### Editor metadata state

```text
idle ──valid URL──> loading ──page metadata──> retrieved
  │                    ├──── retrieval issue ─> fallback
  └──invalid URL──────> invalid

Any URL edit invalidates the prior request.
User-edited title/description fields are never overwritten by a late response.
```

### Bookmark lifecycle

```text
not saved ──create transaction──> active
active ──valid update transaction──> active (updatedAt changes)
active ──confirmed delete──> permanently deleted
```

There is no trash/archive state in v1.
