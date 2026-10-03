# Search Grammar Contract

**Version**: 1.0  
**Applies to**: `GET /api/bookmarks?q=...`

## Searchable fields

An ordinary term or phrase searches these fields independently and matches if any one field contains it:

- bookmark title
- saved URL
- retrieved or edited description
- readable note text
- display tag labels

Phrase tokens must occur contiguously and in order within one field; a phrase never spans fields. Search is case-insensitive and uses Unicode tokenization with diacritic removal.

## Lexical forms

| Form | Meaning | Example |
|---|---|---|
| `word` | Searchable text term | `design` |
| `"words together"` | Exact token phrase | `"design systems"` |
| `#tag` | Exact normalized tag label | `#research` |
| `#"tag with spaces"` | Exact normalized multi-word tag label | `#"product design"` |
| `AND` | Both sides must match | `design AND systems` |
| `OR` | Either side may match | `article OR video` |
| `NOT` | Following expression must not match | `design AND NOT archived` |
| `( ... )` | Explicit grouping | `(design OR ux) AND #research` |

Operators are recognized case-insensitively when unquoted and delimited as complete tokens. `"AND"`, `"or"`, and `#"not"` are text/tag values, not operators.

Backslash escapes `"` and `\` inside quoted values. Other backslash sequences are invalid so the user receives a correction rather than a surprising interpretation.

## Grammar

```ebnf
query       = or_expr , EOF ;
or_expr     = and_expr , { OR , and_expr } ;
and_expr    = unary_expr , { [ AND ] , unary_expr } ;
unary_expr  = { NOT } , primary ;
primary     = term | phrase | tag | "(" , or_expr , ")" ;
term        = unquoted_text ;
phrase      = quoted_text ;
tag         = "#" , ( unquoted_tag | quoted_text ) ;
```

The optional `AND` means adjacent expressions use implicit AND: `design #research` is identical to `design AND #research`.

## Precedence and associativity

From strongest to weakest:

1. Parentheses
2. Unary `NOT`
3. Explicit or implicit `AND`
4. `OR`

Repeated binary operators associate left-to-right. Multiple `NOT` operators are allowed and applied from right-to-left, so `NOT NOT design` is equivalent to `design`.

## Normalization

- Trim whitespace outside quoted values.
- Preserve the original query string for display and error correction.
- Normalize exact tag values using the same whitespace, Unicode, and case-folding rules as saved tags.
- Empty or whitespace-only input means no text-query restriction.
- Punctuation inside an unquoted term is tokenized by the same Unicode rules as indexed text. A bare `#` is invalid.

## Evaluation examples

| Query | Required result behavior |
|---|---|
| `design systems` | Matches `design AND systems` |
| `"design systems"` | Matches the contiguous phrase in one searchable field |
| `#research` | Matches the exact normalized tag `research`, not `research-tools` |
| `design OR ux AND #research` | Matches `design OR (ux AND #research)` |
| `(design OR ux) AND #research` | Requires the tag and either text term |
| `design AND NOT "design debt"` | Includes `design`, excludes the phrase |
| `NOT #finished` | Searches the current outer view/filter universe for bookmarks without that tag |

The parsed query is additionally intersected with the requested library view, explicit `tag` query parameters, and other filters. Sorting and pagination occur only after filtering.

## Errors

Invalid syntax returns HTTP `422` with error code `INVALID_SEARCH_QUERY` and:

- the unchanged original query;
- zero-based `offset` and positive `length` identifying the smallest useful error range;
- a concise explanation;
- a short expected-token list when useful.

Examples of invalid input include an unterminated quote, empty parentheses, a missing right operand, a bare `#`, an unmatched parenthesis, and unsupported escape syntax. The client keeps the query in the search field, focuses or highlights the failing range when possible, and exposes a link/button to the static search help.

## Safety and limits

- Maximum query length: 500 characters.
- Maximum parsed tokens: 100.
- Maximum nesting depth: 10.
- Text and tags are bound as parameters; they are never concatenated into SQL identifiers or raw FTS syntax.
- The compiler produces row-ID set expressions with an outer lifecycle/filter boundary so unary `NOT` cannot escape the requested view.
