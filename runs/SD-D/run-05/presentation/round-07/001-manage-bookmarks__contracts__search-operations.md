# Contract: Search & Saved-Search Operations (UI ↔ core)

## search

- **Input**: a query object:
  - `text` (optional) — free keyword(s); words wrapped in quotes are treated as
    an **exact phrase** (FR-020).
  - `tags` (optional) — one or two tag names; a `tagMode` of `and`/`or` when two
    are given (FR-021).
  - `unreadOnly` (optional boolean) — restrict to unread (FR-031).
  - `includeArchived` (optional boolean).
  - `sort` (`newest` | `oldest` | `title`).
- **Behavior**:
  - Match `text` case-insensitively against title, description, note text, tags,
    and address (FR-018). Quoted text matches the whole phrase only (FR-020).
  - Restrict to the given tag condition when `tags` present (FR-021).
  - Combine text + tags + unread/archived filters, then order by `sort`.
  - No matches → empty result rendered as a "no results" state with a clear-search
    affordance (FR-033).
- **Output**: ordered list of matching bookmark summaries.

## saveSearch

- **Input**: `name`, plus the same criteria fields as `search` (text, tags,
  tagMode, unreadOnly, includeArchived).
- **Behavior**: Store the **criteria** (not a frozen result list) under `name`
  (FR-023).
- **Output**: created Saved Search record.

## listSavedSearches / runSavedSearch / deleteSavedSearch

- **listSavedSearches**: return all saved searches for display.
- **runSavedSearch(id)**: evaluate the stored criteria against the **current**
  collection and return matching bookmarks — reopening always reflects the latest
  data (FR-023).
- **deleteSavedSearch(id)**: remove a saved search.
