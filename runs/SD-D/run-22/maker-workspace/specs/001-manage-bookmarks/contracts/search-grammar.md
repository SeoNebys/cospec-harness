# Search Query Contract

## Grammar

```ebnf
query       = whitespace?, clause, { whitespace+, clause }, whitespace? ;
clause      = text-term | phrase | tag-clause ;
tag-clause  = "tag:", ( tag-value | "(", tag-value,
              { whitespace?, "|", whitespace?, tag-value }, ")" ) ;
tag-value   = bare-tag | phrase ;
phrase      = '"', { quoted-char | escape }, '"' ;
escape      = '\\"' | '\\\\' ;
```

A bare term ends at whitespace or reserved punctuation. Backslash escapes a reserved character. Reserved operator names are case-insensitive.

## Semantics

- Separate clauses are combined with AND.
- A bare text term is a case-insensitive substring of any searchable field.
- A quoted phrase is a case-insensitive contiguous substring within one searchable field; it never spans fields.
- `tag:value` matches a complete normalized tag label only.
- Values inside one parenthesized tag clause use OR.
- Repeated normalized clauses and alternatives are ignored.
- Searchable fields are title, URL, description, personal notes, and tags.
- Text is normalized with Unicode NFKC and locale-independent case folding for comparison; original input remains available for display.

## Examples

| Query | Meaning |
|-------|---------|
| `Rome` | Contains Rome in any searchable field |
| `"ancient Rome"` | Contains that exact phrase within one field |
| `tag:book` | Has the tag book |
| `tag:"science fiction"` | Has the complete multi-word tag science fiction |
| `Rome tag:(article|book)` | Contains Rome and has either tag article or tag book |
| `"ancient Rome" tag:book history` | Contains the phrase, has tag book, and contains history |

## Parse Errors

Malformed input returns HTTP 400 with an error code, message, and zero-based character span. Stable codes are `UNCLOSED_QUOTE`, `EMPTY_TAG`, `EMPTY_GROUP`, `MISSING_ALTERNATIVE`, `UNEXPECTED_RPAREN`, `INVALID_ESCAPE`, `QUERY_TOO_LONG`, and `TOO_MANY_CLAUSES`. Input is never silently reinterpreted.

## AST Shape

```json
{
  "type": "and",
  "clauses": [
    { "type": "text", "value": "Rome", "exact": false },
    { "type": "tagAny", "values": ["article", "book"] }
  ]
}
```

The server is authoritative. A shared client parser may provide immediate feedback, but the server parses again and compiles only validated AST nodes to parameterized database predicates. General Boolean operators and precedence are intentionally outside v1.
