# API Contract: Bookmark Manager

REST/JSON API exposed by the backend and consumed by the SPA. Single-user, no
auth. All request/response bodies are JSON. Base path: `/api`.

## Resource shape: Bookmark

```json
{
  "id": "b1f2...",
  "url": "https://example.com/article",
  "title": "Example Article",
  "description": "optional notes",
  "tags": ["reading", "tech"],
  "createdAt": "2026-07-13T10:00:00Z",
  "updatedAt": "2026-07-13T10:00:00Z"
}
```

`normalizedUrl` and `deletedAt` are internal and not returned.

---

## GET /api/bookmarks

List active bookmarks. Supports search, tag filter, and ordering.

**Query params**
- `q` (string, optional): free-text search over title, url, and tags (FR-010).
- `tag` (string, optional, repeatable): filter to bookmarks carrying the tag(s) (FR-011).
- `sort` (string, optional): `recent` (default, newest first, FR-016) | `title`.
- `limit`, `offset` (int, optional): pagination for large collections (FR-017).

**200 Response**
```json
{ "items": [ /* Bookmark */ ], "total": 1234 }
```

Empty collection returns `{ "items": [], "total": 0 }` (drives empty state FR-008).

---

## POST /api/bookmarks

Create a bookmark (FR-001, FR-003, FR-004, FR-009).

**Request**
```json
{ "url": "https://example.com", "title": "optional", "description": "optional", "tags": ["optional"] }
```

**Behavior**
- Validates `url` as `http`/`https` (FR-002). On failure → `400`.
- If `title` omitted, backend derives it (best-effort fetch, fallback to url) (FR-003).
- If `normalizedUrl` matches an existing active bookmark → `409` with the existing
  record, so the client can offer "open existing" or "update" (FR-015).

**Responses**
- `201` → created Bookmark.
- `400` → `{ "error": "invalid_url", "message": "..." }`.
- `409` → `{ "error": "duplicate", "existing": { /* Bookmark */ } }`.

---

## GET /api/bookmarks/:id

Fetch a single active bookmark. `200` → Bookmark; `404` if not found/deleted.

---

## PUT /api/bookmarks/:id

Edit title, url, description, and/or tags (FR-012).

**Request**: any subset of `{ url, title, description, tags }`.

**Responses**
- `200` → updated Bookmark; `updatedAt` refreshed.
- `400` → invalid url.
- `404` → not found.
- `409` → changing `url` collides with another active bookmark (FR-015).

---

## DELETE /api/bookmarks/:id

Soft-delete a bookmark, opening the undo window (FR-013, FR-014).

**Responses**
- `200` → `{ "id": "...", "undoToken": "...", "undoExpiresAt": "..." }`.
- `404` → not found.

Confirmation itself is a UI concern (FR-013); the API performs the delete when called.

---

## POST /api/bookmarks/:id/restore

Undo a recent soft-delete within the undo window (FR-014).

**Responses**
- `200` → restored Bookmark.
- `404` / `410` → not found or undo window elapsed (already purged).

---

## GET /api/tags

List tags in use with counts, for the filter UI (FR-011).

**200 Response**
```json
{ "tags": [ { "name": "tech", "count": 12 }, { "name": "reading", "count": 5 } ] }
```

---

## Error format

All errors share:
```json
{ "error": "<machine_code>", "message": "<human-readable explanation>" }
```
Human-readable `message` fields back the spec's user-friendly error requirement.
