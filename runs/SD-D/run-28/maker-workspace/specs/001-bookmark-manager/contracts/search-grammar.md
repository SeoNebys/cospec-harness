# Search Grammar Contract

Defines the advanced search language (FR-011, FR-012, FR-012a, FR-012b) and how it
compiles to storage queries. Case-insensitive throughout (FR-011).

## Grammar (EBNF-ish)

```
query      = orExpr ;
orExpr     = andExpr { OR andExpr } ;
andExpr    = notExpr { [AND] notExpr } ;   (* adjacency implies AND *)
notExpr    = [ NOT ] term ;
term       = "(" orExpr ")" | phrase | tagTerm | word ;
phrase     = '"' , { anyCharExceptQuote } , '"' ;
tagTerm    = "#" , tagChars ;
word       = wordChars ;
OR         = "OR" (case-insensitive, unquoted) ;
AND        = "AND" (case-insensitive, unquoted) ;
NOT        = "NOT" (case-insensitive, unquoted) ;
```

## Rules

1. **Operators only when unquoted** (FR-012a): the bare words `and`, `or`, `not`
   (any case) are operators. Inside a quoted phrase they are literal words —
   `"rock and roll"` searches the phrase, not `rock AND roll`.
2. **Implicit AND**: two adjacent terms with no operator combine with AND —
   `budget report` ≡ `budget AND report`.
3. **Precedence**: `NOT` binds tightest, then `AND` (incl. implicit), then `OR`.
   Parentheses override precedence.
4. **`#tag` terms** (FR-012b): restrict to bookmarks carrying that tag; combine
   with text terms and operators freely — `#work AND report`,
   `#work AND (report OR summary) NOT draft`.
5. **Text scope** (FR-011): non-tag text leaves match against title, address,
   description, and note.
6. **Malformed queries** (FR-013): unbalanced quotes or parentheses, or a
   dangling operator, produce a clear validation error (surfaced as HTTP 400) —
   not silent/misleading results.

## Compilation

- Parser (`services/search/parser.ts`) → AST of nodes: `And`, `Or`, `Not`,
  `Text(term|phrase)`, `Tag(name)`.
- Compiler (`services/search/compile.ts`) → SQL:
  - `Text` → condition on `bookmark_fts MATCH ?` (phrase passed as a quoted FTS
    phrase; word as a prefix/term token). FTS5 tokenizer provides
    case-insensitivity.
  - `Tag` → `EXISTS (SELECT 1 FROM bookmark_tag bt JOIN tag t ON t.id=bt.tag_id
    WHERE bt.bookmark_id = b.id AND t.name = ?)` with `?` lowercased.
  - `And`/`Or` → `(a AND b)` / `(a OR b)`; `Not` → `NOT (a)`.
  - Scope filter (active/unread/archived/all) is ANDed in outside the parsed
    expression so archived items stay excluded from normal search (FR-009).

## Worked examples

| Query | Meaning |
|---|---|
| `budget report` | text matches `budget` AND `report` |
| `"quarterly report"` | exact phrase in text fields |
| `#work AND report` | tagged `work` AND text matches `report` |
| `#work AND ("q3 report" OR budget) NOT draft` | tagged `work`, phrase or `budget`, excluding `draft` |
| `"rock and roll"` | phrase containing the literal word `and` |
| `#recipes OR #cooking` | tagged `recipes` or `cooking` |
