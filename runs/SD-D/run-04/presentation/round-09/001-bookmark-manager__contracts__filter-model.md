# Contract: Filter Model

Defines how a search/filter is expressed and evaluated. Shared by the list endpoint
(`rest-api.md`) and by saved searches. This is the single source of truth for the
boolean tag semantics in FR-009/FR-010/FR-011.

## Filter shape

```jsonc
{
  "text": "budget spreadsheet",   // free text; wrap a substring in double quotes for exact phrase (FR-010)
  "tagsAny": ["recipes", "dinner"], // match if bookmark has AT LEAST ONE of these (FR-011 "any of")
  "tagsAll": ["work"],              // match only if bookmark has EVERY one of these (FR-011 "all of")
  "tagsNot": ["dessert"],           // exclude bookmarks carrying ANY of these (FR-011 "excluding")
  "view":    "all",                 // "all" | "readLater" | "archived"
  "sort":    "newest"               // "newest" (default) | "oldest" | "title" (FR-014)
}
```

All fields optional. Empty/absent `text` and empty tag arrays mean "no constraint
from that dimension." An empty filter in the `all` view returns the whole
non-archived collection ordered by `sort`.

## Evaluation semantics

A bookmark matches when **all** of the following hold (dimensions combine with AND;
tags within `tagsAny` combine with OR):

1. **View scope**:
   - `all` → `archived = false`
   - `readLater` → `archived = false AND read_later = true`
   - `archived` → `archived = true`
2. **Text** (case-insensitive, FR-009): if `text` is non-empty, the bookmark matches
   the FTS query built from it over title/url/description/notes/tags.
   - Bare words → all words must match (AND).
   - A `"quoted phrase"` → that exact contiguous phrase must match (FR-010).
   - Mixed (words + a quoted phrase) → all parts must match.
3. **tagsAny** (FR-011 "any of"): if non-empty, the bookmark carries ≥ 1 of these tags.
4. **tagsAll** (FR-011 "all of"): if non-empty, the bookmark carries every one of these.
5. **tagsNot** (FR-011 "excluding"): the bookmark carries none of these tags.

**Worked example** — the client's case "*recipes* or *dinner*, but not *dessert*":

```json
{ "tagsAny": ["recipes", "dinner"], "tagsNot": ["dessert"], "view": "all" }
```

→ returns non-archived bookmarks tagged `recipes` OR `dinner`, minus any also
tagged `dessert`. (Story 2, scenario 7.)

## Notes

- Tag names are matched case-insensitively (stored lowercased).
- "Select all showing" (FR-020) resolves against **the current filter's result set**
  — it never includes items outside the active view (so archived/hidden items are
  never swept). See `rest-api.md` batch section.
- No-result filters return an empty array (the UI renders the per-view no-results
  state, FR-024); a saved search that now matches nothing behaves identically and is
  itself unaffected (edge case "saved search returns nothing later").
