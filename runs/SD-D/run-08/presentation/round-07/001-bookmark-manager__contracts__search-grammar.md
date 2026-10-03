# Contract: Search Query Grammar

Defines the search language (FR-014–FR-018, FR-017a/b/c). The parser turns a query
string into a boolean AST; the executor compiles the AST to a parameterized SQL query
over the FTS5 index and tag joins, always excluding archived bookmarks (FR-019).

## Terms

| Term | Meaning |
|------|---------|
| `word` | Case-insensitive substring match across title, description, note, and address (FR-014). |
| `"quoted phrase"` | Exact phrase match (FR-016). Operator words inside quotes are literal text, not operators (FR-017c). |
| `#tag` | Restrict to bookmarks carrying that tag (FR-015). |

## Operators

- `AND`, `OR`, `NOT` — recognized in any letter case (FR-017b).
- Parentheses `( ... )` group expressions (FR-017).
- **Implicit AND**: adjacent terms with no operator between them are combined with AND,
  including a keyword next to a `#tag` (FR-017a). `OR` must be explicit to make terms
  alternatives.
- Precedence: `NOT` > `AND` (incl. implicit) > `OR`. Parentheses override.

## Examples

| Query | Interpretation |
|-------|----------------|
| `report` | address/title/description/note contains "report". |
| `report #work` | contains "report" **AND** tagged `work` (implicit AND, FR-017a). |
| `report OR #work` | contains "report" **OR** tagged `work`. |
| `"machine learning"` | contains exact phrase "machine learning". |
| `(#work OR #research) AND report NOT "draft"` | tagged work or research, AND contains "report", AND NOT the phrase "draft". |
| `and OR "and then"` | `and` (unquoted) is the operator AND; `"and then"` is literal text. |
| `AND report` (leading operator) | malformed → `invalid_query`. |

## Error handling

Malformed queries return `invalid_query` with a message, rather than misleading
results (FR-018). Malformed cases include:
- Unbalanced quotes.
- Unbalanced parentheses.
- An operator with a missing operand (e.g. trailing `AND`, leading `OR`, empty
  parentheses).

## Tokenizer rules (summary)

1. Scan characters; a `"` opens a quoted run captured verbatim until the next `"`
   (unbalanced `"` → error). Content is a phrase term; operator-like words inside are
   text.
2. `#` followed by tag characters → a tag term.
3. `(` and `)` → grouping tokens.
4. Bare runs separated by whitespace → words; a bare run equal to `and`/`or`/`not`
   (any case) → the corresponding operator token.
5. Between two consecutive operand tokens with no operator token, inject an implicit
   AND.

## AST → execution

- `word` / phrase → FTS5 match against `bookmarks_fts`.
- `#tag` / include / exclude → `EXISTS`/`NOT EXISTS` against BookmarkTag joined to Tag.
- `AND`/`OR` → SQL `INTERSECT`/`UNION` of id sets (or composed `WHERE` conditions);
  `NOT` → negation over the active-bookmark id space.
- Final result filtered to `is_archived = 0`, ordered by the requested/default sort,
  paginated.
