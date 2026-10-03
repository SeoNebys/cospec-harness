# Design decisions

## Architecture

- The app is a single-user Node.js web service with a browser interface and a JSON-backed persistent store. This keeps installation and operation small while preserving data across restarts.
- Bookmark mutations happen through a narrow JSON API. The browser owns search, tag intersection, view filtering, highlighting, and pagination so those interactions update immediately.
- Page metadata is retrieved only when a bookmark is first saved or when the user explicitly refreshes it. Personal tags and notes are stored separately from captured page fields.

## Safety and data integrity

- Bookmark writes are serialized and replace the data file atomically.
- Exact duplicates use a normalized HTTP/HTTPS address with fragments removed, host names lowercased, and default ports removed.
- Metadata fetching rejects local/private network destinations in normal operation, follows a bounded number of redirects, limits response size, and times out.
- An unreachable page creates a basic card rather than dropping the link. A failed later refresh never mutates the saved card.
- Archive and Read later are reversible states on one bookmark record; neither creates or deletes a copy.

## Interface

- Tags and collection states remain visible in a dark persistent sidebar.
- Primary, frequent actions are labeled. Archive, note editing, metadata refresh, and basic-card title editing live in a secondary card menu.
- Long cards clamp their content until Show more is used. Large result sets use 20-item numbered pages.
- Search runs across the whole collection before pagination, intersects with one selected tag, and highlights matching text.

## Alternatives not selected

- No automatic metadata refresh: the approved behavior requires explicit user control.
- No infinite scrolling or load-more list: numbered pagination preserves position.
- No visible archive button on every card: the approved card menu keeps the action deliberate.
- No automatic duplicate merge: exact duplicates are blocked and linked to the existing card.
