# Search Language Contract

## Goals

The language must be predictable for everyday use, preserve the approved precedence, support helpful inline errors, and never expose database query syntax.

## Grammar

```ebnf
query       = ws, [or_expr], ws, EOF ;
or_expr     = and_expr, {ws1, "OR", ws1, and_expr} ;
and_expr    = unary_expr, {ws1, unary_expr} ;
unary_expr  = ["NOT", ws1], primary ;
primary     = term | phrase | tag | "(", ws, or_expr, ws, ")" ;
term        = term_char, {term_char} ;
phrase      = '"', phrase_char, {phrase_char}, '"' ;
tag         = "#", tag_char, {tag_char} ;
ws          = {" " | "\t" | "\n"} ;
ws1         = (" " | "\t" | "\n"), ws ;
```

`term_char` excludes whitespace, double quote, `#`, and parentheses. `phrase_char` is any supported character except an unescaped double quote. `tag_char` excludes whitespace, double quote, `#`, and parentheses. Backslash escapes `\`, `"`, `(`, `)`, and `#` inside terms or phrases.

`OR` and `NOT` are operators only when uppercase and token-delimited. Lowercase `or` and `not` are ordinary search terms. `AND` is not a keyword; adjacency is the AND operator.

## Semantics

- Parentheses bind first, then unary NOT, then implicit AND, then OR.
- Operators and matching are case-insensitive, while the original query is retained for display.
- Plain terms match a case-insensitive substring in title, URL, description, notes, or tag name.
- Quoted phrases match a case-insensitive contiguous substring within any one searchable field. A match cannot cross field boundaries.
- `#tag-name` matches a complete normalized tag name, not a substring.
- `NOT` excludes the following primary expression. `NOT (a OR b)` is valid.
- A query containing only a negative expression is valid and begins from all records otherwise eligible under the active filters.
- An empty query is match-all; filters and archive scope still apply.
- Active UI filters are ANDed with the complete parsed query.

## Examples

| Query | Meaning |
|---|---|
| `cooking quick` | Contains both `cooking` and `quick` somewhere in searchable fields |
| `"weeknight dinner"` | Contains that contiguous phrase within one field |
| `#recipes` | Has the exact tag `recipes` |
| `cooking NOT #recipes` | Contains `cooking` and does not have tag `recipes` |
| `cooking (#vegan OR #quick)` | Contains `cooking` and has either exact tag |
| `NOT (#work OR "meeting notes")` | Matches eligible bookmarks containing neither grouped expression |
| `(rust OR go) NOT "job posting"` | Contains either language term and excludes the exact phrase |

## Limits

- Query length: 2,000 Unicode code points.
- Token count: 256.
- Parenthesis nesting depth: 16.
- Phrase/term/tag token length: 500 code points.

Crossing a limit returns a validation error rather than truncating the query.

## Error contract

Invalid queries return HTTP 422 with:

```json
{
  "error": {
    "code": "INVALID_SEARCH_QUERY",
    "message": "Closing parenthesis is missing.",
    "position": 18,
    "length": 1
  }
}
```

`position` is a zero-based Unicode code-point offset into the original query. Required stable categories are:

- `UNCLOSED_QUOTE`
- `UNMATCHED_OPEN_PAREN`
- `UNMATCHED_CLOSE_PAREN`
- `MISSING_OPERAND`
- `EMPTY_GROUP`
- `INVALID_ESCAPE`
- `QUERY_TOO_LONG`
- `TOO_MANY_TOKENS`
- `NESTING_TOO_DEEP`

The client highlights the reported region, preserves the user's input, explains the supported syntax, and does not run a reinterpreted fallback search.

## Conformance cases

Parser and API tests must prove:

1. `a b OR c` parses as `(a AND b) OR c`.
2. `a OR b c` parses as `a OR (b AND c)`.
3. `NOT a b` parses as `(NOT a) AND b`.
4. `NOT (a OR b)` excludes the grouped OR.
5. `"a b"` is one phrase token.
6. `#Work` matches a stored `work` tag.
7. SQL metacharacters remain ordinary token content or produce a syntax error; they never alter generated SQL structure.
8. Unmatched quotes/parentheses and dangling `OR`/`NOT` return positioned errors.

