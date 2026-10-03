# Search Grammar Contract

Defines the search query language (FR-009–FR-012, FR-010a/b; US4). The parser
turns a query string into an AST; the evaluator matches it case-insensitively
against each bookmark's **title, URL, description, note, and tags**.

## Tokens

- **word** — an unquoted run of non-space characters that is not an operator or a
  `#tag`. Matches as a case-insensitive substring across all searchable fields.
- **phrase** — text in double quotes `"..."`. Matches the exact (case-insensitive)
  substring, spaces included. A quoted operator word (e.g. `"AND"`) is a phrase,
  i.e. literal text, NOT an operator (FR-010b).
- **tag term** — `#name`. Matches only bookmarks carrying tag `name`.
- **operators** — bare `AND`, `OR`, `NOT` (uppercase), and parentheses `(` `)`.

## Grammar (EBNF)

```
query      = or_expr ;
or_expr    = and_expr { "OR" and_expr } ;
and_expr   = unary { [ "AND" ] unary } ;   (* adjacency = implicit AND *)
unary      = [ "NOT" ] primary ;
primary    = word | phrase | tag_term | "(" or_expr ")" ;
```

## Semantics

- **Implicit AND**: adjacent terms with no operator between them must all match
  (FR-010a). `python #news` ≡ `python AND #news`.
- **Explicit OR** is the only way to relax adjacency to disjunction:
  `python OR rust` matches either.
- **Precedence**: `NOT` binds tightest, then implicit/explicit `AND`, then `OR`.
  Parentheses override grouping.
- **Case-insensitivity**: all field matching ignores letter case (FR-009).
  Operator keywords are recognized only in uppercase and only when unquoted.
- **Fields searched**: title, URL, description, note, tags (word/phrase);
  `#tag` targets tags only.

## Errors (FR-011)

Malformed queries return a clear error and no results, including:
- unbalanced quotes,
- unbalanced parentheses,
- a dangling operator (`python AND`, `OR rust`, trailing `NOT`),
- empty parentheses `()`.

## Worked examples (map to US4 acceptance scenarios)

| Query | Meaning |
|-------|---------|
| `Python` | substring `python` in any field, any case |
| `#news` | tagged `news` |
| `"machine learning"` | exact phrase, not the words separately |
| `python #news` | word `python` AND tag `news` (implicit AND) |
| `python OR rust` | either term |
| `"AND"` | literal text "AND" (operator quoted) |
| `#news AND (python OR rust) NOT archived-topic` | boolean logic honoring grouping |
| `#news (python` | error: unbalanced parenthesis |
