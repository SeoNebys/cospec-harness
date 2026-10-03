# Keepmark design record

## Decisions

- Use a dependency-free Node HTTP service and browser application. This keeps a single-person app easy to run and avoids external infrastructure.
- Persist bookmark state in an atomically replaced JSON file. Mutations are serialized to avoid lost updates.
- Retrieve page metadata on the server with a five-second limit. A failed retrieval saves the address immediately and marks the details unavailable.
- Compare canonical addresses for duplicate detection: ignore fragments, trailing slashes, default ports, and known tracking parameters while preserving content-changing query parameters.
- Treat Archive as a separate state and clear Read later on archive/restore. Search and tags are scoped to the current section.
- Fetch bookmark lists in batches of 20 while search and tag filters execute against the complete section on the server.
- Keep permanent deletion behind a native modal confirmation. Cancel performs no request.
- Phase 1 prototype code is not imported or referenced by the production application.

## Scenario-to-code map

| Scenarios | Production areas | Automated coverage |
|---|---|---|
| SCN-001, SCN-011, SCN-012 | `server.js` POST `/api/bookmarks`, `app.js` save flow | `api.test.js`, `browser_check.py` |
| SCN-002, SCN-015 | `normalizeTags`, save form tag entry/suggestions | `lib.test.js`, `api.test.js` |
| SCN-003, SCN-013 | bookmark query search, search UI/empty copy | `lib.test.js`, API query assertions |
| SCN-004, SCN-019 | tag counts/query, sidebar filters | API query assertions |
| SCN-005, SCN-016 | read-later mutation, section and empty state | `api.test.js` |
| SCN-006 | archive/restore mutations and menus | `api.test.js` |
| SCN-007 | DELETE endpoint and confirmation dialog | `api.test.js` |
| SCN-008, SCN-014 | `canonicalAddress`, duplicate response/highlight | `lib.test.js`, `api.test.js` |
| SCN-009 | note save/edit/card/search | `api.test.js` search assertion |
| SCN-010, SCN-017 | compact cards, external title links, expandable notes | browser markup and CSS |
| SCN-018 | limit/offset API and Show older UI | bookmark query implementation |

## Persistence shape

Each bookmark stores an ID, original and canonical address, title, description, metadata status, note, normalized tags, Read later flag, archive timestamp, and created/updated timestamps.
