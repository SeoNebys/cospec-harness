# Contract: Rich Search Grammar

Defines the search expression language (FR-010/FR-011/FR-012, US4). The parser
produces a boolean AST evaluated against SQLite FTS5 (text) and tag joins
(membership). Matching is case-insensitive.

## Tokens

- **Phrase**: `"..."` — exact text between double quotes. Any of `AND`/`OR`/`NOT`
  inside quotes are **literal text**, not operators (FR-011, US4 scenario 4).
- **Tag**: `#name` — membership in tag `name`.
- **Operators** (only when unquoted, case-insensitive): `AND`, `OR`, `NOT`.
- **Grouping**: `(` `)`.
- **Term**: any other run of non-space characters — a text term.

## Grammar (EBNF)

```ebnf
expr    = orExpr ;
orExpr  = andExpr { "OR" andExpr } ;
andExpr = notExpr { [ "AND" ] notExpr } ;   (* adjacency = implicit AND *)
notExpr = [ "NOT" ] atom ;
atom    = group | tag | phrase | term ;
group   = "(" expr ")" ;
tag     = "#", identifier ;
phrase  = '"', { any-char-except-quote }, '"' ;
term    = identifier ;
```

**Precedence**: `NOT` > `AND` (incl. implicit) > `OR`. Parentheses override.

## Evaluation

| AST node | SQLite semantics |
|----------|------------------|
| `Term(t)` | FTS5 match of `t` across title, description, note, url. |
| `Phrase(p)` | FTS5 exact-phrase match of `p` across the same columns. |
| `Tag(name)` | `EXISTS (bookmark_tags ⋈ tags WHERE tags.name = name COLLATE NOCASE)`. |
| `AND(a,b)` | `a AND b`. |
| `OR(a,b)` | `a OR b`. |
| `NOT(a)` | `NOT (a)`. |
| `Group(a)` | `(a)`. |

Archived bookmarks are excluded unless the active view is `archive`.

## Examples

| Expression | Meaning |
|------------|---------|
| `react hooks` | text contains `react` AND `hooks` (implicit AND). |
| `#work AND ("release notes" OR changelog) NOT #archive` | tagged `work`, mentions the phrase "release notes" or the word changelog, not tagged `archive`. |
| `"rise and fall"` | exact phrase including the literal word `and` (not an operator). |
| `#reading NOT #done` | tagged `reading` but not `done`. |

## Errors (FR-012)

Return `400` with a human-readable message (no crash, no misleading results) for:
- Unbalanced quotes.
- Unbalanced parentheses.
- A dangling operator (e.g., trailing `AND`, or `NOT` with no atom).
- An empty `#` tag token.

Empty expression → match all (subject to the active view/filter).
