# Data Model: Bookmark Manager

## User and authentication records

Better Auth owns the User, Account, Session, and Verification tables. The application references `User.id` but does not duplicate authentication data.

### User

- `id`: stable opaque identifier, primary key
- `name`: optional display name
- `email`: required, normalized and unique
- `emailVerified`: verification state managed by authentication library
- `createdAt`, `updatedAt`: audit timestamps

### Session

- Opaque session token and expiration associated with exactly one User
- Revoked at logout and rotated according to authentication-library policy

## Bookmark

Represents one saved destination owned by one User.

| Field | Rules |
|---|---|
| `id` | Stable opaque identifier; primary key |
| `ownerId` | Required foreign key to User; immutable |
| `title` | Required; trimmed/collapsed; 1–200 characters |
| `url` | Required user-facing WHATWG-serialized `http`/`https` URL; maximum 2,048 characters; no embedded credentials |
| `normalizedUrl` | Required duplicate-comparison key produced by the shared URL normalizer |
| `createdAt` | Set on creation; immutable |
| `updatedAt` | Set on creation and every successful edit |

Constraints and indexes:

- Unique `(ownerId, normalizedUrl)` prevents owner-local duplicates and write races.
- Index `(ownerId, createdAt DESC, id DESC)` supports stable collection pagination.
- Trigram GIN indexes on searchable title and normalized URL fields support partial matching.
- Deleting a User cascades to their bookmarks under the authentication/account-deletion policy.

## Tag

Represents a reusable owner-local label.

| Field | Rules |
|---|---|
| `id` | Stable opaque identifier; primary key |
| `ownerId` | Required foreign key to User; immutable |
| `name` | First accepted display spelling; trimmed/collapsed; 1–50 characters |
| `normalizedName` | Unicode-normalized, whitespace-normalized, locale-independent case-folded comparison/search key |
| `createdAt` | Set on creation |

Constraints and indexes:

- Unique `(ownerId, normalizedName)` merges capitalization/whitespace equivalents.
- Trigram GIN index on `normalizedName` supports partial search.
- Tags with no remaining bookmark associations are removed within the mutation transaction.

## BookmarkTag

Many-to-many association between Bookmark and Tag.

| Field | Rules |
|---|---|
| `bookmarkId` | Foreign key to Bookmark; cascades on bookmark deletion |
| `tagId` | Foreign key to Tag; cascades on tag deletion |

- Composite primary key `(bookmarkId, tagId)` prevents repeated associations.
- Index `(tagId, bookmarkId)` supports tag filtering.
- Service code verifies both records share the session owner before association.
- A bookmark has 0–20 distinct tags.

## Derived collection view

Each returned bookmark includes `id`, `title`, `url`, sorted tags, `createdAt`, and `updatedAt`. Collection queries accept optional search text and one tag identifier, then apply owner scoping, filtering, descending creation order with ID tie-breaker, and cursor pagination (maximum 50).

## State transitions

1. **Absent → Saved**: Validate fields, normalize URL/tags, create/reuse owner tags, create bookmark and associations in one transaction.
2. **Saved → Updated**: Revalidate all submitted fields, enforce owner-scoped duplicate uniqueness, replace associations atomically, update timestamp.
3. **Saved → Deleted**: Explicit UI confirmation precedes an atomic server deletion; orphaned tags are cleaned up.
4. **Any failed mutation → Prior saved state**: Transaction rolls back; typed feedback is returned with no partial changes.

## URL equivalence examples

- Equivalent: `HTTP://Example.com:80` and `http://example.com/`.
- Distinct: `https://example.com/a` and `https://example.com/A`.
- Distinct: `https://example.com/?a=1&b=2` and `https://example.com/?b=2&a=1`.
- Distinct: `https://example.com/#one` and `https://example.com/#two`.
