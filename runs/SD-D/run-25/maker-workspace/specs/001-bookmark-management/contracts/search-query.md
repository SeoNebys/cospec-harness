# Search Query Contract

## Purpose

This contract defines the search language promised by FR-019 through FR-022. The application parses this language itself; it never passes raw input directly to SQLite FTS5.

## Grammar

```ebnf
query        = or-expression ;
or-expression
             = and-expression, { OR, and-expression } ;
and-expression
             = unary-expression,
               { (AND | implicit-and), unary-expression } ;
unary-expression
             = [ NOT ], primary ;
primary      = term | phrase | tag | "(", or-expression, ")" ;
tag          = TAG_PREFIX, (term | phrase) ;
term         = unquoted-token ;
phrase       = '"', { phrase-character | escape }, '"' ;
escape       = "\\\"" | "\\\\" ;
TAG_PREFIX   = case-insensitive "tag:" ;
AND          = case-insensitive standalone "AND" ;
OR           = case-insensitive standalone "OR" ;
NOT          = case-insensitive standalone "NOT" ;
implicit-and = whitespace between adjacent operands ;
```

Operators are commands only when they are standalone, unquoted tokens. `tag:` accepts exactly one unquoted term or one quoted phrase; `tag:(a OR b)` is invalid.

## Semantics

- Evaluation precedence is `NOT`, then explicit or implicit `AND`, then `OR`.
- Parentheses override precedence.
- Ordinary terms match case-insensitively against title, address, page description, personal-note plain text, and tag names.
- Adjacent ordinary terms imply `AND`: `design systems` equals `design AND systems`.
- Quoted phrases require the same normalized words in order within one searchable field. A match never crosses from the end of one field into another.
- `tag:research` is an exact normalized tag-name match, not a substring match.
- Multi-word tags use quotes: `tag:"machine learning"`.
- `NOT` is unary exclusion from the current authenticated user's selected view. `NOT tag:work` is valid by itself.
- View, tag-filter, reading-state filter, and ownership constraints are applied outside the expression and cannot be widened by `OR` or `NOT`.
- Search does not imply relevance ordering. Results retain the selected `newest`, `oldest`, or `title` order with bookmark ID as a deterministic tie-breaker.

## Examples

| Query | Meaning |
|---|---|
| `accessibility` | Contains the term in any searchable field |
| `design systems` | Contains both `design` and `systems` |
| `"design systems"` | Contains the exact phrase within one field |
| `tag:research` | Has the tag named `research` |
| `tag:"machine learning"` | Has the multi-word tag `machine learning` |
| `react AND accessibility` | Contains both terms |
| `react OR vue` | Contains either term |
| `react NOT deprecated` | Contains `react` and excludes `deprecated` |
| `NOT tag:work` | Does not have the `work` tag |
| `(react OR vue) AND tag:frontend` | Matches either text term and has the tag |
| `"AND" OR tag:logic` | Contains the literal word `AND`, or has the tag |

## Normalization

- Search is Unicode-normalized and case-folded consistently with indexed content.
- Whitespace outside quotes separates tokens; repeated whitespace has no additional meaning.
- Within a phrase, repeated whitespace is normalized for matching.
- `\"` represents a literal quote and `\\` a literal backslash inside a phrase.
- Markdown punctuation is not indexed; the readable plain-text projection is indexed.
- URLs remain searchable as normalized textual content. The parser safely quotes engine-special characters rather than interpreting them as FTS commands.

## Limits

- Maximum input length: 1,000 Unicode characters.
- Maximum parsed tokens: 100.
- Maximum parenthesis/NOT nesting depth: 10.
- Empty or whitespace-only input means no search expression and returns the current filtered view.

Exceeding a limit is a correctable query error; the original input remains visible.

## Error Contract

Invalid input returns HTTP 422 using the problem response in `openapi.yaml`, with:

- `title`: short user-readable category such as `Search query is incomplete`.
- `detail`: plain-language explanation that does not expose SQL or FTS internals.
- `queryOffset`: zero-based character position nearest the problem.
- `queryHint`: one concise correction example.

Errors include:

| Input problem | Example message |
|---|---|
| Unterminated phrase | `Close the phrase with a quotation mark.` |
| Dangling operator | `Add a search term after AND.` |
| Missing operand before operator | `Add a search term before OR.` |
| Empty group | `Add a search term inside the parentheses.` |
| Unmatched close parenthesis | `Remove this parenthesis or add its matching opening parenthesis.` |
| Missing close parenthesis | `Close the group with a parenthesis.` |
| Empty tag value | `Add a tag name after tag:.` |
| Unsupported tag group | `Use one tag name, such as tag:research or tag:"machine learning".` |
| Limit exceeded | State the relevant character, token, or nesting limit |

## Parser and Compiler Acceptance Set

Tests must cover:

- Precedence and parentheses for every pair of operators.
- Explicit and implicit `AND` equivalence.
- Unary and nested `NOT`, including a pure-negative query.
- Operators inside phrases remaining literal.
- Quoted and unquoted tag values, Unicode/case normalization, and tag names equal to operator words.
- Escaped quotes/backslashes and punctuation-heavy URLs.
- Every error class with exact offset behavior.
- Character, token, and depth boundaries at and beyond their limits.
- Attempts to inject SQL or FTS syntax producing text matches or validation errors, never executable query structure.
- Owner, active/unread/archive, and filter constraints remaining effective around `OR` and `NOT` expressions.
