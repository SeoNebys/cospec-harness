# Design decisions

- The application is a single-person server-backed web app. Data is stored in an atomically replaced JSON document so it is shared across browsers that reach the same server, without adding an account flow.
- Remote page metadata is fetched by the server. HTTP(S) validation and private-network address blocking keep the fetch boundary narrow.
- Reviewed metadata is stored as a snapshot. It changes only through ordinary editing or an explicit selective refresh.
- Notes store a sanitized subset of HTML covering the approved toolbar formats: emphasis, bullet lists, and links.
- The browser client maintains collection, search, and expansion state while all bookmark mutations persist immediately through the API.
- Search is case-insensitive and covers title, description, URL, site, labels, and plain note text.
- Label lookup is case-insensitive. New-label creation is offered only when the current text has no existing matches, steering the person toward reuse.
- Archived bookmarks remain in storage but are excluded from ordinary and label views. Read later is an independent boolean status.
- Prototypes were not used as an implementation source; behavior was rebuilt from the approved scenario specifications.
