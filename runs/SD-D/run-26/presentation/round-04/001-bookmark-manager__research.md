# Research: Bookmark Manager

**Date**: 2026-09-27  
**Status**: Complete — no unresolved technical clarifications

## 1. Application Shape and Runtime

**Decision**: Use Node.js 24.x with strict TypeScript, Express 5.2, React 19.3, React Router Data Mode, and Vite 8.3. Build one React SPA and serve it with the REST API from one Node process on `0.0.0.0:4000`.

**Rationale**: The feature needs a trusted server for private persistence, arbitrary-site metadata retrieval, imports, exports, and background work, but it does not benefit from server-rendered pages or distributed services. One origin simplifies cookies, CSRF controls, icon delivery, deployment, and browser testing. Vite 8 supports the available Node line, and React Router keeps the collection/search state addressable in URLs.

**Alternatives considered**:

- Next.js or a full React framework was rejected because SSR/RSC and framework deployment conventions add complexity without serving a private authenticated CRUD app.
- A browser-only app was rejected because cross-origin metadata fetches are unreliable, private access is weak, and durable import/background enrichment is not feasible.
- Separate frontend and API deployments were rejected because they create CORS, cookie, and operational work with no scaling need.

**Sources**: [React versions](https://react.dev/versions), [Vite 8 announcement and Node support](https://vite.dev/blog/announcing-vite8), [Express 5 migration guide](https://expressjs.com/en/guide/migrating-5/), [React Router Data Mode](https://reactrouter.com/start/data/installation).

## 2. Persistence

**Decision**: Use `better-sqlite3` 13.x with one file-backed SQLite database, prepared SQL, append-only migrations, `foreign_keys=ON`, WAL, a busy timeout, and short synchronous transactions. Store content-addressed icon assets in a separate table. Do not introduce an ORM.

**Rationale**: The product has one owner, one application instance, and only 10,000-scale records. SQLite offers atomic bulk/import transactions, unique constraints, durable local operation, and straightforward backup without an external service. `better-sqlite3` supports Node 24 and mature transaction semantics; Node's built-in `node:sqlite` remains release-candidate stability in Node 24. Direct SQL is clearer for dynamic Boolean predicate compilation and staged imports than an ORM abstraction.

**Alternatives considered**:

- PostgreSQL was rejected until multi-user or multi-instance write concurrency exists.
- Node's built-in SQLite module was deferred until its API reaches stable status.
- A file-per-bookmark or JSON store was rejected because indexed search, uniqueness, transactionality, and crash-safe bulk operations would have to be rebuilt.

**Sources**: [SQLite appropriate uses](https://www.sqlite.org/whentouse.html), [SQLite WAL](https://www.sqlite.org/wal.html), [SQLite transactions](https://www.sqlite.org/lang_transaction.html), [Node 24 SQLite stability](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html), [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3).

## 3. Search Language and Evaluation

**Decision**: Implement a bounded handwritten tokenizer and recursive-descent parser for the grammar in `contracts/search-query.ebnf`. Compile the AST to parameterized SQL. Text leaves perform substring matching on NFKC-normalized, case-folded shadow fields; tag leaves use exact normalized tag identity. Keep collection scope outside the user AST.

**Rationale**: The approved semantics include uppercase `AND`/`OR`/`NOT`, unary `NOT`, implicit `AND`, exact phrases, and `tag:` leaves with actionable syntax errors. Passing user input to SQL or directly into FTS syntax would be unsafe and would not preserve those semantics. At 10,000 rows, bounded `instr` scans over precomputed fields are expected to remain under two seconds and preserve punctuation and URL substring behavior.

**Alternatives considered**:

- A parser generator was rejected because the grammar is small and a handwritten parser can return precise source spans with less dependency weight.
- Direct SQLite FTS5 syntax was rejected as the public query language because it differs around unary negation, tags, tokenization, punctuation, and error messages.
- SQLite FTS5 with its trigram tokenizer remains a measured fallback if the 10,000-row performance gate fails; it must sit behind the same AST and preserve public semantics.

**Source**: [SQLite FTS5 query and Boolean behavior](https://www.sqlite.org/fts5.html).

## 4. Metadata Retrieval Security Boundary

**Decision**: Fetch metadata server-side through a dedicated requester that accepts only absolute HTTP(S) URLs, rejects credentials and nonstandard retrieval ports, validates all DNS answers as public, pins a validated address to the connection, and manually revalidates each redirect. Use an end-to-end five-second deadline, no retries, no cookies or forwarded headers, bounded headers and bodies, inert HTML parsing, and global/per-host concurrency limits.

**Rationale**: Arbitrary URL fetching is an SSRF boundary. Scheme-only validation or checking one DNS result is insufficient because redirects, IPv4/IPv6 encodings, mixed answers, and DNS rebinding can reach internal services. The same controls must cover page and icon requests. Failure must return a safe partial/failed proposal and never block manual saving.

**Alternatives considered**:

- Browser-side fetches were rejected because of CORS, tracking exposure, and inconsistent HTML access.
- An external metadata API was rejected because it would disclose the user's collection and introduce cost/availability dependencies.
- Automatic redirects and validate-then-resolve-again flows were rejected because they reopen SSRF bypasses.
- Headless browser extraction was rejected because executing page JavaScript expands resource use and attack surface beyond the best-effort metadata requirement.

**Sources**: [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), [OWASP SSRF Prevention in Node.js](https://community.owasp.org/pages/controls/SSRF_Prevention_in_Nodejs), [IANA IPv4 special-purpose registry](https://www.iana.org/assignments/iana-ipv4-special-registry), [IANA IPv6 special-purpose registry](https://www.iana.org/assignments/iana-ipv6-special-registry), [RFC 9110 Content-Type guidance](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3).

## 5. Metadata and Icon Rules

**Decision**: Read metadata only from the inert document head. Prefer `og:title`/`og:description`, then Twitter equivalents, then HTML title/description. Do not replace the saved URL with canonical or Open Graph URLs. Rank declared `rel=icon` candidates and fall back to same-origin `/favicon.ico`; never use `og:image` as the small icon.

Icons accept a narrow raster allowlist, must pass MIME and signature checks, are bounded before and after decode, have metadata/animation removed, are re-encoded to a fixed safe raster, deduplicated by SHA-256, and served locally. SVG is excluded from v1 icon ingestion.

**Rationale**: Open Graph values usually provide concise preview text while HTML fallback covers ordinary pages. Treating remote icon URLs as browser resources would leak views and permit later content changes. Local normalization makes display and export deterministic.

**Alternatives considered**:

- JSON-LD/body scraping and web-manifest fetching were excluded because they add ambiguity and subresource contacts without being required.
- Remote icon hotlinking was rejected for privacy, tracking, MIME, and reliability reasons.
- SVG ingestion was rejected because active/XML content requires a larger sanitization surface than small raster icons.

**Sources**: [Open Graph protocol](https://ogp.me/), [WHATWG title element](https://html.spec.whatwg.org/multipage/semantics.html#the-title-element), [WHATWG icon link type](https://html.spec.whatwg.org/multipage/links.html#rel-icon), [OWASP File Upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).

## 6. Metadata Ownership and Background Work

**Decision**: Metadata endpoints return proposals. The client tracks request IDs and dirty fields; late results fill only untouched empty fields. An explicit refresh returns a field-level diff and applies nothing until approved. Generic imports enqueue durable jobs only for missing fields after the import transaction commits. No periodic refresh runs.

**Rationale**: This directly protects the approved rule that typing and prior edits are never lost. Durable import jobs make links immediately usable and allow work to resume after process restart without issuing 10,000 concurrent requests. Avoiding periodic refresh also avoids surprise changes and repeated disclosure of reading interests.

**Alternatives considered**:

- Mutating metadata as soon as a request finishes was rejected because of stale-response races and user ownership.
- Blocking import on enrichment was rejected because it conflicts with the 10,000-item import outcome.
- An external queue was rejected because one in-process persisted queue meets the single-instance scale.

## 7. Formatted Notes

**Decision**: Store raw CommonMark source. Edit with a textarea, preview, and compact syntax help. Render through `react-markdown` plus `rehype-sanitize`, without `rehype-raw` or `dangerouslySetInnerHTML`. Allow only paragraphs, bold, italic, ordered/unordered lists, list items, and links. Restrict links to HTTP(S) and `mailto`, add `noopener noreferrer`, and render images/unsupported structures as readable text rather than loading them.

**Rationale**: CommonMark directly covers the approved formatting set, remains portable in exports, and is easy to edit. AST-to-React rendering plus an allowlist avoids authoring or executing HTML and preserves malformed text readably.

**Alternatives considered**:

- A WYSIWYG/HTML editor was rejected because it adds complex editor state and HTML sanitization for no requested value.
- A regex renderer was rejected as fragile and unsafe.
- Full GitHub-flavored Markdown and raw HTML were rejected because tables, task lists, embedded images, and arbitrary HTML are outside the approved formatting set.

**Sources**: [CommonMark specification](https://spec.commonmark.org/), [`react-markdown` security and options](https://github.com/remarkjs/react-markdown/blob/main/readme.md), [`rehype-sanitize`](https://github.com/rehypejs/rehype-sanitize/blob/main/readme.md), [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html).

## 8. Bookmark HTML Import and Export

**Decision**: Treat browser bookmark HTML as the de facto Netscape dialect. Decode according to BOM/declared encoding, parse with an inert streaming parse5 tokenizer and a folder stack, accept only HTTP(S) anchors, and stage records for preview. Every non-root ancestor folder becomes a tag; Firefox `TAGS` values are unioned for generic files. Exact duplicates against the library and earlier file entries are skipped, with the first valid occurrence winning.

Export escaped UTF-8 HTML with the Netscape header, Active and Archive top-level folders, standard `HREF`, title, timestamps, `TAGS`, description, and safe data icon fields. Each bookmark appears once. A versioned `data-bookmark-manager-meta` base64url JSON attribute carries the exact note, tags, read/archive state, timestamps, description, and icon-choice state for direct app-to-app restoration. Generic browsers may ignore this extension while retaining titles and URLs.

**Rationale**: Browsers converge on this historical format even though it is not a formal standard. Standard anchor/folder fields provide portability; a standards-valid private `data-*` attribute provides lossless round trips without duplicating multi-tag bookmarks into multiple folders.

**Alternatives considered**:

- Regex and browser DOM rendering were rejected for malformed legacy HTML and untrusted-resource behavior.
- JSON/ZIP export was rejected because it violates the single browser-compatible file requirement.
- Folder-per-tag export was rejected because multi-tag bookmarks would appear more than once.

**Sources**: [Chromium bookmark HTML writer](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/browser/bookmarks/bookmark_html_writer.cc), [Firefox bookmark HTML utilities](https://searchfox.org/firefox-main/source/toolkit/components/places/BookmarkHTMLUtils.sys.mjs), [WHATWG `data-*` attributes](https://html.spec.whatwg.org/multipage/dom.html#embedding-custom-non-visible-data-with-the-data-*-attributes), [parse5](https://parse5.js.org/).

## 9. Private Owner Access

**Decision**: Provision one owner password hash through the environment. Verify with asynchronous `scrypt`, issue a high-entropy opaque session token whose digest is stored in SQLite, and bind a separate CSRF token to the session. Apply strict cookies, origin/fetch-metadata checks, login throttling, idle/absolute expiry, and centralized security headers.

**Rationale**: The approved scope needs privacy but explicitly does not need accounts or collaboration. A password gate and revocable sessions provide that boundary without inventing user-management features. Database sessions survive restarts and can be invalidated.

**Alternatives considered**:

- Network location alone was rejected as insufficient to make the collection inaccessible to unrelated visitors.
- OAuth/SSO was rejected as an external dependency and multi-account concept outside scope.
- A long-lived signed cookie without server state was rejected because revocation and review-session control are weaker.

**Sources**: [Node.js `scrypt`](https://nodejs.org/download/release/latest-v24.x/docs/api/crypto.html), [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

## 10. Testing and Performance Gates

**Decision**: Use Vitest for unit/integration tests, React Testing Library for UI behavior, fast-check for parsers and round trips, and exactly Playwright 1.61.0 for browser tests because that revision is installed in the workspace. Exercise real temporary SQLite files and controlled hostile HTTP/DNS fixtures. Add seeded performance suites for every quantitative success criterion.

**Rationale**: Parser, import/export, and SSRF boundaries benefit from generated inputs and adversarial fixtures. Real database and browser tests prove persistence, keyboard behavior, focus, downloads, and round trips that mocks cannot. Version pinning avoids downloading a second browser build.

**Alternatives considered**:

- Mock-only persistence/network tests were rejected because they cannot prove constraints, transaction behavior, socket pinning, or malformed real responses.
- Using an unpinned current Playwright release was rejected because it would mismatch the supplied browser revision.

**Sources**: [Vitest guide](https://vitest.dev/guide/), [Playwright testing](https://playwright.dev/docs/writing-tests), [fast-check](https://fast-check.dev/).
