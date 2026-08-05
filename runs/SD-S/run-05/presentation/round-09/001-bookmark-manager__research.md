# Phase 0 Research: Bookmark Manager

Feature: `001-bookmark-manager` — single-user, local, manual-entry bookmark app.

The spec's confirmed scope (Q1=A single user on own machine, Q2=A manual address
entry) drives every decision below toward "simple, local, self-contained."

## Decision 1: Application shape — local web app (backend + browser UI)

- **Decision**: A small application that runs on the user's own machine and is
  used through their web browser at `http://localhost`. It has a lightweight
  local server (for storage, address validation, title retrieval, duplicate
  detection) and a single-page browser UI.
- **Rationale**: Opening bookmarks *is* a browser action, so a browser UI is the
  natural home. A tiny local server is required for two things the browser alone
  cannot do reliably: (a) fetching a page to derive its title is blocked by
  browser cross-origin rules, and (b) durable, queryable storage of thousands of
  records. Everything stays on the machine — no accounts, no hosting.
- **Alternatives considered**:
  - *Pure browser app (no server, IndexedDB only)*: rejected — cannot fetch page
    titles due to cross-origin restrictions, and duplicate/URL handling is
    weaker. Would force users to type every title by hand.
  - *Native desktop app*: rejected — heavier to build and install for a
    single-user tool; opening links still hands off to the browser anyway.
  - *Browser extension*: rejected — capture/extension flows are explicitly out of
    scope for v1 (Q2=A).

## Decision 2: Storage — single local SQLite database file

- **Decision**: Persist bookmarks and tags in a local SQLite database file on the
  user's machine.
- **Rationale**: A single file is trivial to back up and requires no separate
  database server to install or run. SQLite comfortably handles the spec's scale
  (thousands of bookmarks, sub-second search per SC-003) and provides indexed
  text search and a UNIQUE constraint for duplicate-address detection (FR-014).
- **Alternatives considered**:
  - *Flat JSON file*: rejected — whole-file rewrites and linear scans do not meet
    the search-latency target as the collection grows.
  - *Client-side IndexedDB*: rejected with Decision 1 (title retrieval needs a
    server; keeping one store server-side is simpler).
  - *Hosted database (Postgres, etc.)*: rejected — over-scaled for one local user
    and reintroduces a server/hosting story that scope excludes.

## Decision 3: Implementation stack — TypeScript everywhere

- **Decision**: Node.js + TypeScript for the local server; a Vite + React +
  TypeScript single-page app for the UI. Server exposes a small local JSON/HTTP
  API and also serves the built UI assets.
- **Rationale**: One language across server and UI keeps the project small and
  consistent. React + Vite gives responsive list rendering, search, and tag
  filtering (SC-002/SC-003) with minimal boilerplate. The stack is widely
  supported and easy to run locally with a single command.
- **Alternatives considered**:
  - *Vanilla JS UI*: rejected — tag filtering, live search, and undo interactions
    become verbose and error-prone without a component/state model.
  - *Python/Go backend*: rejected — would split the project across two languages
    for no benefit at this scale.

## Decision 4: Address validation & title retrieval

- **Decision**: Validate that a submitted address is a well-formed `http`/`https`
  URL before saving (FR-002). When no title is supplied, the server fetches the
  page and extracts its `<title>`; if the page is unreachable or has no title,
  the address itself becomes the title (FR-003, edge case "unreachable page").
- **Rationale**: Directly satisfies the spec's validation and auto-title
  requirements while degrading gracefully offline.
- **Alternatives considered**:
  - *Accept any string as an address*: rejected — violates FR-002.
  - *Never auto-fetch titles*: rejected — violates FR-003 and hurts SC-001
    (save in under 15s) by forcing manual titling.

## Decision 5: Duplicate detection

- **Decision**: Treat a normalized address (trimmed, scheme/host lower-cased) as
  the uniqueness key. On save of an existing address, warn and offer to open the
  existing bookmark rather than creating a duplicate (FR-014, SC-006).
- **Rationale**: Meets the requirement while tolerating trivial casing/whitespace
  differences that users don't consider "different."
- **Alternatives considered**:
  - *Exact string match only*: rejected — misses obvious duplicates differing
    only by case or trailing spaces.
  - *Aggressive normalization (strip query strings, fragments)*: rejected for v1 —
    can wrongly merge genuinely different pages; revisit only if users report it.

## Decision 6: Delete with undo

- **Decision**: Deletion asks for confirmation (FR-012); immediately afterward the
  user can undo to restore the bookmark with all its details and tags (FR-013).
- **Rationale**: A short-lived undo (soft delete / restore) is the simplest
  reliable way to meet FR-013 without a full trash/recycle-bin feature.
- **Alternatives considered**:
  - *Permanent delete, no undo*: rejected — violates FR-013.
  - *Full trash bin with retention*: rejected — beyond spec scope for v1.

## Decision 7: Testing approach

- **Decision**: Unit + integration tests for the server (validation, dedupe,
  title fallback, persistence) with Vitest; an end-to-end browser test for the
  primary journeys (save → find → open) with Playwright.
- **Rationale**: Covers the measurable success criteria at the layers where they
  can fail, and proves the P1 journeys work through the real UI.
- **Alternatives considered**: Manual testing only — rejected as non-repeatable
  against the measurable success criteria.

## Resolved unknowns

All Technical Context items are resolved; no `NEEDS CLARIFICATION` markers remain.
