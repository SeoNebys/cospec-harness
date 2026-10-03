# Validation Results: Bookmark Manager

Validated on 2026-09-27 in the prepared Node.js 24 / Chromium environment.

## Automated gates

| Command | Result |
|---|---|
| `npm run lint` | Pass; zero warnings |
| `npm run typecheck` | Pass |
| `npm test` | Pass; 17 files and 37 tests |
| `npm run test:contract` | Pass; 5 files and 9 tests |
| `PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers npm run test:e2e` | Pass; 14 journeys across desktop and mobile Chromium |
| `npm run test:performance` | Pass; 10,000 bookmarks, 500 distinct tags, 30 representative search/filter trials, p95 below 2 seconds |
| `npm run build` | Pass; production build generated all application and API routes |
| `npm audit --audit-level=low` | Pass; 0 vulnerabilities |
| `npm run db:migrate` | Pass; database current and repeatable |
| `SEED_REVIEW_USER=true npm run db:seed` | Pass; existing review account handled idempotently |
| `npm run db:backup -- --dry-run` | Pass; source and destination reported without writing |
| `npm run db:cleanup-icons -- --dry-run` | Pass; orphan count reported without deleting |

The metadata security tests cover blocked private/loopback destinations, redirects, size/media limits, and guarded failure behavior. The browser accessibility check reports no serious or critical WCAG A/AA findings on sign-in or the authenticated library at either viewport.

## Acceptance scenarios

| Scenario | Observed outcome |
|---|---|
| Address-only metadata | A live authenticated request saved `https://example.com/?lattice-review=20260927` as **Example Domain** without a supplied title. The stored URL was preserved. Browser tests verify generated-title editing and persistence. |
| Metadata failure fallback | Desktop and mobile journeys saved a deliberately unreachable address, displayed an address-derived title and safe explanatory notice, then retained a user-edited title. |
| Duplicate decision | Desktop and mobile journeys verified that **Keep existing** leaves one record and **Save another copy** creates exactly one additional record. |
| Organize and find | Browser journeys added notes and normalized tags, toggled favorite state, searched note text, combined favorite/tag filters, and cleared all filters. Integration coverage separately exercises title, URL, description, notes, tags, intersections, punctuation, pagination, index rebuilds, and ownership. |
| Maintain library | Desktop and mobile journeys edited a bookmark, archived it, restored it, canceled deletion once, then confirmed permanent deletion. Repository/contract tests cover stale versions and atomic search/tag updates. |
| Account isolation | A real second browser account received the same `404 NOT_FOUND` response for another account's bookmark read, icon read, update, and delete. Repository isolation tests confirm the original owner record is unchanged. |
| Recovery | Known and unknown emails produced the same browser response. A disposable-account validation created two sessions, completed a reset from the memory-mail link, observed the session count fall from 2 to 0, confirmed the token was not reusable, and signed in with the new password. The disposable account was removed afterward. |

## Runtime and operational observations

- `GET /api/health` returned `{"status":"ok"}` against the prepared production server.
- The server listened on `0.0.0.0:4000` and served the sign-in screen through `127.0.0.1:4000`; the review-facing origin is `http://maker:4000`.
- `data-harness-ready="true"` was present on the resolved sign-in state and authenticated application shell, never on loading/error placeholders.
- The main review database contains the seeded review account and one intentional **Example Domain** bookmark demonstrating fetched title metadata. Browser test data is isolated in `/work/data/e2e.db`.
- SMTP delivery remains a deployment dependency: production operators must provide the documented SMTP environment values. Local validation used the non-production in-memory mail sink.

