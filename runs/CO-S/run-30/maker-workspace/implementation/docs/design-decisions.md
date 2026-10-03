# Design decisions

## Application shape

- The application is a single-user web app with a Node.js HTTP server and a browser client.
- Bookmark data is stored in a JSON document with atomic replacement writes. This keeps the first-cycle app self-contained while preserving data across restarts.
- Page details are retrieved on the server. The browser never needs cross-origin access to saved pages.
- The implementation uses only Node.js platform APIs, so runtime setup does not depend on third-party services or packages.

## Domain rules

- URLs accept only HTTP and HTTPS, discard fragments, normalize host capitalization and default ports, and use the resulting address for duplicate identity.
- A bookmark is created only when both a title and description can be retrieved.
- Duplicate identity spans active and archived bookmarks. Refreshing or restoring updates the existing record rather than inserting another.
- Labels retain the first-entered spelling but compare case-insensitively for identity and filtering.
- New bookmarks start as Read later. Reading status is a reversible boolean independent of labels, archive state, and destination.
- Archive is a reversible state on the same bookmark record, not a copy operation.
- Complete titles and descriptions are stored and searched; compact display is only a presentation choice.

## Browser interaction

- The card has an overlay link that opens the destination in a new tab. Status, label, archive, and restore controls sit above that overlay and do not trigger navigation.
- Search is performed in the browser over the complete loaded title and description and combines with a sidebar label using an AND relationship.
- The browser renders user-derived values through text nodes rather than HTML interpolation.
- The shared readiness marker is added only after the first bookmark load and render succeeds.

## Deferred requests

- Editing enriched bookmark details and permanent deletion were requested after the Cycle 1 scenario baseline was approved. They are recorded in `context/later-cycle-requests.md` for a later cycle and are not implemented here.
