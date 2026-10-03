# Phase 1 Contract: REST API

The server exposes a JSON REST API under `/api` and serves the SPA at `/`. All
request/response bodies are JSON. Errors use appropriate HTTP status codes with
`{ "error": "<message>" }`.

## Bookmark resource shape

```json
{
  "id": 12,
  "address": "https://example.com/article",
  "title": "Example Article",
  "description": "Notes about it",
  "tags": ["reading", "tech"],
  "isRead": false,
  "isArchived": false,
  "createdAt": "2026-09-24T10:00:00.000Z",
  "updatedAt": "2026-09-24T10:00:00.000Z"
}
```

## Endpoints

### `GET /api/bookmarks`
List bookmarks. Query params:
- `view` — `active` (default), `unread`, or `archive`. Selects the derived view
  (main list / read-later / archive).
- `q` — optional keyword; matches title, address, description, or tag.
- `tag` — optional tag name filter.
Returns `200` with an array of bookmarks, newest first.

### `POST /api/bookmarks`
Create a bookmark. Body: `{ address (required), title?, description?, tags? }`.
- Normalizes and validates `address`; invalid → `400`.
- If the normalized address already exists → `409 Conflict` with
  `{ "error": "...", "existingId": <id>, "existingArchived": <bool> }` so the
  client can open that bookmark for editing (FR-010). No duplicate is created.
- New bookmarks are created `unread` and `active` (FR-014, FR-016).
- Success → `201` with the created bookmark.

### `GET /api/bookmarks/:id`
Returns `200` with the bookmark, or `404` if not found.

### `PATCH /api/bookmarks/:id`
Update editable fields. Body may include any of:
`address`, `title`, `description`, `tags`, `isRead`, `isArchived`.
- A changed `address` is re-validated; a collision with another bookmark →
  `409` with `existingId` (FR-006, FR-010).
- Used for read/unread toggle (`isRead`) and archive/restore (`isArchived`).
- Success → `200` with the updated bookmark; `404` if not found.

### `DELETE /api/bookmarks/:id`
Permanently delete a bookmark (FR-007, FR-018). Success → `204`; `404` if not
found. Confirmation is enforced in the UI, not the API.

### `GET /api/tags`
Returns `200` with the list of tag names currently in use (for the tag filter).

## Notes

- Endpoints map directly to requirements: list/views (FR-004, FR-013, FR-015,
  FR-017), search/filter (FR-008, FR-009), create with de-dup (FR-010),
  edit-address (FR-006), read toggle (FR-014), archive/restore (FR-016, FR-017),
  delete (FR-007, FR-018).
- Empty and no-results states (FR-012) are rendered client-side from empty
  arrays.
