# Search Grammar Contract

**Feature**: 001-bookmark-manager | Implements FR-018–FR-024.
The search box accepts a small query language. This contract defines the grammar
and evaluation semantics; the server parses it into an expression tree and
evaluates it against the candidate bookmarks in the active view.

## Tokens

- **Phrase**: `"…"` — a double-quoted string. Matched as a case-insensitive
  exact substring. Any text inside quotes is literal, **including** the words
  `AND`, `OR`, `NOT` and `#` (FR-021, FR-023).
- **Tag**: `#name` — membership test against the bookmark's tags, by shared
  tag identity (case-insensitive) (FR-019).
- **Operators**: bare, upper-case `AND`, `OR`, `NOT` (FR-022). Lower-case or
  quoted forms are **not** operators — they are ordinary words/phrases (FR-023).
- **Grouping**: `(` `)` (FR-022).
- **Word**: any other run of non-space characters. Case-insensitive substring
  match over title, description, note, and address (FR-018).

## Grammar (EBNF)

```ebnf
expr        = or_expr ;
or_expr     = and_expr { "OR" and_expr } ;
and_expr    = unary { [ "AND" ] unary } ;   (* adjacency = implicit AND *)
unary       = [ "NOT" ] primary ;
primary     = "(" expr ")" | tag | phrase | word ;
tag         = "#" , identifier ;
phrase      = '"' , { any-char-except-quote } , '"' ;
word        = identifier ;
```

- **Precedence** (high→low): `NOT` > `AND` (incl. implicit) > `OR`.
- **Implicit AND**: two adjacent operands with no operator between them are
  AND-ed. So `#js promise` ≡ `#js AND promise` and requires **both** the `js`
  tag and the word `promise` to match (FR-020).

## Evaluation semantics

A bookmark **matches** an expression as follows:

| Node | Matches when… |
|------|---------------|
| word `w` | `w` (case-insensitive) is a substring of title, description, note, or url (FR-018) |
| phrase `p` | `p` (case-insensitive) is an exact substring of title, description, note, or url (FR-021) |
| tag `#t` | the bookmark carries tag identity `t` (FR-019) |
| `NOT x` | the bookmark does **not** match `x` |
| `x AND y` | matches both `x` and `y` |
| `x OR y` | matches `x` or `y` |
| `( x )` | matches `x` |

Scope: evaluation runs over the **active view's** candidate set, so the normal
and unread views never include archived bookmarks (FR-024); the archived view
searches only archived ones.

## Errors (FR-022)

Unbalanced parentheses, a dangling operator (e.g. trailing `AND`), an empty group
`()`, or an unterminated quote → the parser returns a clear message
(`400 invalid_query`) naming the problem. The collection is never mutated and the
app does not crash.

## Worked examples

| Query | Meaning |
|-------|---------|
| `rust` | word `rust` in any of the four fields |
| `#reading #rust` | carries both tags `reading` and `rust` |
| `#js promise` | carries tag `js` **and** word `promise` (implicit AND, FR-020) |
| `"machine learning"` | exact phrase, case-insensitive |
| `python AND (flask OR django)` | grouped booleans |
| `docs NOT deprecated` | matches `docs`, excludes `deprecated` |
| `"this AND that"` | literal phrase containing the word AND (FR-023) |
| `#news "OR"` | tag `news` and the literal word `OR` |
```
