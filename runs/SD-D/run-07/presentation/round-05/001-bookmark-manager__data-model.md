# Data Model: Bookmark Manager

## Conventions

- Primary keys are opaque application IDs represented as strings at interfaces.
- Timestamps are UTC instants serialized as ISO 8601 strings.
- Booleans are constrained to `0` or `1` in SQLite and exposed as booleans.
- Text is trimmed on input. Optional empty text is stored as `NULL`.
- User-facing text limits: title 300 characters, description 1,000, note 20,000, tag display name 80, search query 2,000.
- All foreign keys are enabled; all write paths use explicit transactions.

## Bookmark

| Field | Type | Rules |
|---|---|---|
| `id` | string | Primary key; immutable |
| `url_original` | string | Valid HTTP(S) address shown to the user; no credentials |
| `url_normalized` | string | Unique canonical identity; fragment removed; immutable only until URL edit |
| `title` | string | Required; 1–300 characters |
| `description` | string/null | Editable page description; up to 1,000 characters |
| `note` | string/null | Personal plain-text note; up to 20,000 characters |
| `icon_asset_id` | string/null | References a validated local icon asset |
| `is_favorite` | boolean | Default `false` |
| `is_read` | boolean | Default `true`; independent of favorite/archive state |
| `archived_at` | timestamp/null | `NULL` means active; timestamp means archived |
| `created_at` | timestamp | Set once |
| `updated_at` | timestamp | Advances after any persisted user-visible change |

### URL normalization

1. Parse with the WHATWG URL parser.
2. Require `http:` or `https:`, a hostname, no embedded credentials, and an admitted port.
3. Use serialized canonical scheme and host, remove the fragment, and retain path and query semantics.
4. Enforce `UNIQUE(url_normalized)` on create and URL edit.
5. On collision, return the existing bookmark ID; never overwrite it.

### State transitions

```text
active/read ⇄ active/unread
     │              │
     └── archive ───┴──> archived (read state retained)
                             │
                             └── restore ──> active (read state retained)

favorite ⇄ not favorite     (independent of all states above)
any state ── confirmed delete ──> removed permanently
```

## Tag

| Field | Type | Rules |
|---|---|---|
| `id` | string | Primary key |
| `display_name` | string | First accepted spelling; 1–80 characters |
| `normalized_name` | string | Trimmed, Unicode NFKC normalized, locale-independent lowercase; unique |
| `created_at` | timestamp | Set once |

Tags containing only whitespace are rejected. Tag lookup, duplicate detection, filters, and `tag:` search use `normalized_name`; the UI uses `display_name`.

## BookmarkTag

| Field | Type | Rules |
|---|---|---|
| `bookmark_id` | string | Foreign key to Bookmark; cascade on delete |
| `tag_id` | string | Foreign key to Tag; cascade on delete |

The composite `(bookmark_id, tag_id)` is unique. Orphan tags may be removed after successful bookmark/tag mutations.

## SearchDocument

FTS5 contentful shadow record keyed by Bookmark row identity.

| Field | Source |
|---|---|
| `title` | Bookmark title |
| `url` | Original/display address |
| `description` | Bookmark description or empty text |
| `note` | Personal note or empty text |
| `tags_text` | Space-separated normalized and display tag values |

Use the `unicode61` tokenizer with diacritic removal. Repository helpers update the search document in the same transaction as every bookmark or tag mutation. A reconciliation command can rebuild and compare the index.

## IconAsset

| Field | Type | Rules |
|---|---|---|
| `id` | string | Content-derived identifier |
| `content_hash` | string | Unique digest for deduplication |
| `media_type` | enum | Admitted raster type only (`image/png`, `image/webp`, `image/x-icon`, `image/gif`, `image/jpeg`) |
| `relative_path` | string | Path within controlled icon storage; never user supplied |
| `byte_size` | integer | Positive and no more than 256 KiB |
| `created_at` | timestamp | Set once |

Assets are served from the application origin with their fixed validated media type and `nosniff`. An asset may be garbage-collected when no bookmark references it.

## MetadataCache

| Field | Type | Rules |
|---|---|---|
| `url_normalized` | string | Cache key |
| `status` | enum | `success`, `missing`, `blocked`, `timeout`, `failed` |
| `title` | string/null | Bounded normalized text |
| `description` | string/null | Bounded normalized text |
| `icon_asset_id` | string/null | Optional validated icon |
| `failure_code` | string/null | Stable non-sensitive category |
| `expires_at` | timestamp | Success default 24 hours; negative result default 5 minutes |
| `created_at` | timestamp | Set once |

Cache contents are suggestions only and never overwrite user edits to a saved bookmark.

## BulkOperation

| Field | Type | Rules |
|---|---|---|
| `id` | string | Primary key and confirmation token |
| `action` | enum | `add_tags`, `archive`, `mark_read`, `mark_unread`, `delete` |
| `payload` | object/null | Validated action parameters, such as normalized tag IDs |
| `status` | enum | `pending`, `running`, `completed`, `expired` |
| `target_count` | integer | Frozen snapshot count |
| `success_count` | integer | Default `0` |
| `failure_count` | integer | Default `0` |
| `created_at` | timestamp | Snapshot creation time |
| `expires_at` | timestamp | Confirmation deadline |
| `completed_at` | timestamp/null | Set once after execution |

Transitions: `pending → running → completed`; `pending → expired`. Reconfirming a completed operation returns its stored result without applying it twice.

## BulkOperationItem

| Field | Type | Rules |
|---|---|---|
| `operation_id` | string | Foreign key to BulkOperation; cascade on cleanup |
| `bookmark_id` | string | Frozen target ID |
| `ordinal` | integer | Deterministic target order |
| `status` | enum | `pending`, `succeeded`, `failed` |
| `failure_code` | string/null | Stable actionable failure category |

The composite `(operation_id, bookmark_id)` is unique. Each item executes within a savepoint inside the operation transaction.

## Search expression value object

Not persisted. The lexer produces position-bearing tokens; the parser produces an AST containing `Term`, `Phrase`, `Tag`, `Not`, `And`, and `Or`. It enforces maximum input length, token count, and nesting depth before compilation. The canonical display form is returned alongside result data.

## Integrity and indexes

- Unique indexes: Bookmark normalized URL, Tag normalized name, Icon content hash, BookmarkTag pair, BulkOperationItem pair.
- Filter/sort indexes: archive timestamp, read state, favorite state, created time, updated time; final choices verified using query plans and seeded benchmarks.
- Deleting a bookmark cascades tag joins, bulk item references are retained only for the operation lifetime, and its SearchDocument is removed transactionally.
- Startup enables foreign keys, WAL, and busy timeout, verifies FTS5, and applies migrations by schema version.
