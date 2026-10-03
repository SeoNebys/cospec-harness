# REST API Contract: Bookmark Manager

Base: same origin, `/api`. JSON request/response. Single-user, no auth (v1).
Served by the Node process on `0.0.0.0:4000`.

## Bookmark shape (response)

```json
{
  "id": 1,
  "address": "https://example.com/article",
  "title": "Example Article",
  "description": "A short summary.",
  "iconUrl": "https://example.com/favicon.ico",
  "tags": ["news", "reading"],
  "createdAt": "2026-09-17T10:00:00.000Z",
  "updatedAt": "2026-09-17T10:00:00.000Z"
}
```

## GET /api/bookmarks

List bookmarks, most recently added first (FR-006). Optional query params:
- `search` — case-insensitive term matched against title, description, address,
  tags (FR-011).
- `tag` — return only bookmarks carrying this tag (FR-010).
- Both may be combined; both omitted returns all.

**200** → `{ "bookmarks": [ <Bookmark>, ... ] }` (empty array is a valid empty
state, FR-008).

## POST /api/bookmarks

Create a bookmark (FR-001). Body: `{ "address": "https://…" }` (tags optional:
`"tags": ["news"]`).

- **201** → `{ "bookmark": <Bookmark> }` created; title initially address-derived,
  metadata filled best-effort (FR-003/FR-004, non-blocking per research Decision 6).
- **200** → `{ "bookmark": <Bookmark>, "existing": true }` when the normalized
  address already exists — returns the existing bookmark so the client opens it for
  update instead of duplicating (FR-014/FR-015, SC-006).
- **400** → `{ "error": "..." }` when address is empty or malformed (FR-002).

## GET /api/bookmarks/:id

**200** → `{ "bookmark": <Bookmark> }`. **404** if not found.

## PUT /api/bookmarks/:id

Edit address, title, and/or description (FR-012). Body may include any of
`address`, `title`, `description`, `tags`.

- **200** → `{ "bookmark": <Bookmark> }` updated; edited address re-validated and
  re-normalized (FR-012). Changing tags replaces the bookmark's tag set, reusing
  existing tags (FR-009).
- **400** → `{ "error": "..." }` if the edited address is empty/malformed
  (previous value kept).
- **409** → `{ "error": "...", "existingId": N }` if the edited address normalizes
  to a different existing bookmark.
- **404** if not found.

## DELETE /api/bookmarks/:id

Delete a bookmark (FR-013; confirmation is enforced in the UI). Cascade removes
its tag associations.

- **204** on success. **404** if not found.

## GET /api/tags

List tags currently in use (for reuse suggestions and the filter control,
FR-009/FR-010). Tags with no bookmarks are excluded.

**200** → `{ "tags": ["news", "reading", ...] }`.

## Notes

- Address normalization for duplicate detection: lowercase scheme+host, strip one
  trailing slash from path (FR-015).
- Metadata collection failures never fail a create/update (FR-004).
- All list results keep long values intact; truncation is a display concern
  (FR-016).
