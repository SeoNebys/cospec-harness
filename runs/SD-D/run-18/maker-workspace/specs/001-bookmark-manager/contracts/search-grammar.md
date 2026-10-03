# Search Language Contract

**Version**: 1  
**Applies to**: main library, unread view, archive, and saved views

## Grammar

```ebnf
query        = [ expression ] ;
expression   = or-expression ;
or-expression
             = and-expression, { "OR", and-expression } ;
and-expression
             = unary-expression,
               { ( "AND" | implicit-adjacency ), unary-expression } ;
unary-expression
             = { "NOT" | "-" }, primary ;
primary      = word | quoted-phrase | tag | "(", expression, ")" ;
tag          = "#", tag-token ;
```

`tag-token` contains one or more non-whitespace characters excluding parentheses. Tags containing spaces are selected with the separate tag-filter control.

## Semantics

- An empty query returns every bookmark in the current view's universe.
- Precedence from strongest to weakest is parentheses, unary exclusion, AND/implicit adjacency, OR.
- `alpha beta` is equivalent to `alpha AND beta`.
- Operator words are recognized only as exact uppercase `AND`, `OR`, and `NOT`. Lowercase `and`, `or`, and `not` are searchable words.
- A minus is unary exclusion only at an atom boundary. `state-of-the-art` is one word; `state -draft` excludes `draft`.
- Quoted operator names, `#`, minus signs, and parentheses are literal phrase content.
- A quoted phrase matches the same consecutive token sequence in one field. It does not span two fields or two tags, and punctuation/diacritics follow the index tokenizer rather than byte-for-byte comparison.
- Text words/phrases search title, address, description, rich-note text, and tag names case-insensitively.
- `#tag` matches one canonical tag exactly and case-insensitively.
- Independent selected tag chips all must match and are ANDed with the complete query.
- Main and saved-view searches use active bookmarks; unread adds active-and-unread scope; archive uses only archived bookmarks.

## Examples

| Query | Meaning |
|---|---|
| `climate policy` | Contains both words anywhere in indexed fields/tags |
| `"climate policy"` | Contains that token sequence within one field |
| `#research` | Has the exact `research` tag |
| `climate OR energy` | Contains either term |
| `climate NOT draft` | Contains `climate` and excludes `draft` |
| `-#finished` | Does not have the exact `finished` tag |
| `(climate OR energy) #research` | Matches either term and has `research` |
| `"OR"` | Contains the literal word `OR` |

## Validation Limits

- UTF-8 query length: 2,048 bytes
- Maximum atoms: 64
- Maximum parenthesis nesting: 16
- Empty group: invalid
- Bare `#`: invalid
- Unmatched quote or parenthesis: invalid
- Leading/dangling binary operator: invalid
- Missing operand after unary operator: invalid

## Error Contract

Invalid input returns HTTP 400 with:

```json
{
  "error": {
    "code": "invalid_search",
    "message": "Expected a search term after OR.",
    "offset": 14,
    "length": 2,
    "hint": "Add a term after OR or remove the operator."
  }
}
```

The original query remains in the UI. The server never silently changes invalid syntax into another query.

## Compilation Contract

- Parsing produces an internal AST; API consumers never supply an AST or SQL.
- Each text atom is bound as a safely quoted FTS value.
- Each tag atom is bound to a canonical relational lookup.
- AST combinations use parameterized bookmark-ID set operations.
- Scope and independent tag chips constrain the universe before unary exclusion.
- Stable sorting always adds bookmark ID as the final tie-breaker.
