# API Contract: Bookmark Manager

REST/JSON API served under `/api` from the same origin as the front end. All request
and response bodies are JSON. No authentication (single local user).

## Bookmark object (response shape)

```json
{
  "id": 1,
  "address": "https://example.com/article",
  "title": "An interesting article",
  "note": "Read the section on caching",
  "tags": ["reading", "web"],
  "createdAt": "2026-09-27T10:00:00.000Z",
  "updatedAt": "2026-09-27T10:00:00.000Z"
}
```

## GET /api/bookmarks

List bookmarks, most recent first. Supports optional filtering.

**Query parameters** (all optional):
- `q` — keyword; matches title, address, note, or tag (FR-006).
- `tag` — restrict to bookmarks carrying this tag (FR-007).

**200 Response**:
```json
{ "bookmarks": [ /* Bookmark objects */ ] }
```
Returns an empty array (not an error) when nothing matches (FR-012).

## GET /api/tags

List tag names that have at least one bookmark (for the filter UI).

**200 Response**:
```json
{ "tags": ["reading", "web"] }
```

## POST /api/bookmarks

Create a bookmark (FR-001).

**Request body**:
```json
{ "address": "example.com/x", "title": "", "note": "", "tags": ["web"] }
```
Only `address` is required. `tags` is an array of free-text strings.

**201 Response**:
```json
{ "bookmark": { /* Bookmark object */ }, "duplicateOf": null }
```
When the normalized address already exists, `duplicateOf` is the existing bookmark's
id; the new bookmark is still created (FR-011).

**400 Response** (missing or invalid address, FR-002):
```json
{ "error": "A valid web address is required." }
```

## GET /api/bookmarks/:id

Fetch one bookmark.

- **200**: `{ "bookmark": { ... } }`
- **404**: `{ "error": "Bookmark not found." }`

## PUT /api/bookmarks/:id

Edit a bookmark's title, note, and tags (FR-008). Address may also be updated
(re-validated per FR-002).

**Request body** (fields optional; provided fields replace prior values):
```json
{ "title": "New title", "note": "Updated", "tags": ["reading"] }
```

- **200**: `{ "bookmark": { /* updated */ } }`
- **400**: `{ "error": "..." }` on invalid address
- **404**: `{ "error": "Bookmark not found." }`

## DELETE /api/bookmarks/:id

Delete a bookmark (FR-009). The confirmation step is enforced in the UI before this
call is made.

- **204**: empty body on success
- **404**: `{ "error": "Bookmark not found." }`

## Notes

- Opening a bookmark's page (FR-010) is a client-side action (open `address` in a new
  tab) and needs no API endpoint.
- Errors use appropriate HTTP status codes with a JSON `{ "error": string }` body.
