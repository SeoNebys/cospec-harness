# Contract: Import / Export & Batch Operations (UI ↔ core)

## importBookmarks

- **Input**: path to a **standard browser bookmarks export** (Netscape HTML)
  file (FR-027).
- **Behavior**:
  - Parse each entry (address + title, and folder → tag where available).
  - For each address: if it already exists, **skip** (one-per-address, FR-028);
    otherwise create the bookmark and **enqueue background capture** (Decision 8).
  - Stay responsive on large files; stream progress to the UI (FR-025, FR-029).
  - Import what it can; skip unreadable entries without aborting the whole run
    (FR-025).
- **Output**: streamed progress, then a summary `{ added, skipped, failed }` the
  UI displays (FR-029, SC-007).

## exportBookmarks

- **Input**: target file path, optional `format` (`html` default — portable and
  re-importable; a richer format preserving notes/tags may be offered too).
- **Behavior**: Write all bookmarks (and their details) to a portable file that
  the app can re-import (FR-030).
- **Output**: `{ ok: true, count }`.

## Batch operations

Batch actions apply one operation to many bookmarks at once (FR-024/025/026).

### applyBatch

- **Input**:
  - `selection` — either an explicit list of `bookmarkIds`, **or** a `query`
    (the current search/filter) meaning "everything currently shown" (FR-025).
  - `action` — one of:
    - `addTag` (with `tagName`) (FR-024)
    - `removeTag` (with `tagName`) — strips the tag from every selected bookmark
      that has it; others are unchanged (FR-024)
    - `setRead` (with boolean) (FR-024)
    - `archive` (with boolean) (FR-024)
    - `delete` (requires `confirmed = true`) (FR-026)
- **Behavior**: Resolve the selection to a set of bookmarks, apply the action to
  every one, and report how many were affected. `delete` is held behind the same
  confirmation guard as single delete (FR-026).
- **Output**: `{ ok: true, affected }`.
