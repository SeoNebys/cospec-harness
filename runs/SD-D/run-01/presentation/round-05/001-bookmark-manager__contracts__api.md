# API Contract: Bookmark Manager

Local REST API exposed by the backend to the frontend. JSON over HTTP on `localhost`.
Single user — no authentication. All paths prefixed `/api`.

## Bookmark representation

```json
{
  "id": 123,
  "url": "https://example.com/article",
  "title": "Example Article",
  "faviconUrl": "/api/bookmarks/123/favicon",
  "noteHtml": "<p>See <b>section 2</b></p>",
  "tags": ["reading", "research"],
  "dateSaved": "2024-05-01T10:30:00Z",
  "dateModified": "2026-07-13T09:00:00Z"
}
```

`faviconUrl` is null when no icon was captured. `noteHtml` is sanitized server-side.

## Endpoints

### Bookmarks

| Method | Path | Purpose | Maps to |
|--------|------|---------|---------|
| `GET` | `/api/bookmarks` | List/search/filter/sort bookmarks | FR-006, FR-011, FR-012, FR-014, FR-013 |
| `POST` | `/api/bookmarks` | Save a new bookmark from a URL | FR-001, FR-002/a, FR-003, FR-004 |
| `GET` | `/api/bookmarks/{id}` | Fetch one bookmark | FR-006 |
| `PATCH` | `/api/bookmarks/{id}` | Edit title, url, note, tags | FR-008, FR-010, FR-015 |
| `DELETE` | `/api/bookmarks/{id}` | Delete a bookmark | FR-009 |
| `GET` | `/api/bookmarks/{id}/favicon` | Return stored favicon bytes | FR-002a |

**`GET /api/bookmarks` query parameters**:
- `q` — search term; matches title/url/note/tags, case-insensitive (FR-012).
- `tag` — filter to a tag (FR-011).
- `sort` — `recent` (default) or `title` (FR-014).

Response: `{ "items": [Bookmark, ...], "total": N }`. Empty `items` is the empty/no-results
state the UI renders (FR-013).

**`POST /api/bookmarks`** — body `{ "url": "..." }`:
- `201 Created` with the Bookmark (title/favicon/description auto-filled best-effort).
- `200 OK` with `{ "bookmark": Bookmark, "duplicate": true }` when the normalized URL
  already exists — the client opens that bookmark for editing (FR-004).
- `422` when the URL is not a well-formed http/https address (FR-003).

**`PATCH /api/bookmarks/{id}`** — any subset of `{ url, title, noteHtml, tags }`:
- Re-validates `url` (FR-003) and re-checks uniqueness (FR-004).
- `noteHtml` sanitized to allowlist (links, bold, bullet lists) before save (FR-015).
- `tags` is the full desired set; server creates unknown tags and detaches removed ones.

**`DELETE`** — `204 No Content`. (Deletion confirmation is a client-side UX step, FR-009.)

### Tags

| Method | Path | Purpose | Maps to |
|--------|------|---------|---------|
| `GET` | `/api/tags` | All tag names with counts (for filter UI) | FR-011 |
| `GET` | `/api/tags/suggest?prefix=` | Existing tags matching a prefix, case-insensitive | FR-010a |

### Import / Export

| Method | Path | Purpose | Maps to |
|--------|------|---------|---------|
| `POST` | `/api/import` | Upload a Netscape bookmark HTML file | FR-016, FR-016a/b, FR-017 |
| `GET` | `/api/export` | Download the whole collection as a Netscape bookmark HTML file | FR-018 |

**`POST /api/import`** — multipart file upload:
- `200 OK` → `{ "added": 480, "skipped": 20 }` (skipped = already-present URLs; FR-016).
  Folders become tags (FR-016a); `ADD_DATE` becomes `dateSaved` (FR-016b).
- `422` when the file is not a recognized bookmark export — nothing is imported (FR-017).

**`GET /api/export`**:
- `200 OK` with a `text/html` bookmark file (`Content-Disposition: attachment`). A valid,
  empty file is returned when there are no bookmarks (FR-018, edge case). Re-importable
  here and into browsers (SC-008).

## Error shape

All error responses: `{ "error": { "code": "string", "message": "human-readable" } }`
with an appropriate HTTP status. Messages are user-friendly for surfacing in the UI.
