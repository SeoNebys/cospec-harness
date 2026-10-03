# Cycle 1 design decisions

## Application structure

- Use one small Node.js HTTP service with no runtime package dependencies. It serves the browser application, fetches page details, validates writes, and persists a JSON document atomically.
- Keep production code under `implementation/` and do not import or reuse Phase 1 prototype code.
- Use a browser-rendered single-page interface so live search, filters, counts, and inline editing update without page reloads.

## Persistence and data ownership

- Store bookmarks in `implementation/data/bookmarks.json` by default; `KEEPWELL_DATA_FILE` can redirect storage for tests or deployment.
- Persist title, description, URL, domain, personal note, tags, read-later state, and timestamps independently of the source website.
- Use atomic temporary-file replacement and serialize writes to avoid partial JSON or overlapping-update corruption.

## Page-detail retrieval

- Accept only complete HTTP or HTTPS addresses.
- Normalize addresses for duplicate detection while preserving their meaningful path and query.
- Fetch metadata on the server, preferring Open Graph or standard metadata and using safe readable fallbacks.
- Block local/private destinations by default to prevent a pasted link from using the app to probe the host network. Tests may explicitly allow a private mock website.
- If retrieval fails, return a recoverable state that retains the address and accepts a required manual title plus optional description.

## Interaction and validation

- Treat the entire bookmark card as the original-page link, while nested controls stop card navigation.
- Keep title/description, note, and tag interactions separate and inline.
- Require non-empty titles on both manual creation and correction; descriptions remain optional.
- Canonicalize tags case-insensitively, reuse their established display spelling, and make new-tag creation explicit.
- Filter search in the browser across title, description, and note for immediate results and note-match explanations.
- Read-later is a flag, not a move or deletion; completing an item only clears the flag.
- Compact unusually long text until expanded, while leaving all tags visible and wrapping.

## Alternatives not selected

- No database or framework dependency: unnecessary for the approved single-person scope and would increase setup surface.
- No user accounts: explicitly outside the current goal.
- No stored-address editing: recorded for a later cycle.
- No automatic deletion or rewriting when a source website changes or fails.
