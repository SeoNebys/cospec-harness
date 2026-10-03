# Design decisions — cycle 1

- The final application is a small server-rendered static web app with a browser-side data model persisted in local storage. This keeps the approved single-user workflow immediate and durable in the same browser without adding unapproved account behavior.
- Page metadata retrieval is handled by the application server so ordinary pages can be inspected despite browser cross-origin limits. Failure returns to the approved hostname fallback.
- Saved metadata is a snapshot. It is never refreshed automatically, matching SCN-011.
- Views are projections of one bookmark collection: archived and reading-list items are state on the bookmark, not copies.
- Search uses all entered words against the combined title and tag text and updates on every input event.
- A custom confirmation dialog is used for deletion so cancel and confirm outcomes are explicit and testable.
- No Phase 1 prototype source was referenced or reused; the implementation was constructed from the approved scenario specifications.
