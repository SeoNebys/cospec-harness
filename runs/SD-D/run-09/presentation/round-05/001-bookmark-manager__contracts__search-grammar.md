# Search Grammar Contract

**Feature**: 001-bookmark-manager | Covers FR-014, FR-015, FR-016.

Defines exactly how a search expression (the `q` parameter) is parsed and
evaluated. This is a contract: the implementation and its tests MUST honor these
rules, including the two behaviours the client called out.

## Tokens

| Token            | Meaning |
|------------------|---------|
| bare word        | Case-insensitive **substring** term matched against the bookmark's combined text (title + description + note + address). |
| `"quoted text"`  | Exact literal phrase (case-insensitive). Any `AND`/`OR`/`NOT` **inside quotes are ordinary words**, not operators. |
| `#tag`           | Tag membership: true when the bookmark carries that tag (case-insensitive). |
| `AND` `OR` `NOT` | Boolean operators **only when unquoted**. `NOT` is unary; `AND`/`OR` are binary. |
| `(` `)`          | Grouping. |

## Combining rules

1. **Implicit AND**: Two adjacent terms with no operator between them combine with
   AND. Therefore free text next to a `#tag` requires **both** to match — e.g.
   `invoice #work` ⇔ `invoice AND #work` (FR-015).
2. **Precedence** (highest → lowest): `( )` › `NOT` › `AND` (incl. implicit) ›
   `OR`. So `a OR b c` ⇔ `a OR (b AND c)`; `NOT a b` ⇔ `(NOT a) AND b`.
3. **Case**: Matching is case-insensitive for words, phrases, and tags (FR-014).
4. **Operator words as literals**: `"AND"`, `"OR"`, `"NOT"` (quoted) match the
   literal word; unquoted they are operators (client requirement).

## Evaluation

- Parse into a boolean AST. On any syntax error (unbalanced quote or parenthesis,
  dangling operator), the API returns **400** with a clear message; it does not
  return misleading partial results (FR-016).
- Evaluate the AST per candidate bookmark of the active view:
  - text term → substring test against combined lower-cased text;
  - phrase → substring test of the exact phrase;
  - `#tag` → membership in the bookmark's tag set;
  - `AND`/`OR`/`NOT`/group → standard boolean logic.
- The active view already restricts candidates (normal/unread excludes archived;
  archived view includes only archived). Saved-filter include/exclude tags apply
  as an outer AND / AND-NOT around the parsed expression.

## Worked examples

| Query | Matches when... |
|-------|-----------------|
| `react hooks` | text contains "react" AND text contains "hooks" |
| `"react hooks"` | text contains the exact phrase "react hooks" |
| `react OR vue` | text contains "react" OR "vue" |
| `#frontend NOT #archived` | has tag `frontend` AND does not have tag `archived` |
| `invoice #work` | text contains "invoice" AND has tag `work` |
| `(react OR vue) #tutorial` | (text has "react" OR "vue") AND has tag `tutorial` |
| `"this AND that"` | text contains the literal phrase "this AND that" |
| `climbing NOT gym` | text has "climbing" AND does not have "gym" |

## Error examples (→ 400)

| Query | Reason |
|-------|--------|
| `react OR` | dangling operator |
| `"unterminated` | unbalanced quote |
| `(a OR b` | unbalanced parenthesis |
| `NOT` | operator with no operand |
