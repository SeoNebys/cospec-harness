# Design decisions

## Architecture

- A dependency-light Node.js HTTP service owns persistence, page capture, URL
  normalization, and bookmark operations.
- A browser client renders the library and performs the approved interactions.
- Bookmark data is persisted as JSON with atomic file replacement. This keeps
  the first-cycle application portable while isolating persistence behind a
  store class for later replacement.
- Phase 1 prototype files are not imported, copied, or referenced by the
  production application.

## Page capture

- The service fetches a page once for metadata and readable text. It extracts
  standard title, description, icon, and preview metadata, then retains readable
  article-like text as the saved copy.
- A pending copy can be retried explicitly and by a background retry loop.
- A successful later capture fills the archive and missing visual metadata but
  never replaces person-entered title, description, or notes.

## Identity and consistency

- Bookmark identity uses a canonical address: fragments and known referral
  parameters are removed, default ports are normalized, and a trailing slash is
  normalized. Other query values remain meaningful.
- Tags are compared case-insensitively while preserving the first spelling.

## Reading behavior

- The client opens a blank new tab immediately, asks the service whether the
  original is reachable, then directs that tab to either the original address
  or the local saved-copy reader. The library tab never navigates away.
- The client also refreshes original-page availability after the library is
  rendered and at a quiet interval. This lets a card warn that an original is
  unavailable before it is clicked without delaying the first library render.

## Safety

- Deletion is available only inside Edit and always requires a named
  confirmation. Cancelling the confirmation does not submit or clear the form.
- User-originated strings are escaped before browser rendering. Saved-copy text
  is stored and rendered as text rather than executable page markup.

## Deliberately deferred

- Accounts, sharing, cross-device synchronization, browser extensions, import
  and export, and multi-user permissions were not part of the approved cycle.
