# Data Model: Bookmark Management

## Conventions

- Primary identifiers are application-generated UUID strings.
- Timestamps are UTC and stored with millisecond precision.
- Every owned record is reached through an authenticated `user_id` predicate.
- Text limits are measured in Unicode characters at validation time, not storage bytes.
- Database migrations are checked in and applied explicitly before application startup.
- Foreign keys are enabled; user-owned child data is deleted when the owning account is deleted according to the account-deletion policy implemented later.

## Authentication Entities

Better Auth generates and owns the exact authentication schema. The application depends on these conceptual records rather than modifying them directly.

### User

| Field | Type | Rules |
|---|---|---|
| `id` | UUID/text | Primary key |
| `email` | text | Normalized, unique, not exposed to other users |
| `email_verified` | boolean | Required before normal bookmark use |
| `name` | text/null | Optional display value |
| `created_at` | timestamp | Immutable |
| `updated_at` | timestamp | Updated on account change |

### Session

| Field | Type | Rules |
|---|---|---|
| `id` | text | Opaque session record identifier |
| `user_id` | UUID/text | Foreign key to User |
| `token_digest` | text | Unique; raw browser token is never stored |
| `expires_at` | timestamp | Enforced server-side |
| `created_at` / `updated_at` | timestamp | Audit lifecycle |

### Account / Verification

Provider credential/account records and one-time verification/reset records follow Better Auth's generated schema. Reset tokens are time-limited, single-use, stored as digests, invalidated when superseded, and consumed atomically. A successful password reset revokes existing sessions.

## Bookmark Domain Entities

### Bookmark

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | UUID/text | yes | Primary key |
| `user_id` | UUID/text | yes | Foreign key to User; included in every query |
| `url` | text | yes | User-openable URL, max 4,096 characters, HTTP(S), no credentials |
| `normalized_url` | text | yes | Versioned deterministic identity key |
| `normalization_version` | integer | yes | Starts at 1; enables explicit future migrations |
| `title` | text | yes | Trimmed, 1–500 characters |
| `title_user_edited` | boolean | yes | Default false; prevents metadata refresh overwrite |
| `page_description` | text/null | no | Trimmed, max 2,000 characters |
| `description_user_edited` | boolean | yes | Default false; prevents metadata refresh overwrite |
| `icon_key` | text/null | no | Application-controlled reference to normalized PNG |
| `note_markdown` | text/null | no | Max 50,000 characters; raw HTML not rendered |
| `note_plain_text` | text | yes | Derived from parsed note for search; default empty |
| `reading_state` | enum text | yes | `none`, `unread`, or `read`; default `none` |
| `archived_at` | timestamp/null | no | Null means active; timestamp means archived |
| `metadata_status` | enum text | yes | `complete`, `partial`, `failed`, or `not_requested` |
| `metadata_fetched_at` | timestamp/null | no | Most recent completed attempt |
| `created_at` | timestamp | yes | Immutable |
| `updated_at` | timestamp | yes | Changes on any user-visible mutation |

**Constraints and indexes**:

- Unique `(user_id, normalized_url)` across active and archived bookmarks.
- Index `(user_id, archived_at, created_at DESC, id DESC)` for default/archive views.
- Index `(user_id, archived_at, reading_state, created_at DESC, id DESC)` for unread view.
- Index supporting case-folded title sorting with `id` as a stable tie-breaker.
- `reading_state` and `metadata_status` are constrained to their enumerated values.

### Tag

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | UUID/text | yes | Primary key |
| `user_id` | UUID/text | yes | Foreign key to User |
| `display_name` | text | yes | Trimmed, 1–64 characters |
| `normalized_name` | text | yes | Unicode-normalized, case-folded identity key |
| `created_at` | timestamp | yes | Immutable |

**Constraints and indexes**:

- Unique `(user_id, normalized_name)`.
- A tag never links to a bookmark owned by another user; service validation enforces same ownership before insertion.

### BookmarkTag

| Field | Type | Rules |
|---|---|---|
| `bookmark_id` | UUID/text | Foreign key to Bookmark; cascade on bookmark deletion |
| `tag_id` | UUID/text | Foreign key to Tag; cascade on tag deletion |

**Constraints and indexes**:

- Composite primary key `(bookmark_id, tag_id)` makes adding a tag idempotent.
- Reverse index `(tag_id, bookmark_id)` supports tag filtering and cleanup.
- Tags with no bookmark links may be removed after a successful mutation.

### BookmarkSearch

An FTS5 virtual table contains one flattened, owner-scoped document per bookmark.

| Column | Indexed | Content |
|---|---:|---|
| `bookmark_id` | no | Bookmark identity |
| `user_id` | no | Owner boundary used by surrounding query |
| `title` | yes | Current bookmark title |
| `url` | yes | Normalized/searchable URL text |
| `page_description` | yes | Current page description or empty text |
| `note_text` | yes | Derived plain text, never rendered HTML |
| `tag_text` | yes | Aggregated normalized tag names |

The application updates this record within the same transaction as bookmark or tag mutations. Rebuild tooling can regenerate the whole index from authoritative tables and is exercised in migration tests.

### IconAsset

| Field | Type | Required | Rules |
|---|---|---:|---|
| `key` | text | yes | Content digest/application key; primary key |
| `storage_path` | text | yes | Application-relative path to a normalized 64×64 static PNG |
| `byte_length` | integer | yes | Bounded and verified |
| `created_at` | timestamp | yes | Immutable |

Icons may be deduplicated by digest. Deleting a bookmark releases its reference; unreferenced icons can be removed by a safe maintenance job. The browser never receives the untrusted source icon URL.

## Transient Models

### MetadataDraft

Not authoritative and not persisted as a separate entity.

| Field | Type | Rules |
|---|---|---|
| `requested_url` | text | Validated input |
| `normalized_url` | text | Used for duplicate lookup |
| `title` | text | Retrieved or deterministic fallback |
| `page_description` | text/null | Retrieved when available |
| `icon_preview_key` | text/null | Safe temporary/cached normalized icon |
| `final_url` | text/null | Retrieval endpoint after redirects; never replaces saved identity automatically |
| `status` | enum | `complete`, `partial`, or `failed` |
| `warnings` | list | User-readable missing/failure information |

The create request revalidates all fields; the draft is never trusted as authorization or proof of retrieval.

### Selection

Client-side transient state containing up to 100 explicit bookmark IDs and the originating view/query signature. It is not a database entity. When the view criteria change, the UI either clears it or visibly retains and labels hidden selections before enabling an action.

### BulkResult

| Field | Type | Rules |
|---|---|---|
| `requested_count` | integer | Count of unique submitted IDs |
| `succeeded_ids` | list | Owned items changed or accepted as idempotent success |
| `failures` | list | ID plus safe code and retryability; never reveals another owner |

## State Transitions

### Reading state

| Current | Action | Next | Notes |
|---|---|---|---|
| `none` | Add to read later / mark unread | `unread` | Appears in unread view when active |
| `none` | Mark read | `read` | Supported by bulk action contract |
| `unread` | Mark read | `read` | Leaves unread view |
| `unread` | Remove tracking | `none` | Remains bookmarked |
| `read` | Mark unread | `unread` | Returns to unread view when active |
| `read` | Remove tracking | `none` | Remains bookmarked |
| any | Apply same state | unchanged | Idempotent success |

### Archive state

| Current | Action | Next | Reading state |
|---|---|---|---|
| active (`archived_at = null`) | Archive | archived (current timestamp) | Unchanged |
| archived | Restore | active (`archived_at = null`) | Unchanged |
| archived | Archive again | archived | Idempotent success |
| active | Restore | active | Idempotent success |

Derived views:

- Default: `archived_at IS NULL`
- Unread: `archived_at IS NULL AND reading_state = 'unread'`
- Archive: `archived_at IS NOT NULL`

### Permanent deletion

Any active or archived bookmark can transition to absent only through a request containing explicit IDs, `confirmPermanent: true`, and the expected item count. Bookmark-tag links and search entries are removed transactionally. The application exposes no restore transition after deletion.

### Metadata refresh and address edit

1. A new address is normalized and checked against the owner's active and archived bookmarks.
2. Retrieval produces a draft; failure still yields a deterministic fallback title.
3. On edit, retrieved title/description replace stored values only when the corresponding `*_user_edited` flag is false or the user explicitly accepts the proposal.
4. A uniqueness collision leaves the edited bookmark unchanged and returns the existing bookmark reference.
5. Icon replacement occurs only after safe normalization succeeds; failure retains the prior icon unless the user explicitly removes it.

## Validation and Ownership Rules

- Every route validates shape and limits before entering a transaction.
- Every repository operation takes `user_id`; lookup by bookmark/tag ID alone is prohibited.
- IDs not owned by the session user are reported as not found. Bulk results do not distinguish missing from other-user IDs.
- Empty optional text becomes null/empty consistently; passwords are never trimmed.
- Tag normalization is implemented once and shared between validation, persistence, search parsing, and uniqueness checks.
- Search query text is parsed into an AST and compiled only through parameterized predicates.
- User-provided Markdown, titles, descriptions, tags, and remote metadata are always treated as untrusted display text.
