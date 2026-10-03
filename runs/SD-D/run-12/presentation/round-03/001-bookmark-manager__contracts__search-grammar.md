# Search Language Contract

## Grammar

```ebnf
query       = or_expr, EOF ;
or_expr     = and_expr, { OR, and_expr } ;
and_expr    = unary_expr, { (AND | implicit_and), unary_expr } ;
unary_expr  = { NOT }, primary ;
primary     = term | phrase | tag | "(", or_expr, ")" ;
tag         = "#", (tag_word | quoted_text) ;
term        = bare_word ;
phrase      = quoted_text ;
```

`AND`, `OR`, and `NOT` are recognized case-insensitively only when an entire unquoted token equals the operator. Adjacent expressions imply `AND`.

Precedence, highest first:

1. Parentheses
2. Unary `NOT` (right associative)
3. Explicit or implicit `AND` (left associative)
4. `OR` (left associative)

For example, `a OR b AND NOT c` means `a OR (b AND (NOT c))`, and `foo NOT bar` means `foo AND NOT bar`.

## Lexical rules

- Whitespace outside quotes is insignificant.
- A bare term consumes non-whitespace characters except `(`, `)`, and `"`; leading `#` is reserved.
- Quoted text uses `"..."`, with `\"` for a literal quote and `\\` for a literal backslash.
- Unquoted tags run from `#` to whitespace or a reserved delimiter.
- A tag containing spaces can be written as `#"machine learning"`.
- Empty phrases, bare `#`, `#""`, empty groups, missing operands, and unbalanced quotes/parentheses are invalid.
- An empty or whitespace-only query is valid and matches every bookmark.

## Matching semantics

- All query leaves use the shared NFKC plus Unicode-lowercase normalization.
- Ordinary terms use substring matching within any one title, URL, description, notes field, or individual tag.
- Quoted phrases use contiguous substring matching in one field or one tag; they never cross field/tag boundaries.
- Hashtags use exact normalized tag identity and never match other fields.
- Tag identity additionally trims and collapses whitespace.
- Accent folding is not applied; `cafe` and `café` may differ.
- Active tag, favorite, and unread filters are conjoined with the complete query result.
- Results are ordered by `created_at DESC, id DESC`.

## Examples

```text
recipes vegan
#recipes AND "olive oil"
NOT #archived
python OR rust AND web
(python OR rust) AND NOT "beginner guide"
#"machine learning" NOT video
```

## Errors and limits

A syntax error returns no replacement result set, preserves the exact source query, and reports a zero-based start/end span with an actionable message. Examples include:

- `Missing closing quote starting at character N`
- `Missing “)” for group starting at character N`
- `Unexpected “)” at character N`
- `Expected a search term after AND/OR`
- `Add a tag name after “#”`
- `Add a search expression inside the parentheses`

Limits are 1,000 characters, 128 leaf expressions, and 64 nesting levels. Exceeding a limit is a validation error, not a server failure.

## Compilation safety

The parser emits a complete typed AST or one typed error. AST nodes retain source spans. Every leaf compiles to bound SQLite parameters; query text is never interpolated into SQL. `%`, `_`, and the selected escape character are escaped before substring matching.
