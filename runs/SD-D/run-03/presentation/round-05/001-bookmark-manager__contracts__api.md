# API Contract: Bookmark Manager

Local JSON API under `/api`, served by the same process as the UI, bound to
localhost. No auth (single local user, FR-012). Each endpoint maps to
requirements; shapes are indicative, not final code.

## Bookmarks

### `POST /api/bookmarks` — save a bookmark (FR-001, 002, 003, 011)
- Body: `{ url, title?, description?, notes?, tags? }`
- `422` if `url` malformed (FR-002).
- If `url` already exists → `200` with the **existing** bookmark and a flag
  `{ existing: true }` so the UI opens it for editing (FR-011) — no duplicate.
- Else `201` with the new bookmark (title = url fallback until metadata enriches).
- Metadata capture runs async; icon/description/title fill in after (FR-003).

### `GET /api/bookmarks` — list / search / filter / sort (FR-005, 009, 010, 013, 016, 017)
- Query params:
  - `q` — keyword; supports `"exact phrase"`; case-insensitive (FR-009)
  - `tags_any` — repeatable; include-any (OR) (FR-010)
  - `tags_not` — repeatable; exclude (NOT) (FR-010)
  - `unread=true` — unread pile only (FR-017)
  - `archived=true` — archive view; default lists only non-archived (FR-016)
  - `sort=recent|title` — default `recent` (FR-013)
- Returns the matching bookmarks with tags, plus the resolved `count` (used by
  "select everything matching").

### `GET /api/bookmarks/{id}` — read one
### `PATCH /api/bookmarks/{id}` — edit (FR-004, 004b, 007, 016, 017)
- Body: any of `title, description, notes, tags, is_read, is_archived`.
- Archiving/restoring and read/unread toggles go through here for a single item.

### `DELETE /api/bookmarks/{id}` — permanent delete (FR-008)
- UI shows confirmation before calling (SC-005).

## Bulk actions (FR-018, SC-009)

### `POST /api/bookmarks/bulk`
- Body: `{ target, action }` where
  - `target` = `{ ids: [...] }` **or** `{ filter: { q?, tags_any?, tags_not?, unread?, archived? } }`
    — the latter is "select everything matching" (FR-018).
  - `action` = one of:
    - `{ type: "add_tag", tag }`
    - `{ type: "archive" | "unarchive" }`
    - `{ type: "mark_read" | "mark_unread" }`
    - `{ type: "delete", confirm: true }` (must confirm; SC-005)
- Applies to the whole resolved set in one transaction; returns affected count.

## Tags (FR-004a, 010)

### `GET /api/tags?prefix=…&in_use=true` — suggestions / filter list
- `prefix` → existing tags matching what's typed (autocomplete, FR-004a).
- `in_use=true` → only tags currently on at least one bookmark (edge case: unused
  tags disappear from the filter list).

## Import / export (FR-014, 015)

### `POST /api/import` — import a browser bookmark file (FR-014)
- Multipart file upload (Netscape bookmark HTML).
- Behaviour: create bookmarks; **folders → tags** (one per nesting level);
  preserve `ADD_DATE` as `date_added`; **skip addresses already saved** (no
  duplicates). Returns `{ imported, skipped_duplicates }`. Metadata for new items
  enriches in the background.

### `GET /api/export?format=html|json` — export the collection (FR-015)
- `format=html` — **standard browser file**: portable; tags as folders +
  `TAGS` attribute; notes as plain text; `ADD_DATE` re-emitted. *Lossy by format
  (no read/archived, formatting flattened).*
- `format=json` — **full backup**: lossless round-trip (tags, Markdown notes,
  read/unread, archived, dates, saved searches). Re-importable with no loss
  (SC-008).
- *Which formats ship is the client's plan-gate decision (research §4).*

## Saved searches (FR-019 — only if kept; client decision, research §5)

### `GET /api/saved-searches` — list
### `POST /api/saved-searches` — save current filter combo `{ name, q?, include_tags?, exclude_tags?, unread? }`
### `POST /api/saved-searches/{id}/apply` — resolve to the same filter path as `GET /api/bookmarks`
### `DELETE /api/saved-searches/{id}`

## Static UI

### `GET /` and assets — serves the built frontend (single deployable).
