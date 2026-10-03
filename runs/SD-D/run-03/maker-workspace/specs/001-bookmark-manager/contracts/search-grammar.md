# Search Grammar Contract

**Version**: 1  
**Applies to**: Bookmark search text and saved-view query text

## Grammar

```ebnf
query       ::= whitespace? or_expr? whitespace?
or_expr     ::= and_expr (whitespace OR whitespace and_expr)*
and_expr    ::= atom ((whitespace AND whitespace | whitespace) atom)*
atom        ::= word | phrase | exact_tag
phrase      ::= '"' quoted_text '"'
exact_tag   ::= '#' word | '#"' quoted_text '"'
OR          ::= case-insensitive bare word "OR"
AND         ::= case-insensitive bare word "AND"
```

Parentheses and negation are not part of version 1.

## Token Rules

- Whitespace separates bare tokens.
- Bare `AND` and `OR`, in any letter case, are operators.
- To search for the literal words `AND` or `OR`, quote them.
- Adjacent atoms imply `AND`.
- `AND` binds more tightly than `OR`.
- Quoted text supports `\"` for a quote and `\\` for a backslash.
- A phrase requires at least one non-whitespace character.
- `#tag` matches one complete normalized tag name, not a partial tag.
- A multiword tag uses `#"machine learning"`.
- Ordinary words and phrases use case-insensitive substring matching across title, address, description, visible note text, and each tag name.
- A quoted phrase must occur contiguously within one searchable field or one tag name; it never spans fields or separate tags.
- Empty input applies no search constraint.

## Precedence Examples

| Input | Meaning |
|---|---|
| `alpha beta` | `alpha AND beta` |
| `alpha OR beta gamma` | `alpha OR (beta AND gamma)` |
| `alpha AND beta OR gamma` | `(alpha AND beta) OR gamma` |
| `"alpha beta" #news` | exact phrase AND exact tag |
| `#news OR #"machine learning"` | either exact tag |
| `"AND" OR "OR"` | literal words, not operators |

Each atom may match a different field on the same bookmark for an `AND` expression. For example, a title containing `alpha` and a note containing `beta` satisfies `alpha beta`.

## Invalid Input

The parser returns a stable error code, zero-based start/end offsets, and a short recovery hint. It never returns partial results for invalid input.

| Error code | Example | Required hint |
|---|---|---|
| `UNMATCHED_QUOTE` | `"alpha` | Close the quoted phrase |
| `EMPTY_PHRASE` | `""` | Add text inside the quotes |
| `EMPTY_TAG` | `#` or `#""` | Add a tag name after `#` |
| `MISSING_LEFT_OPERAND` | `OR alpha` | Add a search term before the operator |
| `MISSING_RIGHT_OPERAND` | `alpha AND` | Add a search term after the operator |
| `DOUBLE_OPERATOR` | `alpha AND OR beta` | Remove one operator or add a term between them |
| `UNSUPPORTED_GROUPING` | `(alpha OR beta)` | Remove parentheses; `AND` already binds before `OR` |
| `UNSUPPORTED_NEGATION` | `NOT alpha` or `-alpha` | Negation is not supported |
| `INVALID_ESCAPE` | quoted trailing backslash | Escape only a quote or backslash |

## Parser Output

The shared parser returns either:

```text
Empty
Text(value, range)
Phrase(value, range)
Tag(normalizedValue, displayValue, range)
And(left, right, range)
Or(left, right, range)
```

or one validation error from the table above. The AST is immutable. The server is authoritative even when the client uses the same parser for immediate feedback.

## Evaluation Contract

1. Normalize the query atom using the same Unicode and case normalization used for stored search values.
2. Convert each ordinary word or phrase into a bookmark-ID set matching any searchable field or individual tag.
3. Convert each exact-tag atom into the bookmark IDs related to that exact normalized tag key.
4. Compose `AND` as set intersection and `OR` as set union according to the AST.
5. Apply active/Read Later/archived scope, selected-tag filters, favorite/read filters, and sort order after the search expression.
6. Selected tag filters are always combined with `AND`; all selected tags are required.
7. Bind all database values. Raw query text and raw atom text are never concatenated into SQL or forwarded as SQLite FTS syntax.

## Compatibility

Saved views record `grammar_version = 1`. A future incompatible grammar requires an explicit saved-view migration or a recoverable view-specific validation message; it must not silently reinterpret stored queries.
