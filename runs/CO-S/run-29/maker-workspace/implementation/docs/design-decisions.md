# Design decisions

## DD-001 — Browser-local persistence

The approved scope is personal, used on one computer, and explicitly excludes cross-computer syncing. Saved bookmarks, collections, and membership are stored in browser-local storage. Search text, selected checkboxes, and open forms remain in memory and reset on reload.

Dropped for this cycle: accounts, a remote database, sharing, and synchronization.

## DD-002 — Framework-free client with isolated domain rules

The application uses browser-native HTML, CSS, and JavaScript. Functional rules live in `public/domain.js`; persistence lives in `public/storage.js`; rendering and interactions live in `public/app.js`. This keeps validation and state transitions independently testable while avoiding runtime dependencies for a focused single-user app.

## DD-003 — Collections are the organization model

A bookmark has zero or one `collectionId`. The interface groups assigned bookmarks under their collection and shows unassigned bookmarks under “Unfiled.” Users may create a unique named collection from a selection or assign a later selection to an existing collection.

Dropped after exploration: labels and duplicate collection names.

## DD-004 — Finding controls combine by intersection

Search matches case-insensitive partial text across the complete bookmark name and web address. An active collection filter and search term both apply to the same list. Clearing an unsuccessful search preserves the selected collection.

## DD-005 — Deliberate permanent deletion

Individual and multi-select deletion share one confirmation dialog. Cancellation changes nothing. Confirmed deletion is permanent for this cycle and has no undo. Empty named collections are retained, while a globally empty bookmark list shows the approved welcoming state.

## DD-006 — Whole-card external navigation

The card is keyboard-focusable and opens the saved address in a separate tab. Checkbox and delete controls stop card activation. Search, filters, selection, and scroll position remain in the original tab.

## DD-007 — Large-list presentation

The unfiltered collection is one scrolling page. Bookmark names are clamped to two lines; addresses and collection tags use visual ellipsis while keeping full text in the DOM and search index. Search and collection filters are the primary narrowing mechanisms; pagination is excluded this cycle.
