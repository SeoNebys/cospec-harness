# Phase 0 Research: Bookmark Manager

All Technical Context items were resolvable from the confirmed scope (personal,
single-user, local, no login). No open NEEDS CLARIFICATION items remain.

## Decision 1: Application shape — local static web app, no backend

- **Decision**: Deliver a single-page web application (SPA) as a static bundle
  the user opens in their browser. No server, no API, no accounts.
- **Rationale**: The confirmed scope is one user on their own computer with no
  login. A static SPA with local storage meets every functional requirement
  with the least moving parts and stays fully offline.
- **Alternatives considered**:
  - *Native desktop app (Electron/Tauri)*: heavier to build and distribute;
    unnecessary for a personal tool that a browser already runs.
  - *Web app with backend + database*: reintroduces a server and accounts the
    client explicitly ruled out; more infrastructure, no added value here.
  - *Browser extension*: good future enhancement for one-click saving, but the
    spec places browser import/extension out of scope for v1.

## Decision 2: Local persistence — IndexedDB via Dexie

- **Decision**: Store bookmarks and tags in the browser's IndexedDB, accessed
  through Dexie (a small, well-established wrapper).
- **Rationale**: IndexedDB comfortably holds thousands of records and supports
  indexed lookups, satisfying the responsiveness target at 1,000+ bookmarks
  (SC-004). Dexie removes IndexedDB boilerplate and gives a clean async API for
  querying, indexing on tags and date-saved.
- **Alternatives considered**:
  - *localStorage*: simplest, but string-only, ~5MB cap, and no indexing —
    poor fit for thousands of records and search/filter.
  - *In-memory only*: fails the persistence requirement (FR-004).
  - *SQLite (via WASM)*: powerful but heavier than needed for this data shape.

## Decision 3: UI framework — React + Vite + TypeScript

- **Decision**: React 18 with Vite for build/dev, in TypeScript.
- **Rationale**: Mainstream, well-documented, fast local dev, strong typing for
  the Bookmark/Tag model, and a large testing ecosystem. Keeps the list, form,
  filter, and search views straightforward to build and test.
- **Alternatives considered**:
  - *Vanilla TS / no framework*: fewer dependencies, but more hand-rolled
    state/DOM code for the interactive list, form, and filtering.
  - *Svelte/Vue*: comparable; React chosen for ubiquity and testing tooling.

## Decision 4: Address validation & title fallback

- **Decision**: Validate addresses with the platform URL parser; accept
  `http`/`https` web addresses, normalize (trim, add scheme if missing). When no
  title is provided, fall back to the address's host/path as a default title.
- **Rationale**: Satisfies FR-003 (reject empty/malformed) and FR-002 (suggest a
  default title) without any network fetch — consistent with the offline,
  no-network constraint. Automatic fetching of the real page title would require
  network requests and is deferred.
- **Alternatives considered**:
  - *Fetch the live page to read its `<title>`*: gives nicer default titles but
    breaks the offline/no-network constraint and adds CORS complexity. Deferred
    to a possible later release.

## Decision 5: Testing approach

- **Decision**: Vitest + React Testing Library for unit and component tests;
  a single Playwright end-to-end smoke test covering save → find → open.
- **Rationale**: Matches the chosen stack, keeps fast feedback for the data layer
  and components, and proves the primary MVP flow works end to end.
- **Alternatives considered**: Jest (Vitest integrates more naturally with Vite);
  Cypress (Playwright chosen, comparable).

## Cross-cutting notes

- **No network at runtime**: all decisions preserve a fully local, offline app.
- **Ordering**: bookmarks carry a `dateSaved` timestamp and are shown
  most-recent-first by default (FR-014).
- **Duplicates**: saving an existing address is allowed but the app warns
  (FR-013) — handled in the data layer / form, not by a uniqueness constraint.
