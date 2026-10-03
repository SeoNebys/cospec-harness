# Search Syntax Contract

**Applies to**: `query` values in bookmark listing, archive search, saved searches, and all-matches bulk selections  
**Maximum input**: 2,000 Unicode characters

## Searchable Fields

Ordinary words and quoted phrases match case-insensitively against:

- bookmark title;
- saved destination address;
- short description;
- plain text derived from the formatted note; and
- tag display names.

Search never downloads or indexes the destination page's body. Active context excludes archived bookmarks; archive context searches archived bookmarks only.

## Lexical Elements

| Element | Form | Meaning |
|---|---|---|
| Word | `climate` | A token in any searchable field |
| Phrase | `"climate policy"` | The adjacent token sequence in one searchable field |
| Tag | `#news` | Exact normalized tag-name match |
| NOT | `NOT term` | Excludes matches for its following operand |
| AND | `left AND right` | Both operands must match |
| OR | `left OR right` | At least one operand must match |
| Implicit AND | `left right` | Same meaning as `left AND right` |

Operators are recognized case-insensitively when they appear as standalone unquoted words. Inside a quoted phrase they are ordinary text.

The first release does not support parentheses, wildcards, field prefixes other than `#tag`, fuzzy search, proximity search, or escaped arbitrary characters.

## Tag Tokens

- `#news` searches for the exact normalized tag `news`.
- A tag token runs until whitespace or an operator boundary.
- Tags containing spaces are selected through include/exclude tag filters rather than encoded in the free-form query in v1.
- A bare `#`, multiple leading markers, or a marker followed by an unsupported character is invalid.
- Tag matching ignores case and surrounding whitespace according to Tag normalization.

## Phrase Rules

- Double quotes delimit an exact phrase: `"design systems"`.
- Quotes are removed before parameterized phrase matching.
- An empty phrase and an unclosed quote are invalid.
- Raw HTML or database wildcard syntax has no special meaning.

## Precedence and Associativity

From highest to lowest:

1. `NOT`
2. explicit or implicit `AND`
3. `OR`

Binary operators are left-associative. `NOT` is unary and applies only to the following operand.

Examples:

| Input | Equivalent grouping |
|---|---|
| `design systems` | `design AND systems` |
| `#news AND privacy` | `#news AND privacy` |
| `#news OR #research NOT paywall` | `#news OR (#research AND (NOT paywall))` |
| `"AND OR NOT"` | One literal phrase |
| `NOT #read-later` | Exclude the exact tag `read-later` |

## Grammar

```text
query         := or_expression EOF
or_expression := and_expression (OR and_expression)*
and_expression:= unary_expression ((AND | implicit_AND) unary_expression)*
unary_expression := NOT unary_expression | operand
operand       := WORD | PHRASE | TAG
```

An empty query is valid and means “all bookmarks in the current context,” further constrained by structured filters.

## Structured Filters

Structured filters are applied in addition to the expression:

- `includeTagIds`: every listed tag must be present.
- `excludeTagIds`: no listed tag may be present.
- `collectionId`: bookmark must belong to that collection; a dedicated `unfiled` value means no collection.
- `favorite`: `any`, `favorite`, or `not_favorite`.
- `reading`: `any`, `none`, `unread`, or `read`.
- `context`: `active` or `archive`.

A tag cannot appear in both include and exclude lists. Filters reference owned public IDs; an unknown or foreign ID produces a validation error rather than an empty result that could leak existence.

## Sorting

| Value | Primary order | Tie-breaker |
|---|---|---|
| `newest` | `created_at` descending | Public ID ascending |
| `oldest` | `created_at` ascending | Public ID ascending |
| `title` | Case-insensitive title ascending | Public ID ascending |
| `updated` | `updated_at` descending | Public ID ascending |

Stable tie-breakers are required for cursor pagination.

## Error Contract

Invalid expressions return HTTP `422` with a problem document containing:

```json
{
  "type": "https://bookmark.local/problems/invalid-search",
  "title": "Search expression is invalid",
  "status": 422,
  "detail": "Expected a term after AND.",
  "errors": [
    {
      "field": "query",
      "code": "missing_operand",
      "start": 11,
      "end": 14,
      "suggestion": "Add a word, phrase, or #tag after AND."
    }
  ]
}
```

The server returns character offsets and never modifies or discards the submitted query. The client preserves the input and highlights or describes the failing span.

## Required Conformance Examples

| Query | Must match | Must not match |
|---|---|---|
| `privacy` | Title “Privacy basics” | Bookmark with no searchable `privacy` token |
| `"privacy policy"` | Description containing adjacent phrase | Description “privacy and policy” |
| `#news` | Bookmark with tag `News` | Untagged bookmark whose title contains “news” |
| `design OR research` | Either term | Neither term |
| `design NOT archived` | `design` without `archived` | `design` plus `archived` |
| `#news AND "climate policy"` | Exact tag and phrase | Only one operand |
| `"AND"` | Literal word “AND” | Result based on treating it as an operator |

Parser, SQL compiler, API contract, saved-search restoration, and bulk all-matches selection must share the same conformance suite.
