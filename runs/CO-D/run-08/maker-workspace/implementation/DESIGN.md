# Link Home design record

## Decisions

- Store the single user's collection in one atomically replaced JSON document. This keeps deployment self-contained while ensuring an edit is fully applied or not applied at all.
- Fetch page metadata and a sanitized readable HTML copy on initial save. Failed enrichment never blocks the bookmark; capture can be retried explicitly.
- Preserve saved metadata indefinitely. The application does not monitor or silently refresh live pages.
- Normalize only known tracking parameters, fragments, and trailing slashes for duplicate identity. Meaningful query parameters remain distinct.
- Evaluate search locally for immediate feedback. The expression language supports words, exact quoted phrases, `#labels`, `AND`, `OR`, `NOT`, and parentheses.
- Keep the production implementation independent of all Phase 1 prototype files.

## Deferred

- Active monitoring of live pages for changes is intentionally outside cycle 1.
