# Research: Personal Bookmark Manager

**Date**: 2026-09-26

All planning unknowns are resolved. Decisions below use the smallest architecture that satisfies the approved specification and runtime constraints.

## Runtime and Application Shape

**Decision**: Use Node.js 24 LTS, TypeScript 5.9, and one npm package containing a React 19.3/Vite 8.3 client and Express 5.2 server. Production runs one Express process that serves `/api/*` and the built SPA on `0.0.0.0:4000`.

**Rationale**:

- Node 24 is already installed in the workspace and is an LTS line supported through April 2028.
- Vite 8 supports the installed runtime and provides a direct React/TypeScript browser build without requiring server rendering.
- Express 5 supports modern async handlers and can serve the compiled static assets and API from one process.
- One package and process are sufficient for a private, single-user app and minimize duplicated build, deployment, and contract configuration.

**Alternatives considered**:

- **Next.js or another full-stack framework**: Rejected because this private app has no SEO or server-rendering need.
- **Separate frontend/backend packages**: Rejected because neither component is independently deployed.
- **Frontend-only app**: Rejected because arbitrary page metadata cannot be retrieved reliably in the browser and server-side controls are required for safe fetching.

**Sources**: [Node release schedule](https://nodejs.org/en/about/previous-releases), [Node 24 LTS migration note](https://nodejs.org/en/blog/migrations/v22-to-v24), [React 19.3](https://react.dev/blog/2026/09/09/react-19-3), [Vite 8 release and runtime support](https://vite.dev/blog/announcing-vite8), [Express 5 migration guide](https://expressjs.com/en/guide/migrating-5/)

## Durable Storage

**Decision**: Use SQLite through `better-sqlite3` 13 with direct prepared SQL, explicit transactions, `STRICT` tables, versioned migrations, WAL mode, and foreign keys. Keep database access behind a repository module.

**Rationale**:

- A local SQLite file directly matches one user, one process, one installation, and 1,000-record scope.
- `better-sqlite3` supports current Node versions, tests Node 24, provides transactions, and avoids adopting Node's still release-candidate SQLite API.
- Three domain tables do not justify an ORM. Direct SQL keeps tag intersection, duplicate warnings, and transactional mutations visible and testable.

**Alternatives considered**:

- **Node `node:sqlite`**: Attractive because it removes a dependency, but Node 24 currently labels it Stability 1.2 (release candidate). The repository boundary makes a future switch feasible.
- **Browser local storage or IndexedDB**: Rejected because a server is already required for metadata, split persistence would complicate error handling and restart verification, and relational tag updates benefit from transactions.
- **PostgreSQL**: Rejected as operational overhead for a single local user and 1,000 bookmarks.
- **Full-text search**: Deferred until measurement shows ordinary matching cannot meet the one-second target.

**Sources**: [`better-sqlite3` project](https://github.com/WiseLibs/better-sqlite3), [`better-sqlite3` Node 24 build matrix](https://github.com/WiseLibs/better-sqlite3/blob/master/.github/workflows/build.yml), [Node 24 SQLite stability](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html), [SQLite STRICT tables](https://www.sqlite.org/stricttables.html), [SQLite foreign keys](https://www.sqlite.org/foreignkeys.html)

## Shared Validation and Client State

**Decision**: Use Zod 4 schemas shared between client and server, native browser `fetch`, React hooks/reducers, and URL query parameters for view/search/tag/sort state. Do not add React Router, a request-cache library, or a global state library.

**Rationale**:

- Runtime validation is required at the HTTP boundary even with TypeScript types.
- Two top-level views and a small CRUD surface do not require a routing or state framework.
- Query parameters naturally preserve the active view across browser history and bookmark mutations.

**Alternatives considered**:

- **Client-only validation**: Rejected because clients are not a trust boundary.
- **Redux/Zustand/query caching**: Rejected because the server dataset is small and straightforward reload-after-mutation behavior is clearer.
- **React Router**: Rejected because there are no nested or independently rendered routes in scope.

**Source**: [Zod 4 documentation](https://zod.dev/packages/zod)

## Page Metadata Fetching

**Decision**: Expose `POST /api/page-metadata`. Use Undici with a custom, connection-pinning dispatcher and manual redirects; use `ip-address` for address classification and Cheerio's non-executing byte-buffer parser. Retrieval is best-effort and never blocks manual saving.

**Rationale**:

- Server-side fetching is an SSRF boundary because the destination is user-controlled.
- Only absolute HTTP(S) addresses without credentials and using effective ports 80/443 are fetched. Saving other otherwise-valid HTTP(S) bookmarks remains possible through manual entry.
- Every hostname and redirect is resolved and checked. All returned addresses must be globally routable; the actual connection is pinned to a validated address to avoid DNS rebinding between validation and use.
- Redirects are handled manually and limited to three so every destination receives the same validation.
- One four-second deadline, four-request concurrency cap, HTML/XHTML content-type requirement, bounded headers, and a 512 KiB decompressed-body cap protect availability and keep the UI within its five-second outcome.
- Cheerio parses HTML without executing scripts or loading subresources. Output is plain normalized text only.

**Alternatives considered**:

- **Browser fetch**: Rejected because cross-origin policy makes arbitrary pages unreliable and the client cannot enforce server-network isolation.
- **Cheerio `fromURL` directly**: Rejected because fetch policy, redirects, connection pinning, and resource limits must be controlled before parsing.
- **Headless browser**: Rejected because executing untrusted pages is slower, consumes more resources, and greatly enlarges the security boundary.
- **External metadata provider**: Rejected because it adds privacy, availability, cost, and vendor dependencies.
- **Automatic redirects**: Rejected because a safe initial URL can redirect to a private service.

**Sources**: [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), [IANA IPv4 special-purpose registry](https://www.iana.org/assignments/iana-ipv4-special-registry), [IANA IPv6 special-purpose registry](https://www.iana.org/assignments/iana-ipv6-special-registry), [Node DNS lookup](https://nodejs.org/api/dns.html), [Node fetch and abort APIs](https://nodejs.org/docs/latest/api/globals.html), [Cheerio loading bytes](https://cheerio.js.org/docs/basics/loading/), [Cheerio security guidance](https://cheerio.js.org/docs/advanced/security/)

## Metadata Semantics and Race Handling

**Decision**: Prefer the standard document `<title>` and description meta element, then Open Graph and Twitter fallbacks. Track URL request generation plus per-field origin/edit versions and apply a response only to a still-empty, untouched field for the current URL.

**Rationale**:

- The HTML title is explicitly the document title used for history/bookmark labeling; the standard description represents a short page summary.
- Open Graph and Twitter tags are useful fallbacks but can be written as promotional share-card copy rather than the page's primary identity.
- Request generation prevents URL A from filling URL B. Field edit versions protect typing, clearing, and retyping while the request is in flight.
- The parser decodes entities, collapses whitespace, removes control characters, caps title at 300 code points and description at 1,000, and returns strings that the UI renders as text.

**Alternatives considered**:

- **Open Graph first**: Rejected because the promised feature is the page's title and description, not a social preview.
- **Last response wins**: Rejected because it can overwrite user edits or information for a newer URL.
- **Scrape body text when metadata is missing**: Rejected because it is unpredictable and exceeds the requested short-description behavior; manual fallback is explicit in the spec.

**Sources**: [HTML title element](https://html.spec.whatwg.org/multipage/semantics.html#the-title-element), [HTML meta description](https://html.spec.whatwg.org/multipage/semantics.html#meta-description), [Open Graph protocol](https://ogp.me/)

## API Style

**Decision**: Use a same-origin REST/JSON API described by OpenAPI 3.1. Mutations use typed bodies; duplicate URLs produce `409 DUPLICATE_URL` until explicitly overridden; other errors use a consistent envelope.

**Rationale**:

- REST maps directly to this small CRUD domain and is easily exercised from the UI, Supertest, or a terminal.
- A separate metadata-preview endpoint makes failure non-blocking and prevents coupling bookmark validity to an upstream page.
- An explicit duplicate override makes the warning authoritative under races while honoring intentional duplicates.

**Alternatives considered**:

- **GraphQL**: Rejected as unnecessary schema/runtime complexity for a small fixed API.
- **Silent duplicate acceptance**: Rejected because it fails the approved warning flow.
- **Unique URL constraint**: Rejected because the user may intentionally save a duplicate.

## Accessibility and Interaction Patterns

**Decision**: Target WCAG 2.2 AA practices with semantic HTML, keyboard-operable controls, visible focus, labelled fields, polite live feedback, accessible Library/Read Later tabs, and inline delete confirmation.

**Rationale**:

- Native controls provide reliable keyboard and assistive-technology behavior.
- Tabs are appropriate for two preloaded views when their documented keyboard behavior is implemented.
- Inline confirmation avoids modal focus-trapping complexity while still requiring explicit deletion confirmation.
- Status messages announce metadata and persistence outcomes without unexpectedly moving focus.

**Alternatives considered**:

- **Custom clickable cards/divs**: Rejected because native links and buttons offer stronger semantics and keyboard behavior.
- **Deletion modal**: Valid, but rejected for this small workflow because inline confirmation is simpler and less disruptive.

**Sources**: [WCAG 2.2](https://www.w3.org/TR/wcag/), [WAI-ARIA tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/), [WAI-ARIA alert pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alert/)

## Test Strategy

**Decision**: Use Vitest 5 for shared/server tests, jsdom and React Testing Library for component behavior, Supertest for the exported Express app, and Playwright 1.61.0 with Chromium for end-to-end checks. Metadata tests use injected DNS/transport fixtures rather than the public internet.

**Rationale**:

- Vitest integrates with the Vite/TypeScript toolchain and covers pure logic and services.
- Testing Library favors user-visible interactions and accessible queries.
- Supertest validates real HTTP behavior against temporary databases without binding a public port.
- The environment provides Playwright 1.61.0 browser binaries, so the package must match that exact version.
- Deterministic metadata fixtures exercise SSRF and limit controls without depending on third-party availability.

**Alternatives considered**:

- **Only end-to-end tests**: Rejected because security boundary and normalization edge cases need fast, focused coverage.
- **Live public pages in the normal suite**: Rejected as slow, nondeterministic, and unsuitable for testing hostile network cases.
- **A second test runner for the server**: Rejected to avoid duplicated TypeScript and reporting configuration.

**Sources**: [Vitest guide](https://vitest.dev/guide/), [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/), [Playwright installation](https://playwright.dev/docs/intro), [Playwright browsers and version matching](https://playwright.dev/docs/browsers)
