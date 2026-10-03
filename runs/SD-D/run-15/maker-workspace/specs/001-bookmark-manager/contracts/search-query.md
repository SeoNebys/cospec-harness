# Contract: Search Query Language

Implements FR-017–020. Matching is **case-insensitive** throughout. The parser produces an
AST; the evaluator tests each (non-archived) bookmark against it.

## Fields searched
Bare terms match as a case-insensitive substring against any of: **title, description, note
(Markdown source), address (URL)** (FR-017).

## Tokens
- **Bare term**: an unquoted word → substring match across the fields above.
- **`#tag`**: a term beginning with `#` → true iff the bookmark carries that tag (FR-018).
- **Quoted phrase**: `"..."` → exact case-insensitive substring of the whole phrase (FR-019).
  A boolean operator word inside quotes (e.g. `"AND"`, `"OR"`, `"NOT"`) is **literal text**,
  not an operator (FR-019).
- **Operators**: bare, upper-or-lower `AND`, `OR`, `NOT`, and parentheses `(` `)` (FR-020).

## Grammar (precedence: NOT > AND > OR)
```text
query   := or
or      := and ( OR and )*
and     := not ( (AND | ⟨implicit⟩) not )*   # adjacent terms are implicitly ANDed
not     := NOT not | primary
primary := '(' or ')' | term
term    := PHRASE | TAG | WORD
```

## Semantics
- **Implicit AND**: whitespace-separated terms must all match (conjunctive). In particular,
  ordinary text combined with a `#tag` narrows by **both** conditions (FR-018), e.g.
  `invoice #work` ⇒ text "invoice" matches AND tagged `work`.
- **OR** widens; **NOT** negates its operand; **parentheses** group to override precedence,
  e.g. `(python OR rust) AND #reading NOT archived-notes`.
- **Quoted operators are literal**: `"AND"` matches bookmarks whose text contains the string
  `AND`; it does not combine terms (FR-019).
- **Empty query** ⇒ matches all (subject to view/tag filters).
- **No matches** ⇒ the caller shows the "no results" state (FR-010).

## Worked examples
| Query                         | Meaning                                                        |
|-------------------------------|----------------------------------------------------------------|
| `recipes`                     | text contains "recipes"                                        |
| `#work`                       | tagged `work`                                                  |
| `invoice #work`               | text "invoice" AND tagged `work`                               |
| `"machine learning"`          | text contains the exact phrase "machine learning"             |
| `"AND"`                       | text contains the literal word "AND"                          |
| `python OR rust`              | text "python" OR text "rust"                                   |
| `#reading NOT #work`          | tagged `reading` AND NOT tagged `work`                        |
| `(a OR b) c`                  | (text "a" OR text "b") AND text "c"                           |

## Saved searches
A saved search stores free `query_text` plus `included_tags[]` / `excluded_tags[]`; running it
evaluates the text query, then requires all included tags present and all excluded tags absent
(FR-028).
