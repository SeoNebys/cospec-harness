# Search Contract

## Surface

The collection accepts a query string up to 2,000 characters. Search applies to the current collection scope (active or archived), then combines with explicit read/favorite/tag filters and sorting.

## Grammar

```ebnf
query       = or_expression ;
or_expression  = and_expression, { OR, and_expression } ;
and_expression = unary_expression, { (AND | implicit_AND), unary_expression } ;
unary_expression = [ NOT ], primary ;
primary     = term | phrase | tag_condition | "(", or_expression, ")" ;
term        = unquoted_text ;
phrase      = '"', quoted_text, '"' ;
tag_condition = "tag:", (unquoted_tag | phrase) ;
AND         = case_insensitive_keyword("AND") ;
OR          = case_insensitive_keyword("OR") ;
NOT         = case_insensitive_keyword("NOT") ;
```

Whitespace between adjacent primaries is implicit `AND`. Operators inside a quoted phrase are text. Reserved operators used as literal standalone terms must be quoted.

## Precedence

Highest to lowest: primary/phrase/tag condition, unary `NOT`, `AND` (including implicit `AND`), `OR`. Parentheses override precedence.

Examples:

| Query | Canonical interpretation |
|---|---|
| `design systems` | `design AND systems` |
| `"design systems"` | exact phrase |
| `tag:research AND unread` | exact tag `research` and text `unread` |
| `(tag:work OR tag:research) AND NOT "weekly report"` | grouped tags excluding exact phrase |

## Semantics

- Plain terms and phrases search title, URL, description, personal note, and tags.
- `tag:value` is an exact normalized tag equality check, not a text prefix match.
- `NOT x` means all bookmarks in the current active/archive scope except those matching `x`.
- Text matching is case-insensitive and Unicode-aware. Exact phrases require adjacent tokens in order, not matching letter case.
- Filters are combined with the parsed expression using `AND`.
- Results have deterministic ordering with bookmark ID as the final tie-breaker.

## Valid result

The search response/view provides the original query, canonical interpreted query, result count, active filters/sort, and current page of bookmarks.

## Invalid result

Invalid syntax does not run a partial query. The user retains their input and receives a position-bearing error with a stable code:

- `UNTERMINATED_PHRASE`
- `UNMATCHED_PARENTHESIS`
- `MISSING_OPERAND`
- `EMPTY_TAG`
- `QUERY_TOO_LONG`
- `TOO_MANY_TOKENS`
- `NESTING_TOO_DEEP`

## Compilation safety

The parsed AST—not raw user input—is compiled. Text leaves are escaped as FTS literals and bound as parameters. Tag values are bound to relational equality predicates. Boolean nodes compile to set operations (`INTERSECT`, `UNION`, and universe `EXCEPT`).
