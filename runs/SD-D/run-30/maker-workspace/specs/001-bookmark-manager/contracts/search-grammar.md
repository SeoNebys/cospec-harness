# Search Grammar Contract

## Supported syntax

```ebnf
query          = [ or_expression ] ;
or_expression  = and_expression , { OR , and_expression } ;
and_expression = clause , { clause } ;
clause         = [ NOT ] , atom ;
atom           = word | phrase | tag ;
phrase         = '"' , phrase_character , { phrase_character } , '"' ;
tag            = '#' , tag_character , { tag_character } ;
OR             = case-insensitive whole word "OR" ;
NOT            = case-insensitive whole word "NOT" ;
```

Whitespace separates tokens. Adjacent clauses use AND. Operators are recognized only as unquoted whole words. Parentheses are rejected with `INVALID_SEARCH_QUERY` in v1.

## Matching rules

- Matching is case-insensitive.
- A word matches title, URL, rendered note text, or a tag name.
- A quoted phrase matches contiguous words in entered order in those fields.
- `#tag` matches exact normalized tag membership, not a substring.
- `NOT` excludes its following word, phrase, or tag and binds before AND and OR.
- Adjacent positive clauses must all match.
- OR separates alternatives; either complete side may match.
- A negative-only query evaluates over all bookmarks in the current view and removes matches.
- View selection and explicit tag filters apply before the text expression.

## Examples

| Query | Meaning |
|---|---|
| `design systems` | Contains both `design` and `systems` |
| `#research` | Has the exact tag `research` |
| `"design systems"` | Contains that exact phrase |
| `react OR vue` | Contains either term |
| `javascript NOT beginner` | Contains `javascript` and excludes `beginner` |
| `#work OR "read later" NOT draft` | Has `work`, or matches the phrase while excluding `draft` from that alternative |

## Invalid input

Unmatched quotes, bare/trailing `OR`, bare `NOT`, repeated operators without operands, and parentheses return `400 INVALID_SEARCH_QUERY` with a message and source span. The client retains the original query.
