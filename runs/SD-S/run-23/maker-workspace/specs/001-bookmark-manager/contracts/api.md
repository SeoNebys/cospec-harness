# API Contract: Bookmark Manager

REST/JSON over HTTP, same origin as the static frontend. All request and response
bodies are JSON. Base path: `/api`. Single-user; no authentication in v1.

Bookmark object shape (returned by endpoints):

```json
{
  "id": 12,
  "url": "https://example.com/article",
  "title": "Example Article",
  "description": "A short summary of the page.",
  "faviconUrl": "https://example.com/favicon.ico",
  "tags": ["reading", "work"],
  "createdAt": "2026-09-25T10:00:00.000Z",
  "updatedAt": "2026-09-25T10:00:00.000Z"
}
```

---

## GET /api/bookmarks

List bookmarks, newest first (FR-008, FR-013). Supports optional filtering.

**Query params** (all optional, combinable — FR-016, FR-017):
- `q` — search term matched against title, description, url, and tag names.
- `tag` — restrict to bookmarks carrying this tag (case-insensitive).

**200** → `{ "bookmarks": [ <bookmark>, ... ], "total": <int> }`
Empty array is valid (drives empty / no-results states, FR-018).

---

## POST /api/bookmarks

Create a bookmark from an address; server auto-collects metadata (FR-001, FR-004,
FR-007) and de-duplicates (FR-019).

**Request**:
```json
{ "url": "example.com/article", "tags": ["reading"] }
```
- `url` required. `tags` optional array of names (created/reused as needed).
- Optional `title` / `description` / `faviconUrl` may be supplied to override the
  auto-collected values at creation (FR-005).

**Responses**:
- **201 Created** → `{ "bookmark": <bookmark>, "existed": false }` — new bookmark;
  metadata collected (or gracefully defaulted on fetch failure, FR-007).
- **200 OK** → `{ "bookmark": <bookmark>, "existed": true }` — address already
  saved; the existing bookmark is returned so the client can navigate to it
  (FR-019). No duplicate created.
- **400 Bad Request** → `{ "error": "<message>" }` — missing or malformed url
  (FR-002).

---

## GET /api/bookmarks/:id

Fetch a single bookmark.

- **200** → `{ "bookmark": <bookmark> }`
- **404** → `{ "error": "Not found" }`

---

## PATCH /api/bookmarks/:id

Edit a bookmark's title, description, url, favicon, and/or tags (FR-010).

**Request** (any subset):
```json
{ "title": "New title", "description": "...", "url": "https://...", "faviconUrl": "https://...", "tags": ["work", "read-later"] }
```
- Supplied `tags` replace the bookmark's tag set (names created/reused,
  normalized per FR-015).
- If `url` is changed to one that already exists on another bookmark → **409
  Conflict** `{ "error": "A bookmark with that address already exists", "id": <existingId> }`.
- Invalid `url` → **400**.

**Responses**: **200** → `{ "bookmark": <bookmark> }` · **400** · **404** · **409**

---

## DELETE /api/bookmarks/:id

Remove a bookmark (FR-011). Confirmation is enforced in the UI, not the API.

- **204 No Content** on success.
- **404** if not found.

---

## GET /api/tags

List all existing tag names for suggestions and the filter control (FR-014,
FR-016).

- **200** → `{ "tags": ["reading", "work", ...] }` (sorted, case-insensitive).

---

## Error format

All error responses use `{ "error": "<human-readable message>" }` with the
appropriate HTTP status. Metadata-collection failures are **not** errors — the
POST still succeeds (201) with fallback field values (FR-007).
