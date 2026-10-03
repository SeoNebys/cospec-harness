# HTTP API Contract

**Base path**: `/api`  
**Media type**: `application/json` unless noted  
**Authentication**: Opaque session cookie  
**Versioning**: Initial internal application API; breaking changes require coordinated client/server updates

## Cross-Cutting Rules

### Same-Origin and CSRF

- `GET /auth/session` establishes or refreshes an anonymous/authenticated CSRF binding and returns a CSRF token.
- Every state-changing request sends that value in `X-CSRF-Token`.
- State-changing requests with a missing/invalid CSRF token or disallowed Origin/Fetch-Metadata context return `403`.
- Authenticated responses use `Cache-Control: no-store` unless a media response declares private caching.

### Ownership

Every endpoint resolves resources with both authenticated `user_id` and public ID. Foreign-owned and nonexistent public IDs both return `404`; the API never reveals whether another user owns a guessed ID.

### Optimistic Concurrency

Mutable resource updates include `expectedVersion`. A stale version returns `409` with problem code `stale_version` and the current resource representation when safe.

### Problem Response

Errors use an RFC 9457-style document:

```json
{
  "type": "https://bookmark.local/problems/validation",
  "title": "Request validation failed",
  "status": 422,
  "detail": "One or more fields need attention.",
  "code": "validation_failed",
  "errors": [
    { "field": "title", "code": "too_long", "message": "Use 300 characters or fewer." }
  ],
  "requestId": "req_opaque"
}
```

Expected statuses: `400` malformed request, `401` unauthenticated, `403` CSRF/authorization policy, `404` not found, `409` duplicate/stale/count changed/merge required, `422` valid JSON with invalid fields or search, `429` throttled, `500` unexpected failure, `502` remote metadata failure when no partial preview can be produced.

### Pagination

Bookmark lists use stable opaque cursor pagination:

```json
{
  "items": [],
  "page": {
    "nextCursor": "opaque-or-null",
    "hasMore": false,
    "total": 0
  }
}
```

`limit` defaults to 50 and is bounded to 1–100. `total` reflects the full current criteria and supports bulk-selection messaging.

## Shared Representations

### BookmarkSummary

```json
{
  "id": "bmk_opaque",
  "url": "https://example.com/article",
  "title": "Example article",
  "description": "A short description.",
  "favicon": { "id": "med_opaque", "url": "/api/media/med_opaque" },
  "previewImage": { "id": "med_other", "url": "/api/media/med_other" },
  "tags": [{ "id": "tag_opaque", "name": "News" }],
  "collection": { "id": "col_opaque", "name": "Reference" },
  "isFavorite": true,
  "readingState": "unread",
  "archivedAt": null,
  "createdAt": "2026-09-18T10:00:00.000Z",
  "updatedAt": "2026-09-18T10:00:00.000Z",
  "version": 1
}
```

### BookmarkDetail

Extends BookmarkSummary with:

```json
{
  "noteMarkdown": "## Why I saved this\n\nUseful **reference**.",
  "notePlain": "Why I saved this Useful reference."
}
```

`notePlain` is display/search support only and is ignored if submitted by a client.

### SearchCriteria

```json
{
  "query": "#news AND \"climate policy\" NOT paywall",
  "includeTagIds": ["tag_include"],
  "excludeTagIds": ["tag_exclude"],
  "collection": { "mode": "id", "id": "col_opaque" },
  "favorite": "any",
  "reading": "unread",
  "context": "active",
  "sort": "newest"
}
```

`collection.mode` is `any`, `unfiled`, or `id`. See [search-syntax.md](./search-syntax.md) for expression behavior.

## Authentication

### `GET /auth/session`

Returns `200` for authenticated and anonymous callers:

```json
{
  "authenticated": true,
  "csrfToken": "opaque",
  "user": { "id": "usr_opaque", "email": "person@example.com" }
}
```

When anonymous, `user` is null. Response refreshes the CSRF binding but does not create an authenticated session.

### `POST /auth/register`

```json
{ "email": "person@example.com", "password": "long passphrase" }
```

Returns `201` with authenticated session representation and rotates both session and CSRF tokens. Duplicate-email handling uses a generic account message.

### `POST /auth/login`

Same request shape as registration. Returns `200` with session representation and rotates tokens. Invalid credentials return a generic `401`.

### `POST /auth/logout`

No body. Returns `204`, revokes the current session, and clears its cookie.

### `POST /auth/password-reset/request`

```json
{ "email": "person@example.com" }
```

Always returns `202` with the same generic message. Creation and delivery are throttled; only an existing account receives a token.

### `POST /auth/password-reset/confirm`

```json
{ "token": "opaque-from-link", "password": "new long passphrase" }
```

Returns `204`, consumes the token, changes the hash, and revokes all existing sessions. Invalid, expired, or consumed tokens return generic `422` code `invalid_reset_token`.

## Metadata and Media

### `POST /metadata/preview`

```json
{ "url": "https://example.com/article" }
```

Returns `200` even when some fields are unavailable:

```json
{
  "requestedUrl": "https://example.com/article",
  "finalUrl": "https://www.example.com/article",
  "title": { "value": "Article title", "source": "open_graph", "fallback": false },
  "description": { "value": "Short summary", "source": "meta_description", "fallback": false },
  "favicon": {
    "value": { "id": "med_draft_icon", "url": "/api/media/med_draft_icon" },
    "source": "link_icon"
  },
  "previewImage": {
    "value": { "id": "med_draft_preview", "url": "/api/media/med_draft_preview" },
    "source": "open_graph"
  },
  "warnings": []
}
```

Sources are `open_graph`, `twitter_card`, `html_title`, `meta_description`, `link_icon`, `favicon_fallback`, or `host_fallback`. Unavailable fields have `value: null` plus a warning. `finalUrl` is informational; the user-entered requested URL remains the default saved URL.

The endpoint is throttled per user. Unsafe destinations return `422` code `unsafe_destination`; malformed/unsupported URLs return `422` code `invalid_url`; bounded remote failures return a partial response when a fallback title is possible.

### `POST /media/capture`

Captures a user-supplied replacement visual through the same safe-fetch pipeline:

```json
{ "purpose": "preview", "url": "https://cdn.example.com/image.jpg" }
```

Returns `201` with a draft media summary. Purpose is `favicon` or `preview`. Invalid content type, oversize content, or unsafe destination returns `422` with a specific field error.

### `GET /media/{mediaId}`

Returns the authenticated user's media bytes with the stored allowlisted `Content-Type`, `X-Content-Type-Options: nosniff`, and private cache headers. Draft media is visible only to its owner before expiry. Unknown, expired, or foreign media returns `404`.

## Bookmarks

### `GET /bookmarks`

Query parameters:

- `query` — search expression;
- repeated `includeTag` and `excludeTag` public IDs;
- `collection=any|unfiled|{collectionId}`;
- `favorite=any|favorite|not_favorite`;
- `reading=any|none|unread|read`;
- `context=active|archive`;
- `sort=newest|oldest|title|updated`;
- `cursor` and `limit`.

Defaults: empty query, no tag filters, `collection=any`, `favorite=any`, `reading=any`, `context=active`, `sort=newest`. Returns paginated BookmarkSummary items. Invalid search follows the search error contract.

Convenience views use the same endpoint: favorites sets `favorite=favorite`, Read Later sets `reading=unread&context=active`, archive sets `context=archive`, and unfiled sets `collection=unfiled`.

### `POST /bookmarks`

```json
{
  "url": "https://example.com/article",
  "title": "Edited title",
  "description": "Edited short description",
  "noteMarkdown": "## Notes\n\nRead chapter 2.",
  "faviconAssetId": "med_draft_icon",
  "previewAssetId": "med_draft_preview",
  "tagIds": ["tag_existing"],
  "newTagNames": ["Research"],
  "collectionId": null,
  "isFavorite": false,
  "readingState": "unread"
}
```

Returns `201` BookmarkDetail. Submitted draft assets must be unexpired, owned by the caller, and match their purpose. New tag names are normalized and reuse an existing owned tag when equivalent.

A normalized URL collision returns `409`:

```json
{
  "type": "https://bookmark.local/problems/duplicate-bookmark",
  "title": "Bookmark already exists",
  "status": 409,
  "code": "duplicate_bookmark",
  "existingBookmark": { "id": "bmk_existing", "title": "Existing", "archived": true }
}
```

### `GET /bookmarks/{bookmarkId}`

Returns `200` BookmarkDetail for active or archived owned bookmarks.

### `PATCH /bookmarks/{bookmarkId}`

All fields except `expectedVersion` are optional; explicit null removes nullable values:

```json
{
  "expectedVersion": 3,
  "url": "https://example.com/new",
  "title": "New title",
  "description": null,
  "noteMarkdown": "Updated note",
  "faviconAssetId": null,
  "previewAssetId": "med_replacement",
  "tagIds": ["tag_one", "tag_two"],
  "newTagNames": [],
  "collectionId": "col_opaque",
  "isFavorite": true,
  "readingState": "read"
}
```

Returns updated `200` BookmarkDetail. URL changes rerun duplicate checks. Media changes validate and promote owned drafts. A stale version returns `409`.

### `POST /bookmarks/{bookmarkId}/archive`

```json
{ "expectedVersion": 3 }
```

Returns updated `200` BookmarkDetail. Already archived returns `409` code `invalid_state`.

### `POST /bookmarks/{bookmarkId}/restore`

Same body and response shape. An active bookmark returns `409`.

### `DELETE /bookmarks/{bookmarkId}`

```json
{ "expectedVersion": 4, "confirmation": "permanent" }
```

Returns `204`. Missing exact confirmation returns `422`; a stale version returns `409`. This endpoint does not archive.

## Tags

### `GET /tags`

Optional `suggest` performs case-insensitive prefix matching. Optional `limit` is bounded to 1–50. Returns tags ordered by exact-prefix quality, recent use, then name:

```json
{
  "items": [
    { "id": "tag_opaque", "name": "News", "bookmarkCount": 24, "version": 2 }
  ]
}
```

### `POST /tags`

```json
{ "name": "Research" }
```

Returns `201` tag. Normalized collision returns existing owned tag with `200` and `created: false` semantics rather than duplicating it.

### `PATCH /tags/{tagId}`

```json
{ "expectedVersion": 2, "name": "Reading" }
```

Returns `200`. If the normalized name belongs to another tag, returns `409` code `tag_merge_required` with target tag and affected bookmark/saved-search counts.

### `POST /tags/{tagId}/merge`

```json
{
  "expectedVersion": 2,
  "targetTagId": "tag_target",
  "confirmation": "merge"
}
```

Returns `200` surviving target tag plus moved-bookmark and changed-saved-search counts.

### `GET /tags/{tagId}/deletion-impact`

Returns affected counts. Used immediately before confirmation.

### `DELETE /tags/{tagId}`

```json
{ "expectedVersion": 2, "confirmation": "delete", "expectedBookmarkCount": 24, "expectedSavedSearchCount": 3 }
```

Returns `204`; changed counts return `409` with refreshed impact. Bookmarks remain and saved-search references to the tag are removed.

## Collections

### `GET /collections`

Returns owned collections ordered by name with active and archived bookmark counts.

### `POST /collections`

```json
{ "name": "Reference" }
```

Returns `201`. Normalized-name collision returns `409`.

### `PATCH /collections/{collectionId}`

```json
{ "expectedVersion": 1, "name": "Long-term reference" }
```

Returns updated `200` collection.

### `GET /collections/{collectionId}/deletion-impact`

Returns the number of bookmarks that will become unfiled.

### `DELETE /collections/{collectionId}`

```json
{ "expectedVersion": 1, "confirmation": "unfile", "expectedBookmarkCount": 12 }
```

Returns `204`; changed count returns `409`. Bookmarks and tags remain.

## Saved Searches

### `GET /saved-searches`

Returns owned saved searches ordered by name, including current criteria, current match count, and version.

### `POST /saved-searches`

```json
{
  "name": "Unread climate news",
  "criteria": {
    "query": "#news AND \"climate policy\"",
    "includeTagIds": ["tag_climate"],
    "excludeTagIds": ["tag_paywall"],
    "collection": { "mode": "any" },
    "favorite": "any",
    "reading": "unread",
    "context": "active",
    "sort": "updated"
  }
}
```

Returns `201` saved search with current match count. Duplicate normalized name returns `409`; invalid expression/filter ownership returns `422`/`404` according to cross-cutting rules.

### `GET /saved-searches/{savedSearchId}`

Returns saved configuration and current match count. The client runs it by sending its criteria to `GET /bookmarks`.

### `PATCH /saved-searches/{savedSearchId}`

Accepts `expectedVersion` plus optional `name` and/or full `criteria`. Returns updated `200`; stale version returns `409`.

### `DELETE /saved-searches/{savedSearchId}`

```json
{ "expectedVersion": 2 }
```

Returns `204` and never changes bookmarks.

## Bulk Actions

### Selection Forms

Explicit selection:

```json
{
  "mode": "ids",
  "items": [
    { "id": "bmk_one", "expectedVersion": 2 },
    { "id": "bmk_two", "expectedVersion": 5 }
  ]
}
```

All current matches:

```json
{
  "mode": "query",
  "criteria": {
    "query": "#news NOT paywall",
    "includeTagIds": [],
    "excludeTagIds": [],
    "collection": { "mode": "any" },
    "favorite": "any",
    "reading": "unread",
    "context": "active",
    "sort": "newest"
  }
}
```

Sort affects display but not membership; it remains in the snapshot so the visible state can be restored.

### Action Forms

```json
{ "type": "tags.add", "tagIds": ["tag_one"] }
{ "type": "tags.remove", "tagIds": ["tag_one"] }
{ "type": "reading.set", "value": "read" }
{ "type": "favorite.set", "value": true }
{ "type": "archive" }
{ "type": "restore" }
{ "type": "delete_permanently" }
```

### `POST /bookmarks/bulk/preview`

```json
{ "selection": { "mode": "query", "criteria": {} }, "action": { "type": "archive" } }
```

Returns:

```json
{
  "selectionCount": 125,
  "eligibleCount": 123,
  "ineligibleCount": 2,
  "ineligible": [
    { "id": "bmk_opaque", "reason": "already_archived" }
  ],
  "confirmation": {
    "required": true,
    "token": "single-use-opaque",
    "expiresAt": "2026-09-18T10:05:00.000Z",
    "expectedCount": 125
  }
}
```

Confirmation is required for archive, restore, and permanent delete. The preview token is user/action/selection-bound and cannot be replayed. Non-destructive actions may return `required: false`.

### `POST /bookmarks/bulk/execute`

```json
{
  "selection": { "mode": "query", "criteria": {} },
  "action": { "type": "archive" },
  "confirmationToken": "single-use-opaque"
}
```

Returns `200`:

```json
{
  "selectedCount": 125,
  "succeededCount": 123,
  "failedCount": 2,
  "failures": [
    { "id": "bmk_one", "code": "stale_version", "message": "Bookmark changed before the action ran." }
  ]
}
```

If an all-matches destructive/archive selection has changed count since preview, execution returns `409` code `selection_changed` with the refreshed count and no mutation. The client must show the new count and request a new preview/confirmation. For successful tag actions, every affected search projection is updated within the same transaction.

## Readiness and Health

### `GET /health/live`

Returns `200` when the process event loop can serve requests. Does not claim dependency readiness.

### `GET /health/ready`

Returns `200` only after configuration validation, migrations, database checks, asset-directory checks, and cleanup initialization complete. Otherwise returns `503`.

The rendered application places `data-harness-ready="true"` on its visible root only after the session request and initial library/valid-empty-state request complete successfully. Loading and fatal-error placeholders never carry the marker.
