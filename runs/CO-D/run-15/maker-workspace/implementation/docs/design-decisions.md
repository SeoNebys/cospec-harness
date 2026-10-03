# Design decisions

## Product boundary

- Cycle 1 implements the 22 approved scenarios only. User-selectable sorting, bulk actions, and advanced search expressions are recorded in `context/later-cycle-backlog.md` for a later cycle.
- The application is a private, single-account website. It has no registration, profile, sharing, or account-switching surface.

## Runtime and persistence

- The production application is an intentionally small Node.js HTTP service with a browser-native front end. This keeps deployment to one process and avoids a client build pipeline for this single-user application.
- SQLite is the persistent store. Foreign keys delete bookmark-tag associations with a bookmark, but tags themselves remain when other bookmarks still use them.
- The one account is seeded on first startup from `STOW_EMAIL` and `STOW_PASSWORD`. Passwords use salted scrypt hashes. Sessions use random opaque tokens; only token hashes are stored. The review cookie is HTTP-only and SameSite=Lax, with an optional production-only Secure flag.

## Bookmark identity and metadata

- Bookmark identity uses a canonical URL. Fragments and a narrow allowlist of obvious marketing parameters (`utm_*`, click IDs, and newsletter IDs) are removed. Other query parameters remain because they may select different content.
- Metadata gathering reads standard Open Graph, Twitter, description, title, icon, and site-name fields. Requests are time-limited, size-limited, restricted to HTML, and checked against private network destinations to avoid server-side request forgery.
- Gathering failure is a saved, explicit state. The implementation derives only the hostname, favicon location, and a plain title from the URL; it does not invent a description or preview image.
- A same-canonical-page address edit preserves page-derived details. A different canonical address produces a conflict before mutation. The client then explicitly chooses either refreshed page details or its manually written title and description. In both cases client tags, note, and Read later state are retained.

## Search and collection views

- Cycle 1 search is capitalization-insensitive AND matching over whitespace-separated words. Each word is matched against saved title, description, URL, and readable note text. The tag filter is an additional AND condition.
- Search runs in SQLite over the full relevant view before batching, so unloaded cards are still considered.
- Active, Read later, and Set aside are server-filtered views. Set-aside items do not participate in the active view or its everyday search. Read later is a flag, not a move or reading history.
- Results use offset batches of 12 with a maximum server page size of 50. “Load more” appends to the continuous browser list.
- The fixed default order is newest first. User-selectable order is deliberately deferred to the recorded later-cycle request.

## Notes and browser behavior

- Notes store a small safe HTML allowlist (`strong`/`b`, emphasis, paragraphs, breaks, ordered/unordered lists) plus a derived plain-text copy for search.
- The editor provides direct Bold and List controls plus live preview. Long notes remain fully stored and searchable while their card display is visually collapsed.
- Session storage retains the current collection view, word query, tag selection, and an unsaved edit/note draft. An authenticated API response that reports expiry first captures the open draft, then returns to sign-in. Successful sign-in reopens the draft without saving it.

## Interface and accessibility

- The save field is visible on the collection page, tagging is inline, filters are visible chips, editing uses a focused modal, and deletion has an explicit confirmation. These follow the approved interaction choices.
- Bookmark title and preview both use real anchors with a new-tab target. Controls have accessible names, errors are announced, and dialogs identify themselves to assistive technology.
- Responsive layout shifts cards and the login screen to one column on narrow displays. No separate mobile application is provided.

## Alternatives not selected in Cycle 1

- Browser-only/local-storage persistence was rejected because server-backed sessions and durable private data are baseline requirements.
- Full-page-content indexing was not selected; only saved fields and personal note text are approved search sources.
- Markdown input was not selected; direct formatting controls were preferred.
- Numbered pagination was not selected; continuous in-place loading was preferred.
- Immediate destructive deletion was not selected; permanent delete requires confirmation while reversible set-aside does not.
