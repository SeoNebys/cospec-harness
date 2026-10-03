# Security Validation: Bookmark Manager

**Validated**: 2026-09-23

## Page-retrieval boundary

| Threat | Control | Evidence |
|---|---|---|
| Non-web or credential-bearing URLs | WHATWG parsing; HTTP(S)-only scheme allowlist; embedded credentials rejected | `tests/unit/urlPolicy.test.ts` |
| Loopback, private, link-local, reserved, multicast, and IPv4-mapped IPv6 targets | Every resolved address must classify as public unicast | `tests/unit/urlPolicy.test.ts` |
| DNS rebinding | Connection lookup is pinned to an address returned by the validated resolution | `src/server/services/metadataFetcher.ts` |
| Redirect to an unsafe target | Automatic redirects are disabled; every hop is normalized, resolved, and revalidated; maximum five hops | `src/server/services/metadataFetcher.ts` |
| Slow or unbounded responses | Eight-second total deadline, bounded header/body timeouts, and 1 MiB streaming body cap | `src/server/services/metadataFetcher.ts` |
| Unexpected content | Only HTML/XHTML is parsed; metadata is normalized and returned as text | `src/server/services/metadataFetcher.ts`, `tests/unit/metadataParser.test.ts` |
| Metadata injection | React renders retrieved strings as text and no destination HTML enters the UI | `src/client/features/bookmarks/BookmarkEditor.tsx` |

## Application and storage

- All bookmark values pass shared Zod constraints and are revalidated by the server.
- SQLite statements bind values as parameters; no user value is concatenated into SQL. Sort clauses come only from a closed enum.
- Foreign keys and defensive mode are enabled, extension loading is disabled, and writes spanning tags are transactional.
- Request logging redacts descriptions and personal notes. Page bodies are never logged or stored.
- The production static-file dependency was upgraded after audit; `npm audit` reports zero known vulnerabilities.
- There is intentionally no in-app authentication. Per the approved specification, privacy depends on deploying this single-user application within a private access boundary.

## Manual verification

- A real request to `https://example.com` returned `Example Domain` through the pinned-address retrieval path.
- A request targeting `127.0.0.1` was rejected with HTTP 403 before connection.
