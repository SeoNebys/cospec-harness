# Research: Bookmark Manager

**Date**: 2026-09-18

## 1. Runtime and application shape

**Decision**: Use one Node.js 24 LTS process and one npm package. TypeScript 6 is selected because the current typed ESLint toolchain supports it, while TypeScript 7 is not yet accepted by that toolchain. Express 5 serves a same-origin REST API and the static React 19 client built by Vite 8.

**Rationale**: The feature is a private, single-screen CRUD application that still needs server-side page retrieval. One process matches the review runtime, avoids CORS and distributed deployment concerns, and keeps backup and operation simple. Node 24 supports the selected framework versions and supplies stable TypeScript type stripping plus the embedded SQLite module needed by the design.

**Alternatives considered**:

- Next.js: capable, but server rendering, React Server Components, and framework routing add upgrade and deployment surface without user value for this one-screen application.
- React Router framework mode: unnecessary routing and server-rendering machinery for the current scope.
- Vanilla DOM: fewer packages, but async metadata state, dialogs, filters, and editing make React's state model worthwhile.
- Separate frontend/backend packages: rejected because there is one deployable process and no independent consumer.

**Sources**: [Node.js releases](https://nodejs.org/en/about/previous-releases), [Express 5 migration guide](https://expressjs.com/en/guide/migrating-5/), [Vite 8 announcement](https://vite.dev/blog/announcing-vite8), [React versions](https://react.dev/versions)

## 2. Persistence

**Decision**: Use Node 24's built-in `node:sqlite` `DatabaseSync`, prepared statements, strict tables, transactions, and numbered handwritten SQL migrations. Store the database in a configurable local data directory.

**Rationale**: One user and approximately 1,000 records create negligible contention, so synchronous embedded access is simple and sufficient. Built-in SQLite avoids a database service, ORM, and native add-on while still providing constraints, transactions, and durable persistence. Node 24.15 promoted `node:sqlite` to release-candidate stability; the implementation will pin Node 24 and isolate storage behind a repository so it can be replaced later.

**Alternatives considered**:

- `better-sqlite3`: mature, but duplicates runtime capability and adds a native binary dependency.
- PostgreSQL: operationally excessive for a private one-process application.
- Browser local storage or IndexedDB: would couple durable data to one browser profile and weaken server-side validation, backup, and testability.
- ORM: three small tables and a bounded query surface do not justify generated clients or migration abstractions.

**Source**: [Node.js SQLite documentation](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)

## 3. Runtime validation and URL identity

**Decision**: Use Zod 4 at every JSON API boundary. Normalize bookmark addresses with the WHATWG `URL` parser: trim input, prepend `https://` only when the missing-scheme input is unambiguous, allow only HTTP/HTTPS, reject credentials, remove default ports through URL serialization, preserve path/query/fragment, and store a canonical comparison key alongside the user-visible address.

**Rationale**: TypeScript types do not validate untrusted runtime data. A single shared URL rule makes the form, API, duplicate check, and metadata preview agree. Preserving meaningful URL components avoids collapsing bookmarks to distinct page sections or query states. The database unique constraint remains the final defense against duplicate races.

**Alternatives considered**:

- Regular-expression URL parsing: fragile and inconsistent with browser URL behavior.
- Requiring users to type a scheme: adds friction contrary to the approved convenience goal.
- Removing tracking parameters or following canonical links: opinionated transformations can change destination meaning and are outside the specification.

**Sources**: [WHATWG URL Standard](https://url.spec.whatwg.org/), [Zod documentation](https://zod.dev/packages/zod)

## 4. Metadata retrieval boundary

**Decision**: Expose a separate best-effort metadata-preview endpoint. The browser starts it after URL entry but never couples it to saving. The server retrieves only public HTTP/HTTPS HTML on ports 80/443, manually validates every redirect, checks all resolved IPv4/IPv6 addresses, and pins an approved address to the connection. Apply a four-second total timeout, five-redirect limit, one-megabyte decoded-body limit, and bounded concurrency.

**Rationale**: Browsers cannot reliably read arbitrary sites because of cross-origin restrictions, so server retrieval is required. A user-supplied URL creates an SSRF boundary: scheme checks alone do not prevent access to internal services or DNS rebinding. Manual redirect validation, public-address checks, connection pinning, time/size limits, and no credential forwarding contain that risk. Keeping preview separate ensures slow or blocked sites cannot prevent saving.

**Alternatives considered**:

- Browser-only retrieval: unreliable due to cross-origin policy and inconsistent page headers.
- Browser automation/headless rendering: heavy, slow, and unnecessary for published page metadata.
- Ordinary `fetch` after a one-time DNS check: vulnerable to re-resolution and redirect bypass.
- Allowing all ports: unnecessary for the initial public-web use case and broadens access to unintended services.

**Sources**: [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), [Node.js fetch and AbortSignal](https://nodejs.org/download/release/latest-v24.x/docs/api/globals.html), [IANA IPv4 special-purpose registry](https://www.iana.org/assignments/iana-ipv4-special-registry), [IANA IPv6 special-purpose registry](https://www.iana.org/assignments/iana-ipv6-special-registry)

## 5. Metadata extraction and user ownership

**Decision**: Parse bytes with Cheerio without executing page code. Prefer `<title>` for the page name, then `og:title` and `twitter:title`; prefer `og:description`, then standard `meta[name=description]` and `twitter:description`. Store only decoded plain text after Unicode/whitespace/control-character cleanup, capped at 300 title code points and 1,000 description code points. On the client, request generation and per-field dirty flags ensure stale results and late results never overwrite user edits.

**Rationale**: HTML `<title>` is specifically intended to identify documents in bookmarks. Open Graph and standard description tags provide the requested short descriptions without generating summaries from body content. Plain-text extraction plus normal framework escaping prevents foreign markup from becoming executable. Dirty fields encode the approved rule that user input always wins.

**Alternatives considered**:

- Generating a description from body text: drifts into excluded summary behavior and produces unpredictable content.
- Executing JavaScript to obtain client-rendered metadata: expands resource use and attack surface.
- Persisting a background metadata job: unnecessary for a best-effort preview; immediate save deliberately uses the URL fallback.

**Sources**: [HTML title element](https://html.spec.whatwg.org/multipage/semantics.html#the-title-element), [MDN page metadata](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content/Webpage_metadata), [Cheerio loading documents](https://cheerio.js.org/docs/basics/loading/), [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)

## 6. Query and view state

**Decision**: Keep search text, tag, favorite filter, sort order, and active/archive view in URL search parameters. Query the bounded library through the API and apply normalized Unicode-aware comparisons in the service layer.

**Rationale**: URL state survives opening and closing details, reloads, and browser history without creating another persisted entity. Service-level comparisons avoid depending on SQLite's default ASCII-limited case folding while the approved scale remains small enough for predictable sub-second behavior.

**Alternatives considered**:

- Component-only state: can be lost on navigation and makes history behavior surprising.
- Persisting view state in SQLite: exceeds the requirement, which only promises preservation during a visit.
- Adding a search engine/full-text extension: unnecessary for roughly 1,000 bookmarks and four searchable fields.

## 7. Verification strategy

**Decision**: Use Node's built-in `node:test` and `node:assert` for unit/integration coverage, Playwright 1.61.0 for a focused Chromium end-to-end suite at desktop and 320-pixel widths, and `@axe-core/playwright` plus explicit keyboard tests for accessibility. Tests compile/type-check with the application and use temporary databases and injected network dependencies.

**Rationale**: Node 24's stable runner supports mocks, timers, isolation, and coverage without another test framework. Playwright is available in the environment and proves user-visible flows in a real browser. Automated accessibility scans catch common issues, while keyboard/focus checks cover behavior scanners cannot establish.

**Alternatives considered**:

- Vitest/Jest: useful, but initially duplicates Node 24 test-runner capability.
- jsdom/Testing Library: deferred because domain logic can remain DOM-free and a small browser suite tests actual rendering.
- Live websites in automated tests: nondeterministic and dependent on third-party availability, bot controls, and content changes.
- Firefox/WebKit matrix: deferred because cross-browser breadth is not an approved requirement.

**Sources**: [Node.js test runner](https://nodejs.org/docs/latest-v24.x/api/test.html), [Playwright best practices](https://playwright.dev/docs/best-practices), [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing)

## 8. Deployment and privacy boundary

**Decision**: Run a single built Express service on `0.0.0.0:4000`, serve client and API from the same origin, disable cross-origin API use, verify origin/fetch metadata for state-changing requests, and document that the no-auth application must be deployed only in a private environment.

**Rationale**: This matches the prescribed review environment and approved single-user scope. Same-origin delivery removes CORS complexity. Because no account boundary exists, public exposure would turn a private library into an unauthenticated service; deployment privacy is therefore an operational prerequisite, not a substitute authentication feature.

**Alternatives considered**:

- Adding authentication: explicitly outside the approved first-release scope.
- Binding only to loopback: incompatible with the shared review environment.
