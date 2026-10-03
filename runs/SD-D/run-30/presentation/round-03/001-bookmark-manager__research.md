# Technical Research: Bookmark Manager

## Decision 1: One TypeScript web application with separate client and server packages

**Decision**: Use Node.js 24 and TypeScript throughout, React 19 with Vite for the browser client, and Express 5 for the HTTP service, organized as one npm workspace.

**Rationale**: Page metadata retrieval and persistence require a trusted server boundary, while the interactive list, editor, filters, and dialogs benefit from component-based client state. A shared language and schema package reduces contract duplication. React's official guidance supports Vite for scratch-built apps, and Express 5 supports the available Node runtime.

**Alternatives considered**: A browser-only app cannot reliably retrieve arbitrary page metadata or enforce server fetch controls. Server-rendered pages are viable but less direct for rich filtering and inline state. Multiple deployable services add unjustified overhead.

**Primary references**: [React scratch setup](https://react.dev/learn/build-a-react-app-from-scratch), [Express 5 runtime support](https://expressjs.com/en/guide/migrating-5/), [Node.js 24 HTTP API](https://nodejs.org/download/release/latest-v24.x/docs/api/http.html)

## Decision 2: SQLite with explicit migrations and transactional repositories

**Decision**: Use SQLite through `better-sqlite3`, enable foreign keys and write-ahead logging, and maintain ordered migration files.

**Rationale**: The product is single-user and capped at 10,000 bookmarks. SQLite provides durable constraints, atomic changes, indexed lookup, and simple backup without another service. Synchronous access is suitable when transactions stay short and network retrieval precedes writes.

**Alternatives considered**: PostgreSQL adds operations not justified by v1. Browser storage cannot support the trusted server boundary and unified backup. JSON files make uniqueness, relations, and concurrent writes fragile.

**Primary references**: [SQLite transactions](https://www.sqlite.org/lang_transaction.html), [SQLite foreign keys](https://www.sqlite.org/foreignkeys.html)

## Decision 3: Parse the specified search language before filtering

**Decision**: Implement a tokenizer and parser for terms, quoted phrases, `#tag`, `OR`, and prefix `NOT`. Adjacent positive clauses mean AND; NOT binds to the next atom. Parentheses are rejected in v1. Evaluate the expression over indexed bookmark/tag data and normalized searchable text.

**Rationale**: A parser gives deterministic validation and approved semantics without exposing storage syntax as product behavior. The 10,000-item bound permits a straightforward evaluator while leaving room for SQLite FTS later.

**Alternatives considered**: Raw FTS syntax would leak an accidental grammar. Parentheses are explicitly deferred. Substring-only search cannot satisfy the specification.

**Primary reference**: [SQLite FTS5](https://www.sqlite.org/fts5.html)

## Decision 4: Server-side metadata retrieval with an SSRF-resistant fetch policy

**Decision**: Fetch metadata only through a service that validates protocol, credentials, DNS results, every redirect target, deadlines, byte limits, and accepted content. Cache validated raster visuals locally and never hotlink them in collection views.

**Rationale**: User URLs are untrusted. Unrestricted fetches could reach loopback, private, link-local, or cloud-metadata addresses. Redirect and DNS-rebinding defenses supplement initial validation; bounded streams and abort signals limit resource use.

**Alternatives considered**: Client requests fail cross-origin in common cases. A third-party preview API adds cost, privacy exposure, and vendor dependence. Hotlinking leaks viewing activity and is unreliable.

**Primary references**: [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), [Node.js HTTP streaming and abort signals](https://nodejs.org/download/release/latest-v24.x/docs/api/http.html)

## Decision 5: Constrained Markdown source for formatted notes

**Decision**: Store Markdown source, offer formatting controls and preview, permit headings, links, ordered/unordered lists, and paragraphs, and render through a strict allowlist with raw HTML disabled.

**Rationale**: Markdown maps cleanly to the approved lightweight formatting, remains editable and portable, and converts to plain text for search. Sanitization remains mandatory at rendering.

**Alternatives considered**: Arbitrary HTML is harder to sanitize and edit safely. Rich-text JSON is too heavy for four formatting categories. Plain text violates the approved specification.

## Decision 6: Layered automated verification with controlled network fixtures

**Decision**: Use Vitest, Testing Library, Supertest, and Playwright 1.61.0. Metadata tests use local fixtures and injected DNS/fetch adapters; end-to-end tests never depend on public websites.

**Rationale**: Deterministic fixtures prove extraction, redirect checks, fallback, limits, and duplicates without internet flakiness. Playwright matches the installed browser tooling.

**Alternatives considered**: Public sites are unstable test dependencies. End-to-end-only coverage is too slow and opaque for parser and security edges.

## Resolved Unknowns

All technical-context questions are resolved. No `NEEDS CLARIFICATION` markers remain, and no external paid service is required.
