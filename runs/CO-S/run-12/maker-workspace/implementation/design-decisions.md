# Design decisions

- Production is a small Node.js web application with no account layer, matching the approved personal-use scope.
- Bookmark data is stored in an atomically replaced local JSON document. This keeps deployment and backup simple for one user; a multi-user database was deliberately excluded.
- The server retrieves page metadata so the browser is not blocked by cross-origin page rules. Retrieval permits only public HTTP(S) destinations, limits response size and time, and blocks private network addresses.
- Saved metadata is a durable snapshot. It changes only through explicit editing, preserving the approved temporal behavior.
- URL comparison lowercases hostnames, removes fragments and trailing slashes, and preserves query strings. Fragments do not identify a different page; query strings may.
- Search runs locally over the already-loaded personal collection and matches every entered word across title, description, and note, case-insensitively.
- Archive and Read later are bookmark states, not copies. This guarantees state and notes survive movement between views.
- No permanent-delete control is included because permanent deletion was not part of the approved scenario baseline.
- The UI is responsive, but the dominant layout is optimized for a desktop browser as requested.
