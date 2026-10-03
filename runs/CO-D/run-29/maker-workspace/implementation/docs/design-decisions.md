# Design decisions

## Application shape

- The product is a single-person browser application with no account or sign-in layer, matching the confirmed interface goal.
- A Node HTTP server owns persistence, metadata retrieval, URL cleanup, duplicate detection, and search. The browser owns presentation and live interaction.
- Bookmark data is stored atomically in a local JSON file. This keeps deployment self-contained for one person and preserves data across restarts without requiring an external service.

## Bookmark identity and retention

- Duplicate identity uses a canonical address that removes `www`, fragments, trailing slashes, and known tracking values while retaining other query values. This implements SCN-009's distinction between clutter and meaningful content selection.
- Page metadata is copied into the bookmark at save time. Later address edits do not replace title, description, icon, or preview (SCN-003), and later page failure cannot erase the record (SCN-015).
- If metadata retrieval fails, the bookmark is still committed before the user is asked to complete it (SCN-010).

## Search

- Search is evaluated server-side against persisted title, description, notes, and address. Tags match only through `#tag` atoms.
- Queries with no explicit Boolean operator use the approved compact rule: words are required and multiple tags are alternatives.
- Explicit expressions use `NOT`, then `AND`, then `OR` precedence, with parentheses overriding precedence. Quoted strings are exact phrase atoms and shield operator words.
- An incomplete parse is returned separately from a complete zero-match result (SCN-012).

## Notes and tags

- Notes retain lightweight heading, bullet, and bold markers. The browser renders them using DOM nodes rather than injecting HTML.
- Formatting buttons are primary; typed markers remain supported. The source and formatted note are shown side by side.
- Tags are unique case-insensitively. Existing collection spelling wins, preventing case variants from multiplying.

## Alternatives not selected

- Accounts and multi-user sharing were excluded by the confirmed goal.
- Waiting for metadata before persisting a bookmark was rejected because it risks losing the link.
- Re-fetching metadata after an address correction was rejected because it could overwrite curated details.
- Always-expanded long rows and notes-only-in-edit mode were rejected in favor of compact rows and side-by-side note reading.
- Full readable page archiving is recorded for a later cycle and intentionally absent here.
