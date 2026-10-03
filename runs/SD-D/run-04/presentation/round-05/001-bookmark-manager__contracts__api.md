# API Contract: Bookmark Manager

JSON over HTTP. Base path `/api`. The same server also serves the front end as
static files and listens on `0.0.0.0:4000`. All responses are JSON unless noted.
Errors use `{ "error": { "code": string, "message": string } }` with an
appropriate HTTP status (400 validation, 404 not found, 409 conflict/duplicate,
502 upstream/preservation failure).

Each endpoint notes the functional requirement(s) it satisfies.

## Bookmarks

### POST /api/bookmarks — create/save (FR-001..005, 007, 008)
Request: `{ url, title?, description?, note_html?, tags?: string[] }`
Behavior: validate + normalize `url`; if `url_key` already exists, do **not**
create — respond 409 with the existing bookmark and `duplicate: true`
(and `archived: true` + restore hint when applicable) so the client opens it for
editing. Otherwise collect best-effort metadata and create.
Response 201: `{ bookmark }` · 409: `{ error, bookmark, duplicate:true, archived? }`
· 400 invalid url.

### GET /api/bookmarks — list / search / filter (FR-005,014,017-020,022,023,028,040)
Query params:
- `q` — search query (phrase, `#tag`, AND/OR/NOT, parentheses)
- `tag` — quick tag filter (FR-014a); repeatable
- `view` — `active` (default) | `unread` | `archive`
- `sort` — `added_desc|added_asc|title|updated_desc|read_status`
- `page`, `page_size` — pagination (defaults from preferences)
Response 200: `{ items: Bookmark[], total, page, page_size }`
Errors: 400 on malformed `q` (FR-019).

### GET /api/bookmarks/:id — fetch one
Response 200: `{ bookmark }` (includes tags + preserved copies) · 404.

### PATCH /api/bookmarks/:id — edit (FR-003, 009, 021, 023/024)
Request (any subset): `{ url?, title?, description?, note_html?, is_read?,
is_archived?, tags? }`. Editing `url` to an existing `url_key` → 409 like create.
Response 200: `{ bookmark }`.

### DELETE /api/bookmarks/:id — delete (FR-038)
Permanent; client confirms first. Response 204.

### POST /api/bookmarks/bulk — bulk actions (FR-025, 026, 027)
Request: `{ selector, action }` where `selector` is one of:
- `{ ids: number[] }` — an explicit set of chosen bookmarks, **or**
- `{ matching: <filter> }` — "select all matching the current view".

The `matching` filter carries the **complete current view**, identical to the
`GET /api/bookmarks` filter parameters, and MUST include every active constraint:
`q` (search query), `included_tags[]`, `excluded_tags[]`, `tag` quick-filters,
`view` (`active|unread|archive`), and `saved_view_id` when a saved view is open.
Pagination params (`page`, `page_size`) are ignored for `matching` — the action
applies to **all** matching items across every page, not just the visible page.

`action` is one of:
`{ addTags:[] } | { removeTags:[] } | { is_read:bool } | { is_archived:bool } |
{ delete:true }`.

The server re-evaluates `matching` at action time using the exact same query
logic as `GET /api/bookmarks` so the affected set matches what the user sees.
Destructive actions require `confirm:true`.
Response 200: `{ affected: number }` · 400 if destructive without `confirm`.

### POST /api/bookmarks/bulk/count — affected count preview (FR-027)
Same `selector` shape as above, no `action`. Returns the exact number of
bookmarks the current view/selection resolves to, so the UI can show the correct
count before a destructive confirmation.
Response 200: `{ affected: number }`.

## Tags

### GET /api/tags — list all tags with counts
Response 200: `{ tags: [{ name, count }] }`.

### GET /api/tags/suggest?q= — suggestions while typing (FR-012)
Case-insensitive match on existing tags. Response 200: `{ tags: string[] }`.

## Saved Views (FR-029, 030)

- `GET /api/views` → `{ views: SavedView[] }`
- `POST /api/views` `{ name, query, included_tags[], excluded_tags[] }` → 201 `{ view }`
- `PATCH /api/views/:id` `{ name?, query?, included_tags?, excluded_tags? }` → `{ view }`
- `DELETE /api/views/:id` → 204
- `GET /api/views/:id/results` → same shape as `GET /api/bookmarks` (re-applies
  the view's query + tag filters, current matches).

## Preservation (FR-031, 032, 033, 034)

### POST /api/bookmarks/:id/preserve
Request: `{ mode: "local" | "archive_org" }`.
- `local`: self-contained HTML for a page, or the PDF file for a PDF address.
- `archive_org`: submit to Internet Archive; store returned reference.
Response 200: `{ preserved: PreservedCopy }` · 502 on unreachable page / archive
service unavailable (bookmark unchanged, FR-034).

### GET /api/bookmarks/:id/preserved/:copyId — serve a stored local copy
Returns the stored self-contained HTML (`text/html`) or PDF
(`application/pdf`). 404 if missing.

## Import / Export (FR-035, 036, 037)

### POST /api/import — import Netscape bookmark HTML (FR-035, 036)
Request: multipart file upload (the standard `bookmarks.html`).
Behavior: parse address/title/dates/tags (folders → tags when no TAGS attr);
merge duplicates keeping the existing bookmark's own
title/description/note/read/archive/dates and adding only missing tags.
Response 200: `{ added, merged, skipped }`.

### GET /api/export — export Netscape bookmark HTML (FR-037)
Response 200: `text/html` attachment retaining titles, tags, and dates.

## Preferences (FR-039, 040)

- `GET /api/preferences` → `{ default_sort, items_per_page, text_size }`
- `PUT /api/preferences` `{ default_sort?, items_per_page?, text_size? }` →
  updated preferences (persisted, applied to the list).

## Front end / readiness

- `GET /` serves the single-page app shell. The shell sets
  `data-harness-ready="true"` on a visible element only after the initial list
  (or a valid empty state) has loaded, per the runtime presentation guidance.

## Bookmark object shape (response)

```json
{
  "id": 1,
  "url": "https://example.com/a",
  "title": "Example",
  "description": "…",
  "note_html": "<p>…</p>",
  "icon_url": "https://example.com/favicon.ico",
  "preview_image_url": "https://example.com/og.png",
  "is_read": false,
  "is_archived": false,
  "tags": ["reading", "reference"],
  "preserved": [{ "id": 5, "kind": "html", "captured_at": "2026-09-17T…" }],
  "created_at": "2026-09-17T…",
  "updated_at": "2026-09-17T…"
}
```
