# Search Language Contract

```ebnf
query      := or_expr EOF
or_expr    := and_expr (OR and_expr)*
and_expr   := unary_expr ((AND)? unary_expr)*
unary_expr := "-" unary_expr | primary
primary    := "(" or_expr ")" | "tag:" value | "is:" status | phrase | word
value      := word | phrase
status     := "read" | "unread" | "active" | "archived"
phrase     := '"' (escaped_quote | escaped_backslash | non_quote)+ '"'
```

- Operators and fields are case-insensitive.
- Precedence is exclusion, AND, OR; adjacent operands imply AND.
- `tag:` is an exact case-insensitive match; multiword values are quoted.
- Phrases match contiguous text in any searchable field.
- `-` negates the next term, predicate, or group within the selected archive scope.
- UI state filters compile to the same predicates.
- Unknown fields/statuses, missing values, empty groups, dangling operators, and unmatched delimiters are errors.
- Errors return `code`, `start`, `end`, `offendingText`, and `suggestion`; the source query is retained.

Example: `(tag:research OR tag:"read later") "vector database" -obsolete is:unread`.
