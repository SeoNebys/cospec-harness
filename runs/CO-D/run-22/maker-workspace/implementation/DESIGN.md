# Trove implementation design

## Architecture

Trove is a single-user Node.js web application with no login or external service dependency. `server.js` serves the interface, persists collection state as readable JSON, retrieves page metadata, and stores captured HTML/PDF bytes on disk. `public/app.js` owns view state and interactions. `core.js` contains deterministic URL, search, text, and ordering rules shared by tests.

Data is intentionally portable: collection metadata is JSON; captured pages and PDFs are ordinary files; browser export is Netscape bookmark HTML; complete export is gzip-compressed JSON with captured files encoded as base64.

## Design decisions

- **Single-user filesystem storage.** Matches the approved personal-app boundary without authentication or database administration. A later multi-user request would require a new cycle and storage redesign.
- **Captured content is immutable until an explicit address correction or retry.** Search uses the stored `pageText`, so live-page changes cannot silently rewrite remembered content.
- **Personalized title and description flags are independent.** Correcting an address refreshes only fields still owned by automatic gathering.
- **Canonical URL is separate from displayed URL.** Duplicate comparison removes fragments and known tracking parameters while preserving parameters that may identify different content.
- **Two search modes.** A loose query requires ordinary terms and treats multiple labels as alternatives. Explicit operators invoke a parsed expression tree with AND/OR/NOT and parentheses. Invalid syntax is rejected before replacing visible results.
- **Archive and reading state are attributes, not separate copies.** This keeps notes, labels, captures, and total counts intact during moves and Undo.
- **Bulk actions operate on explicit IDs from the active result set.** Hidden bookmarks cannot be affected by “Select all shown.”
- **Saved searches store query strings.** Opening one recompiles it against current active bookmarks.
- **Safe page copies.** Script, iframe, and inline event handlers are removed from captured HTML before it is served; a base address keeps document-relative resources meaningful when available.
- **No prototype reuse.** Production files were designed from the 40 approved scenario specifications; Phase 1 HTML remains isolated under `prototypes/`.

## Operational notes

- Default data directory: `implementation/data/`; override with `TROVE_DATA_DIR` for isolated tests or deployment.
- Default port: `4000`; override with `PORT`.
- The application is intentionally self-contained and can be backed up by copying its data directory or using complete export.
