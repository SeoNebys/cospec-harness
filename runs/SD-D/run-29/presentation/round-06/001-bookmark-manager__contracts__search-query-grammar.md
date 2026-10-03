# Contract: Search Query Grammar

Defines the search language for `q` (FR-012–FR-015, US2). Matching is
case-insensitive. The parser is a small tokenizer + recursive-descent parser that
produces a boolean AST; the evaluator matches against a bookmark's title,
description, notes (plain text of `notes_html`), address, and tags.

## Tokens

| Token | Form | Meaning |
|-------|------|---------|
| PHRASE | `"..."` | Exact, literal substring match (spaces preserved). Operator words inside quotes are literal, not operators (FR-015). |
| TAG | `#name` | Matches bookmarks carrying tag `name` (FR-014). |
| WORD | bare token | Case-insensitive substring match across title/description/notes/address (FR-012). |
| AND / OR / NOT | those words (any case), **unquoted** | Boolean operators (FR-015). |
| LPAREN / RPAREN | `(` `)` | Grouping. |

## Grammar (EBNF)

```ebnf
query      = expr? ;
expr       = or_expr ;
or_expr    = and_expr { "OR" and_expr } ;
and_expr   = not_expr { ("AND" | (* implicit *) ) not_expr } ;
not_expr   = "NOT" not_expr | primary ;
primary    = "(" expr ")" | term ;
term       = PHRASE | TAG | WORD ;
```

- **Implicit AND**: two adjacent terms with no operator between them are combined
  with `AND` (e.g., `climate news` ≡ `climate AND news`).
- **Precedence** (highest → lowest): `NOT`, `AND` (incl. implicit), `OR`.
  Parentheses override precedence.

## Semantics

- **WORD** `w` → true if the lowercased `w` is a substring of any of
  {title, description, notes-text, address} (lowercased).
- **PHRASE** `"p"` → same fields, but `p` matched exactly as written (including
  internal spaces and any `AND`/`OR`/`NOT` treated as literal text).
- **TAG** `#t` → true if the bookmark has a tag equal to `t` (case-insensitive).
- **AND/OR/NOT** → standard boolean combination of child results.
- **Empty query** → matches all (non-archived) bookmarks.
- Archived bookmarks are excluded from normal search regardless of query (FR-026);
  the archive view searches only archived items.

## Worked examples

| Query | Interpretation |
|-------|----------------|
| `climate` | address/title/description/notes contains "climate". |
| `climate news` | contains "climate" AND contains "news". |
| `"machine learning"` | contains the exact phrase "machine learning". |
| `#news` | tagged `news`. |
| `(#news OR #blog) AND climate NOT opinion` | (tagged news OR tagged blog) AND contains "climate" AND NOT contains "opinion". |
| `"and"` | contains the literal word "and" (quotes → literal, not operator, FR-015). |
| `rust "or die"` | contains "rust" AND contains the literal phrase "or die". |

## Error / edge handling

- **Unbalanced parentheses / trailing operator** (e.g., `a AND`): best-effort
  parse; if unparseable, return a clear message and no misleading results (edge
  case). The evaluator never crashes on malformed input.
- **`#tag` for a non-existent tag**: yields no matches → "no results" state.
- **Only operators / empty after trimming**: treated as empty query (match all).
