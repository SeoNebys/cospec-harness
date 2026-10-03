# Phase 0 Research: Bookmark Manager

## Full-stack application shape

**Decision**: Use Next.js 16 App Router, React, and TypeScript in one self-hosted Node.js 24 process.

**Rationale**: A single project serves the UI, same-origin JSON routes, server-only metadata retrieval, and SQLite access. It matches the small deployment surface and the required `npm start` runtime on `0.0.0.0:4000`. Next.js documents Node self-hosting and Node 20.9+ support; React documents first-class TypeScript use.

**Alternatives considered**: Vite plus Express/Fastify gives more explicit layers but adds separate build/server plumbing. A browser-only app cannot safely bypass cross-origin controls or implement the required metadata retrieval and persistence semantics.

**Sources**: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting), [React with TypeScript](https://react.dev/learn/typescript)

## Persistence and validation

**Decision**: Use SQLite through `better-sqlite3` and Drizzle ORM with checked-in SQL migrations; use Zod schemas at request/response boundaries.

**Rationale**: SQLite is durable and operationally simple for one user and 1,000 records. Drizzle keeps schema/migrations explicit and typed. `better-sqlite3` is mature for synchronous local access. Shared Zod schemas prevent transport types from drifting from runtime validation.

**Alternatives considered**: Node's built-in `node:sqlite` reduces dependencies but Node 24 documentation still labels it release-candidate. Prisma is capable but heavier for this schema. Browser storage would make server-rendered persistence and future backup handling less robust.

**Sources**: [Drizzle SQLite guide](https://orm.drizzle.team/docs/sqlite/get-started-sqlite), [better-sqlite3](https://github.com/WiseLibs/better-sqlite3), [Node 24 SQLite](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)

## Metadata retrieval and parsing

**Decision**: Retrieve metadata server-side with a dedicated injectable fetcher and parse static HTML with Cheerio. Prefer `<title>`, falling back to `og:title`; prefer `meta[name="description"]`, falling back to `og:description`. Normalize whitespace/control characters and clamp the description to 300 characters. Do not execute scripts, load subresources, or synthesize body-text summaries.

**Rationale**: This extracts page-declared details while preserving the privacy and scope boundaries in the approved specification. An injectable fetcher makes failures and races deterministic in tests.

**Alternatives considered**: A headless browser is much heavier and creates script/subresource risk. A third-party metadata service leaks each saved URL to another party. Client-side fetching is blocked inconsistently by cross-origin policy and cannot enforce the server's network boundary.

**Sources**: [WHATWG document metadata](https://html.spec.whatwg.org/multipage/semantics.html), [WHATWG HTML parsing](https://html.spec.whatwg.org/multipage/parsing.html)

## SSRF and resource controls

**Decision**: Allow only credential-free HTTP(S) URLs on ports 80/443. Resolve every A/AAAA result, require all results to be globally routable, pin the actual connection to a validated address, and re-run validation for every manually followed redirect. Limit the operation to five redirects, eight seconds total, and 2 MiB of decoded HTML.

**Rationale**: Accepting arbitrary user URLs makes metadata retrieval an SSRF boundary. Validation before a normal second DNS lookup is insufficient; address pinning closes the rebinding gap. An eight-second internal deadline leaves enough time to satisfy the ten-second UI limit.

**Alternatives considered**: Blocking only RFC1918 ranges misses loopback, link-local, cloud metadata, IPv6, mapped, and other non-global addresses. Automatic redirects can move from a checked public URL to an unsafe destination. A domain allowlist is incompatible with a general bookmark manager.

**Sources**: [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), [IANA IPv4 special registry](https://www.iana.org/assignments/iana-ipv4-special-registry), [IANA IPv6 special registry](https://www.iana.org/assignments/iana-ipv6-special-registry), [Node DNS](https://nodejs.org/api/dns.html), [Node AbortSignal](https://nodejs.org/download/release/latest-v24.x/docs/api/globals.html)

## Client race and edit protection

**Decision**: Debounce valid URL preview requests, abort superseded browser requests, attach a monotonically increasing request identity, and track title and description dirty state separately. Apply a response only when it matches the current URL/request and only to untouched fields.

**Rationale**: Aborting alone is not a correctness guarantee because an older response may already be completing. Request identity prevents stale-address data; per-field dirty flags implement the approved no-clobber requirement.

**Alternatives considered**: Last-response-wins can put metadata from an old URL into the current form. A single form-level dirty flag unnecessarily blocks autofill of one untouched field when the user edited only the other.

## Testing and accessibility

**Decision**: Use Vitest for unit/integration tests, React Testing Library and `user-event` for component behavior, MSW for HTTP isolation, Playwright 1.61.0 for contract/E2E tests, and `@axe-core/playwright` plus manual keyboard checks for accessibility.

**Rationale**: The layers test domain logic quickly, UI behavior through accessible interactions, the real deployed HTTP boundary, and the user-visible acceptance flows. Public websites are replaced by deterministic local HTML fixtures. Playwright recommends user-visible behavior, isolated tests, role locators, and pairing automated accessibility checks with manual review.

**Alternatives considered**: Jest is viable but duplicates more configuration in this TypeScript setup. Live public-site tests are flaky and unsafe. Axe alone cannot validate all keyboard and assistive-technology behavior.

**Sources**: [Vitest request mocking](https://main.vitest.dev/guide/mocking/requests), [Testing Library principles](https://testing-library.com/docs/react-testing-library/intro/), [Playwright best practices](https://playwright.dev/docs/best-practices), [Playwright API testing](https://playwright.dev/docs/api-testing), [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing)
