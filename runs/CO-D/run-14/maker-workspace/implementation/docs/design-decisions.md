# Design decisions

- **Zero-dependency Node service.** The application uses Node's HTTP, crypto, fetch, and filesystem APIs. This keeps installation deterministic while still providing persistent server-side behavior.
- **Atomic JSON persistence.** A single-person library does not need a database server. Writes use a temporary file followed by rename so interrupted writes do not leave partial JSON.
- **Server-side sessions.** A signed, HTTP-only, SameSite cookie gates all bookmark APIs. Password comparison uses `scrypt` and timing-safe comparison. Sign-in errors never disclose which credential failed.
- **Tracking-aware identity.** URL identity drops fragments, one trailing slash, default ports, and only recognized marketing/referral parameters. Unknown query parameters remain meaningful.
- **Server-side page capture.** Page details and readable content are fetched on the server with time and size limits. The captured archive stores extracted text and provenance rather than executable page code.
- **Persistent retry state.** Unreachable saves have an explicit `pending` capture state. The server retries every minute and fills only missing machine-discovered fields; client-edited fields are protected.
- **Parsed search expressions.** A small recursive-descent parser supports broad terms, exact quoted phrases, exact `tag:name` terms, AND/OR/NOT, implicit AND, and parentheses. Invalid expressions never reach result evaluation.
- **Accessible browser-native controls.** Dialogs, links, forms, labels, live regions, and explicit action text carry the interactions. Original pages use `target="_blank"` with `noopener` to preserve library position.
- **Prototype isolation.** Production files were created independently in `implementation/` from the approved scenario specifications. No Phase 1 prototype source is imported or reused.

## Dropped alternatives

- Email-link sign-in was dropped in favor of approved email/password entry.
- Permanently expanded tag trays were dropped in favor of typeahead suggestions.
- Immediate deletion with timed undo was dropped in favor of confirmation before deletion.
- Same-tab original-page navigation was dropped because it loses library position.
- A live-page mirror was dropped in favor of a safer readable archive without original scripts.
