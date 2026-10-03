# Design decisions

## Runtime and persistence

- The app is a dependency-light Node.js HTTP service with a browser-native interface. This keeps setup small and fits the single-computer, single-user goal.
- Bookmark data is stored in one versioned JSON document and written by atomic replacement. Mutations are serialized to prevent overlapping actions from losing data.
- There is no account or login boundary. The server binds to the configured host and the UI opens directly into the library.

## Data ownership

- Gathered page details are copied into the bookmark only at creation. They are never refreshed automatically, so user-edited words and notes cannot be overwritten by later webpage changes.
- Only explicit permanent deletion removes a bookmark. Archive and Read later are stored states on the bookmark.
- Complete backups contain the full bookmark records. Browser exports intentionally use the portable Netscape bookmark format and disclose its limitations.

## Address identity and page reading

- Duplicate identity uses a normalized key: host case and `www`, default ports, fragments, trailing slashes, and known tracking parameters are ignored. Meaningful query parameters remain.
- Metadata fetching accepts only HTTP(S), resolves relative assets, has a time and size limit, and will not fetch private-network addresses. A failed fetch becomes the approved manual-details flow.

## Interface state

- Search, filters, labels, Read later, Archive, and batch selection are client-side views over the persisted library for immediate feedback.
- Sort order is browser-local and survives view changes and reloads. Newest first is the default.
- Batch selection is temporary. "Select everything" is derived from the currently visible result set only.

## Notes and safety

- Notes use a small contenteditable toolbar and store sanitized paragraph/list/emphasis HTML. Search uses text extracted from that formatted note.
- All user and imported text is escaped when rendered. Note HTML is allowlisted on the server. Destructive actions require a second explicit confirmation that lists affected bookmarks.

## Alternatives not selected

- A hosted multi-user service and authentication were rejected because the approved product is personal and sign-in-free.
- Automatic page refresh was rejected because it could overwrite personal wording.
- Prototype code was not reused; the production app was implemented independently from the approved scenario specifications.
- Search syntax is not required. Visible Search options are the primary advanced-search interface; remembered syntax remains only a future convenience.
