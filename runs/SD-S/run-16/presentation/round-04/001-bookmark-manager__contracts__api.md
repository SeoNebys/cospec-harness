# API Contract: Bookmark Manager

Single-origin JSON API served by the Node process alongside the static
frontend. No authentication in v1 (single-user, single-device). All request and
response bodies are JSON (`Content-Type: application/json`). Base path: `/api`.

## Resource: Bookmark (serialized)

```json
{
  "id": 12,
  "url": "https://example.com/article",
  "title": "Example Article",
  "description": "A short summary of the page.",
  "faviconUrl": "https://example.com/favicon.ico",
  "previewImageUrl": "https://example.com/og.png",
  "notes": "Read later",
  "tags": ["reading", "tech"],
  "enrichmentStatus": "ready",
  "dateSaved": "2026-09-24T10:15:00.000Z"
}
```

`enrichmentStatus` ∈ `pending` | `ready` | `failed`.

---

## Endpoints

### `GET /api/bookmarks`

List bookmarks, most recent first (FR-005).

**Query parameters** (all optional):
- `q` — keyword; case-insensitive substring match over title, url, description
  (FR-007).
- `tag` — filter to bookmarks carrying this tag name (FR-014).

**Response** `200`:
```json
{ "bookmarks": [ /* Bookmark, … */ ] }
```
An empty array is a valid response and drives the empty / no-results state
(FR-008). The frontend polls this (or a single-bookmark endpoint) to observe
`enrichmentStatus` transitioning out of `pending` (background fill, FR-004).

---

### `POST /api/bookmarks`

Create a bookmark. Returns immediately; enrichment runs in the background
(FR-004, choice A).

**Request body**:
```json
{ "url": "example.com/article", "notes": "optional", "tags": ["optional"] }
```
- `url` required; scheme-less accepted and normalized (FR-003).
- `notes`, `tags` optional.

**Responses**:
- `201 Created` → the new Bookmark with `enrichmentStatus: "pending"` and a
  URL-derived `title`. Body is the serialized bookmark.
- `409 Conflict` → the normalized URL already exists (FR-011). Body identifies
  the existing bookmark so the UI can open its edit view:
  ```json
  { "error": "duplicate", "existing": { /* Bookmark */ } }
  ```
- `400 Bad Request` → missing or invalid URL (FR-002):
  ```json
  { "error": "invalid_url", "message": "Enter a valid web address." }
  ```

---

### `GET /api/bookmarks/:id`

Fetch a single bookmark (used to poll enrichment status for one item).

**Responses**:
- `200 OK` → the Bookmark.
- `404 Not Found` → no such id.

---

### `PUT /api/bookmarks/:id`

Update an existing bookmark (FR-009). Also the target of the duplicate-edit
flow (FR-011).

**Request body** (any subset; validated like creation):
```json
{ "url": "…", "title": "…", "description": "…", "notes": "…", "tags": ["…"] }
```
- Editing `url` re-validates and re-normalizes; if the new normalized URL
  collides with a *different* bookmark → `409 Conflict` (as above).
- Editing `url` resets `enrichmentStatus` to `pending` and re-triggers
  background enrichment.

**Responses**:
- `200 OK` → the updated Bookmark.
- `400 Bad Request` → invalid URL.
- `404 Not Found` → no such id.
- `409 Conflict` → normalized URL collides with another bookmark.

---

### `DELETE /api/bookmarks/:id`

Delete a bookmark (FR-010). The confirmation step is a UI responsibility; the
API performs the delete unconditionally.

**Responses**:
- `204 No Content` → deleted.
- `404 Not Found` → no such id.

---

### `GET /api/tags`

List all known tag names (to power the tag filter UI, FR-014).

**Response** `200`:
```json
{ "tags": ["reading", "tech", "recipes"] }
```

---

## Error format

All error responses use:
```json
{ "error": "<machine_code>", "message": "<human-readable, actionable>" }
```
Machine codes used: `invalid_url`, `duplicate`, `not_found`, `validation`.

## Non-endpoint contract: static frontend

- `GET /` serves `index.html`; `/app.js`, `/styles.css` served as static
  assets. The primary UI container carries `data-harness-ready="true"` once the
  initial bookmark list (or a valid empty state) has loaded — set after the
  first `GET /api/bookmarks` resolves, not on a loading placeholder.
