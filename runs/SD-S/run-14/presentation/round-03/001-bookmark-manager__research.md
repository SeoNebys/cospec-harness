# Research: Bookmark Manager

## Application architecture

**Decision**: Use a client-only React and TypeScript application built with Vite, plain CSS, and local component/reducer state. Do not add routing, a backend, or a global state library.

**Rationale**: The approved product is one personal collection view with a few modal/form states. This keeps deployment and runtime failure modes small while preserving clear component boundaries and testability.

**Alternatives considered**: Vanilla TypeScript would reduce dependencies but make the form/dialog/list state less explicit. A full-stack framework or server would add responsibilities without supporting an approved requirement.

## Durable local storage

**Decision**: Store bookmarks in one versioned IndexedDB object store keyed by a UUID, hidden behind an asynchronous `BookmarkRepository`. Derive the visible tag list from bookmarks rather than persisting a second entity store.

**Rationale**: IndexedDB is asynchronous, persistent for the same browser environment, and transactional. Each create, update, or delete can commit atomically before the interface reports success, satisfying the no-data-loss failure behavior.

**Alternatives considered**: `localStorage` requires synchronous whole-collection serialization and provides a weaker failure model. A server database conflicts with the browser-local scope. Browser storage can still be cleared or evicted and is not a backup or synchronization mechanism; that limitation will be communicated rather than hidden.

## URL handling and duplicates

**Decision**: Trim input, prepend `https://` when no scheme is supplied, parse with the platform URL parser, accept only `http:` and `https:` addresses with a hostname, and store the serialized address. Compare serialized addresses exactly for duplicate warnings while preserving path, query, and fragment.

**Rationale**: Platform parsing is standards-based and consistently normalizes host casing, encoding, and default ports. One pure function shared by create and edit prevents divergent validation.

**Alternatives considered**: Regex-only URL validation is brittle. Network reachability checks are unreliable offline and introduce cross-origin and privacy concerns outside the scope.

## Tags, search, and ordering

**Decision**: Trim all text. Normalize tag comparison keys using Unicode compatibility normalization and locale-aware lowercase, discard empty tags, and retain the first visible spelling of duplicates. Apply the same case-insensitive normalization to partial-text search over title, URL, description, and tags. Sort copies by `createdAt` descending with ID as a deterministic tie-breaker.

**Rationale**: These rules produce predictable search and reusable tags while preserving user-facing text. Editing does not change creation time, so it does not unexpectedly reorder the collection.

**Alternatives considered**: Semantic search, full-text indexing, multiple-tag Boolean filters, and virtualization add complexity with no demonstrated need at 1,000 records.

## Accessibility and navigation

**Decision**: Target WCAG 2.2 AA using native landmarks, labels, buttons, anchors, and dialog semantics. Associate field errors with controls, announce status/result changes politely, manage and restore modal focus, and provide keyboard-complete flows. Open bookmarks through normal anchors in a new tab with an accessible notice.

**Rationale**: Native semantics provide reliable browser and assistive-technology behavior. A new tab retains the collection context required by the specification.

**Alternatives considered**: Custom clickable containers and hand-built modal semantics are harder to use and verify. Opening in the same tab would discard collection context.

## Verification approach

**Decision**: Use Vitest for pure rules, `fake-indexeddb` integration tests for repository behavior, React Testing Library and `user-event` for components, axe checks for representative UI states, and Playwright 1.61.0 with real IndexedDB for end-to-end journeys.

**Rationale**: Layered tests locate failures quickly while browser tests prove storage reloads, dialogs, focus, and complete acceptance stories. A deterministic 1,000-item check covers the performance criterion.

**Alternatives considered**: End-to-end-only coverage would be slow and make rule failures difficult to diagnose. Unit-only coverage would not prove persistence and user workflows.
