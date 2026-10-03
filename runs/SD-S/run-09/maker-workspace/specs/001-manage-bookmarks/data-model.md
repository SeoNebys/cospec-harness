# Data Model: Personal Bookmark Manager

## Conventions

- Application IDs are positive SQLite integers. Better Auth owns text user/session/account identifiers.
- Timestamps are UTC milliseconds since the Unix epoch.
- Boolean values are constrained integers (`0` or `1`).
- User-entered display values are preserved after trimming; comparison keys use Unicode normalization and locale-independent lowercase.
- Foreign keys are enabled for every connection. All application queries are also explicitly scoped by authenticated `user_id`.
- All mutable entities carry `created_at` and `updated_at` unless noted.

## Auth-Owned Tables

Better Auth generates and migrates its required `user`, `session`, `account`, `verification`, and rate-limit tables. The application treats these tables as library-owned and references only `user.id`.

Configured invariants:

- User email is normalized and unique under Better Auth's schema.
- Credential passwords are stored only in Better Auth's account record as a scrypt hash.
- Sessions are database-backed, expire after seven days, and can be revoked immediately.
- Password-reset identifiers are hashed, expire after one hour, and are single use.

## Folder

Represents one user-owned grouping. A bookmark may reference at most one folder.

| Field        | Type    | Rules                                                    |
| ------------ | ------- | -------------------------------------------------------- |
| `id`         | integer | Primary key                                              |
| `user_id`    | text    | Required; references auth user, cascade on user deletion |
| `name`       | text    | Required; trimmed display value; 1–80 code points        |
| `name_key`   | text    | Required; normalized comparison key                      |
| `created_at` | integer | Required                                                 |
| `updated_at` | integer | Required                                                 |

Constraints and indexes:

- Unique `(user_id, name_key)` prevents visually equivalent duplicate folder names for one user.
- Unique `(id, user_id)` supports same-owner composite foreign keys.
- Index `(user_id, name_key)` supports navigation ordering.

Deletion transition:

1. In one transaction, set `folder_id = NULL` on the user's affected bookmarks.
2. Delete the folder.
3. Bookmarks remain otherwise unchanged.

## Tag

Represents one reusable user-owned label. A bookmark may have many tags.

| Field        | Type    | Rules                                                    |
| ------------ | ------- | -------------------------------------------------------- |
| `id`         | integer | Primary key                                              |
| `user_id`    | text    | Required; references auth user, cascade on user deletion |
| `name`       | text    | Required; trimmed display value; 1–50 code points        |
| `name_key`   | text    | Required; normalized comparison key                      |
| `created_at` | integer | Required                                                 |
| `updated_at` | integer | Required                                                 |

Constraints and indexes:

- Unique `(user_id, name_key)`.
- Unique `(id, user_id)` for same-owner composite foreign keys.
- Index `(user_id, name_key)`.

Rename/delete behavior:

- Renaming updates the canonical tag and refreshes every affected search row in the same transaction.
- Deleting cascades only through `bookmark_tag`; bookmarks remain.

## Icon Asset

Stores a validated site icon locally so the UI never hotlinks remote content.

| Field        | Type    | Rules                                                                       |
| ------------ | ------- | --------------------------------------------------------------------------- |
| `id`         | integer | Primary key                                                                 |
| `sha256`     | text    | Required; lowercase hex; unique                                             |
| `media_type` | text    | One of `image/png`, `image/jpeg`, `image/gif`, `image/webp`, `image/x-icon` |
| `byte_size`  | integer | Required; 1–262,144                                                         |
| `bytes`      | blob    | Required; validated signature agrees with `media_type`                      |
| `created_at` | integer | Required                                                                    |

Behavior:

- Assets are content-addressed and shared when byte-identical.
- SVG and unknown/polyglot content are not stored.
- An asset is served only through an authorized bookmark icon route; missing references use the built-in generic icon.
- An implementation task may garbage-collect unreferenced assets after bookmark deletion; garbage collection never affects a referenced bookmark.

## Bookmark

Represents one saved web address owned by one user.

| Field                   | Type         | Rules                                                                                                                    |
| ----------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `id`                    | integer      | Primary key                                                                                                              |
| `user_id`               | text         | Required; references auth user, cascade on user deletion                                                                 |
| `url`                   | text         | Required; trimmed user-facing HTTP(S) URL; fragment preserved                                                            |
| `normalized_url`        | text         | Required; canonical duplicate-detection value; fragment removed                                                          |
| `final_metadata_url`    | text/null    | Final public URL used only as metadata provenance; never replaces `url`                                                  |
| `title`                 | text         | Required; trimmed; 1–300 code points                                                                                     |
| `title_sort`            | text         | Required; normalized case-insensitive sorting key                                                                        |
| `title_source`          | text         | `page`, `fallback`, or `user`                                                                                            |
| `notes`                 | text/null    | Trimmed; at most 10,000 code points                                                                                      |
| `folder_id`             | integer/null | At most one folder; must belong to same user                                                                             |
| `is_favorite`           | integer      | Required; default `0`; constrained boolean                                                                               |
| `icon_asset_id`         | integer/null | References validated icon asset; null means generic icon                                                                 |
| `metadata_status`       | text         | `pending`, `ready`, `partial`, `blocked`, or `failed`                                                                    |
| `metadata_failure_code` | text/null    | Coarse non-sensitive reason such as `timeout`, `unreachable`, `ineligible`, `unsupported_content`, or `invalid_metadata` |
| `metadata_fetched_at`   | integer/null | Last completed attempt time                                                                                              |
| `created_at`            | integer      | Required                                                                                                                 |
| `updated_at`            | integer      | Required                                                                                                                 |

Constraints and indexes:

- Unique `(id, user_id)` supports same-owner joins.
- Composite foreign key `(folder_id, user_id)` references folder `(id, user_id)` when `folder_id` is present.
- Foreign key `icon_asset_id` uses `ON DELETE SET NULL`.
- Index `(user_id, created_at DESC, id DESC)` for newest and reverse traversal for oldest.
- Index `(user_id, title_sort, id)` for stable title order.
- Index `(user_id, normalized_url)` for duplicate warnings; it is deliberately not unique.
- Index `(user_id, folder_id, created_at DESC, id DESC)`.
- Index `(user_id, is_favorite, created_at DESC, id DESC)`.

Title-source transition rules:

```text
new URL ──► fallback
              │
              ├── successful metadata, if still fallback ──► page
              └── user edit at any time ────────────────────► user

page ─────► user       (user edits)
user ─────► user       (late metadata cannot overwrite)
```

- Metadata update uses a conditional write: update the title only where `title_source = 'fallback'`.
- A user edit atomically writes the title, `title_sort`, and `title_source = 'user'`.
- A changed URL begins a fresh metadata attempt, but an explicitly supplied title remains `user` and is not replaced.

Metadata-status transitions:

```text
pending ──► ready       title and icon captured
pending ──► partial     only some metadata captured
pending ──► blocked     destination is outside retrieval policy
pending ──► failed      bounded retrieval ended without usable metadata

blocked/failed/partial ──► pending   explicit user retry only
```

- Bookmark creation itself is committed before or independently of best-effort metadata completion.
- A stale `pending` record found after restart is eligible for one resumed bounded attempt; it cannot loop indefinitely.

## Bookmark Tag

Many-to-many same-owner association.

| Field         | Type    | Rules    |
| ------------- | ------- | -------- |
| `bookmark_id` | integer | Required |
| `tag_id`      | integer | Required |
| `user_id`     | text    | Required |

Constraints and indexes:

- Primary key `(bookmark_id, tag_id)` prevents duplicate assignment.
- Composite foreign key `(bookmark_id, user_id)` references bookmark `(id, user_id)`, cascade on bookmark deletion.
- Composite foreign key `(tag_id, user_id)` references tag `(id, user_id)`, cascade on tag deletion.
- Index `(user_id, tag_id, bookmark_id)` supports tag filtering.

## Bookmark Search

FTS5 virtual table maintained transactionally by the bookmark service.

| Column        | Purpose                                                  |
| ------------- | -------------------------------------------------------- |
| `bookmark_id` | Unindexed canonical bookmark ID; also used as FTS row ID |
| `user_id`     | Unindexed mandatory ownership filter                     |
| `title`       | Searchable current title                                 |
| `url`         | Searchable saved URL                                     |
| `tags`        | Searchable space-separated current tag display names     |

Configuration and invariants:

- Use FTS5 trigram tokenization with diacritic removal when supported by the bundled SQLite build.
- Every result joins back to `bookmark` and filters by authenticated `user_id` before folder/tag/favorite filters and sort are applied.
- User search input is escaped and passed as data, never interpreted as arbitrary FTS query syntax.
- Bookmark title/address changes and tag assignment changes update the FTS row in the same transaction.
- Tag rename/delete refreshes all affected bookmark rows in the same transaction.
- A maintenance command can rebuild this derived table from canonical tables and is covered by integration tests.

## Signed Metadata Receipt

A short-lived opaque value returned by metadata preview; it is not stored as a canonical entity.

Signed contents:

- Authenticated user ID.
- Normalized URL digest.
- Captured title and title source.
- Optional icon-asset ID.
- Final metadata URL if different.
- Metadata outcome.
- Issued-at and expiry timestamps, with a maximum ten-minute life.

The create-bookmark service verifies signature, expiry, user, and normalized URL before accepting the receipt. Without a valid receipt it saves fallback metadata and schedules one bounded attempt.

## Aggregate Transaction Boundaries

- **Create bookmark**: insert bookmark, tag associations, and search row atomically; duplicate detection is advisory and does not create a uniqueness constraint.
- **Edit bookmark**: validate same-user folder/tags, update bookmark and associations, then refresh search row atomically.
- **Delete bookmark**: delete bookmark and dependent associations/search row atomically; icon cleanup may occur afterward.
- **Rename/delete tag**: mutate tag and refresh all affected search rows atomically.
- **Delete folder**: clear folder associations and delete folder atomically.
- **Metadata completion**: upsert validated icon asset, conditionally update fallback title, update metadata fields, and refresh search row atomically.
