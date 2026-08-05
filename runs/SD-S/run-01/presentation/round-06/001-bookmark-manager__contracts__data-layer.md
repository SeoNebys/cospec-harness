# Contract: Bookmark Data Layer

The app has no external/network API. Its internal contract is the data-layer
interface (`bookmarkRepository`) that the UI depends on. Defining it here lets
the UI and storage be built and tested against a stable surface.

All operations are asynchronous (IndexedDB is async). Types reference the
[data model](../data-model.md).

## Types

```text
Bookmark {
  id: string
  url: string
  title: string
  notes: string
  tags: string[]
  dateSaved: number      // epoch ms
  dateModified: number   // epoch ms
}

NewBookmarkInput {
  url: string            // may be un-normalized; may lack scheme
  title?: string         // blank → derived from url
  notes?: string
  tags?: string[]
}

BookmarkQuery {
  keyword?: string       // matches title, url, or tags (case-insensitive)
  tag?: string           // restrict to bookmarks carrying this tag
}
```

## Operations

| Operation | Signature | Behavior / rules |
|-----------|-----------|------------------|
| Create | `add(input: NewBookmarkInput): Promise<Bookmark>` | Normalizes & validates url (VR-001); derives title if blank (VR-002); dedupes/trims tags (VR-003); sets `id`, `dateSaved`, `dateModified`. Rejects with a validation error if url is empty/malformed. |
| Check duplicate | `findByUrl(url: string): Promise<Bookmark[]>` | Returns existing bookmarks whose normalized url matches; used to raise the duplicate warning (VR-004) before/at save. |
| Read one | `get(id: string): Promise<Bookmark \| undefined>` | Returns the bookmark or undefined. |
| List / search | `list(query?: BookmarkQuery): Promise<Bookmark[]>` | No query → all bookmarks, most-recent-first (FR-014). With `tag` → only that tag (FR-010). With `keyword` → title/url/tags substring match (FR-011). Combines `tag` + `keyword` with AND. |
| List tags | `listTags(): Promise<string[]>` | Distinct tag labels across all bookmarks, for the filter UI (FR-010). |
| Update | `update(id: string, changes: Partial<NewBookmarkInput>): Promise<Bookmark>` | Applies changes, re-validates url if changed, re-derives title if blanked, bumps `dateModified` (FR-007). Rejects on invalid url. |
| Delete | `remove(id: string): Promise<void>` | Deletes the bookmark. UI performs confirmation before calling (FR-008). |

## Error contract

- Validation failures (empty/malformed url) reject with a typed validation error
  carrying a user-presentable message; the UI surfaces it on the form.
- The duplicate condition is **not** an error — `add`/`update` succeed; the UI
  uses `findByUrl` to warn beforehand and lets the user proceed (VR-004).

## Testability

- Unit tests exercise `add`/`update`/`remove`/`list`/`listTags` against an
  in-memory or fake IndexedDB, asserting validation, ordering, tag filtering, and
  keyword search.
- This contract is the seam the component and e2e tests build on.
