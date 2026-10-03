# Contract: Search Query Language

Implements FR-013–017 / User Story 5. Case-insensitive throughout. Parsed by
`src/services/search/{tokenizer,parser,compile}.js`.

## Tokens

- **Phrase**: double-quoted text `"..."` → a literal substring, matched exactly
  (case-insensitively) including spaces. A quoted operator word (`"AND"`,
  `"OR"`, `"NOT"`) is a **literal term**, never an operator (FR-015).
- **Tag term**: `#name` → membership in tag `name` (FR-014).
- **Operators** (only when unquoted, case-insensitive): `AND`, `OR`, `NOT`,
  and parentheses `(` `)` (FR-016).
- **Word**: any other run of non-space characters → case-insensitive substring
  term over title, description, note, address (FR-013).

## Grammar (precedence: NOT > AND > OR; implicit AND)

```
expr    := orExpr
orExpr  := andExpr ( OR andExpr )*
andExpr := notExpr ( (AND)? notExpr )*     // adjacency = implicit AND
notExpr := NOT notExpr | atom
atom    := '(' expr ')' | phrase | tagTerm | word
```

- Adjacent terms with no operator are ANDed. In particular, ordinary text next to
  a `#tag` requires **both** to match (FR-014, e.g. `report #news`).
- `NOT x` excludes bookmarks matching `x`.

## Matching semantics

- **word / phrase** term matches a bookmark when the (lower-cased) text appears as
  a substring of any of: title, description, note (Markdown source), or address.
- **tag term** matches when the bookmark carries that tag (case-insensitive).
- Scope predicate (archived/unread) from the current view is ANDed with the whole
  expression by the caller — never part of the query text.

## Compilation

- Each leaf compiles to parameterised SQL: words/phrases →
  `(title LIKE ? OR description LIKE ? OR note_md LIKE ? OR url LIKE ?)` with the
  value wrapped `%term%` and `%`/`_`/`\` escaped (`ESCAPE '\'`), `COLLATE NOCASE`;
  tag terms → `EXISTS (… bookmark_tags JOIN tag …)`. `AND`/`OR`/`NOT`/grouping map
  to SQL `AND`/`OR`/`NOT`/parentheses. No user text is interpolated into SQL.

## Errors (FR-017)

- Unbalanced quotes → error `unbalanced-quote`.
- Unbalanced parentheses → error `unbalanced-paren`.
- Dangling operator (e.g. trailing `AND`) → error `syntax`.
- On any parse error the API returns 400 with a clear message; no results are
  returned.

## Worked examples (become parser unit tests)

| Query | Meaning |
|-------|---------|
| `open source` | title/desc/note/url contains "open" AND contains "source" |
| `"open source"` | contains the exact phrase "open source" |
| `#news AND "open source"` | tagged `news` AND contains phrase "open source" |
| `report #news` | contains "report" AND tagged `news` |
| `"AND"` | contains the literal word "and" (operator quoted → literal) |
| `(cats OR dogs) NOT archived-topic` | (contains cats OR dogs) AND not containing "archived-topic" |
| `#a #b` | tagged `a` AND tagged `b` |
| `foo AND` | error: syntax (dangling operator) |
| `"foo` | error: unbalanced-quote |
