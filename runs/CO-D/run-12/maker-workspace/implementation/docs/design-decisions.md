# Design decisions

## Application shape

- A single-process Node.js web app serves the browser interface and JSON endpoints.
- Node's built-in SQLite support persists bookmarks, notes, labels, and Read later state in `implementation/data/trove.db` by default.
- The browser is a progressive single-page interface with no external framework or runtime CDN dependency.
- Page details are fetched only during the explicit pre-save review. Saved details are never refreshed automatically.

## Duplicate identity

- The canonical address lowercases the host, removes a non-root trailing slash, sorts retained query fields, and removes only a conservative list of referral fields (`utm_*`, `ref`, `referrer`).
- A unique database constraint enforces one bookmark per canonical address.
- Distinct paths and all unknown query fields remain significant to avoid false merging.

## Notes

- Notes are stored as sanitized HTML because the approved behavior requires bold text, lists, and links to render later.
- The server allowlist removes unsupported markup and unsafe link destinations even though this is a single-user app.
- Long-note folding is a presentation state only; the complete note remains stored and searchable.

## Labels

- Label identity ignores capitalization and surrounding whitespace while preserving the first saved display name.
- A bookmark-to-label join table supports overlapping labels and count queries.

## Dropped alternatives

- No account system: the approved goal is explicitly single-user.
- No automatic page refresh: it conflicts with preservation of user-edited details.
- No broad address normalization: it risks merging genuinely different pages.
- No delete behavior: deletion was not part of the approved scenarios.
