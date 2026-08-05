# Phase 1 Data Model: Bookmark Manager

All data lives locally in the browser's IndexedDB. There is no server-side model.

## Entity: Bookmark

A saved reference to a web page.

| Field          | Type            | Required | Notes                                                        |
|----------------|-----------------|----------|--------------------------------------------------------------|
| `id`           | string (uuid)   | yes      | Generated on creation; primary key.                          |
| `url`          | string          | yes      | Normalized web address (`http`/`https`). See validation.     |
| `title`        | string          | yes      | Human-readable title; defaults from URL if user leaves blank.|
| `notes`        | string          | no       | Optional free-text note. Defaults to empty.                  |
| `tags`         | string[]        | no       | Zero or more tag labels (see Tag). Defaults to empty array.  |
| `dateSaved`    | number (epoch ms)| yes     | Set once at creation. Drives default most-recent-first order.|
| `dateModified` | number (epoch ms)| yes     | Set at creation, updated on every edit.                      |

### Validation rules (from requirements)

- **VR-001** (FR-001, FR-003): `url` MUST be non-empty and parse as a well-formed
  `http`/`https` web address after normalization. Empty or malformed input is
  rejected with a clear message; the bookmark is not saved.
- **VR-002** (FR-002): If `title` is blank at save time, it defaults to a value
  derived from the URL (host + path). Title is never stored empty.
- **VR-003** (FR-009): `tags` contains trimmed, non-empty, de-duplicated labels.
  A bookmark may carry many tags.
- **VR-004** (FR-013): On save, if another bookmark already has the same
  normalized `url`, the app warns the user; the save is still permitted.
- **VR-005** (FR-014): `dateSaved` is immutable after creation; `dateModified`
  updates on each edit.

### Normalization (from research Decision 4)

- Trim surrounding whitespace.
- If no scheme is present, assume `https://`.
- Reject anything that is not a valid `http`/`https` URL after normalization.
- Two URLs are considered "the same" (for the duplicate warning) after
  normalization.

### State / lifecycle

`created → (edited)* → deleted`

- **created**: user saves a valid new bookmark.
- **edited**: title, url, notes, or tags change; `dateModified` updates.
- **deleted**: removed after explicit user confirmation (FR-008); not
  recoverable in v1.

## Entity: Tag

A short label used to group and find bookmarks.

- Represented as a plain string label stored inside a Bookmark's `tags` array.
  There is **no separate Tag table in v1** — the set of known tags is derived by
  collecting distinct labels across all bookmarks. This keeps the model simple
  while fully supporting tag assignment (FR-009) and tag filtering (FR-010).
- **Relationship**: many-to-many with Bookmark (a bookmark has many tags; a tag
  applies to many bookmarks), expressed via the embedded `tags` array.
- A tag "exists" as long as at least one bookmark carries it; it disappears from
  the filter list when no bookmark uses it.

## Indexes (IndexedDB / Dexie)

- Primary key: `id`.
- Index on `dateSaved` — for default most-recent-first ordering (FR-014).
- Multi-entry index on `tags` — for efficient tag filtering (FR-010).
- Keyword search (FR-011) scans title, url, and tags; for the target scale (a
  few thousand records) an in-memory case-insensitive substring match over
  loaded records is sufficient to meet SC-004.

## Traceability to functional requirements

| Requirement | Model support                                              |
|-------------|------------------------------------------------------------|
| FR-001/003  | `url` field + VR-001 validation                            |
| FR-002      | `title` field + VR-002 default                             |
| FR-004      | Persistence in IndexedDB                                    |
| FR-005/006  | List reads all bookmarks; `url` used to open page          |
| FR-007      | Editable `url`/`title` (also notes/tags); `dateModified`   |
| FR-008      | Deletion after confirmation                                |
| FR-009      | `tags` array + VR-003                                       |
| FR-010      | Multi-entry `tags` index                                   |
| FR-011      | Keyword scan over title/url/tags                           |
| FR-012      | Empty vs. no-results states derived from query counts      |
| FR-013      | VR-004 duplicate warning                                   |
| FR-014      | `dateSaved` index + default ordering                       |
