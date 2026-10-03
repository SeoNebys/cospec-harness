# Design decisions

## Production boundary

- The production application lives entirely under `implementation/`; Phase 1 prototype code is not imported or reused.
- A small Node.js HTTP service owns bookmark persistence and page-detail retrieval. This gives every browser the same central library instead of browser-local data.
- Bookmark data is persisted atomically to a server-side JSON file. The store is isolated behind a class so a later deployment can replace the persistence mechanism without changing UI behaviour.

## Behavioural decisions

- Address identity preserves meaningful URL differences and ignores trailing slashes, matching SCN-013.
- `createdAt` is immutable and drives newest-first ordering; `updatedAt` records edits without reshuffling the library.
- Search and tag filters are evaluated against the complete client-side snapshot returned by the server, not only the visible batch.
- Page-detail retrieval is server-side to avoid browser cross-origin restrictions. Fetch failure returns a recoverable state rather than blocking manual entry.
- Cards have distinct controls for expand, edit, Read later, and remove; these controls stop the card-opening action.

## Access boundary

- This cycle implements one central personal library and no multi-person account management, as approved. Deployment-level private access remains an environment concern recorded in the non-functional backlog.
