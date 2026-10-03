# Data Model: Bookmark Manager

## Bookmark

Represents one saved web destination.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | string | Yes | Stable, unique UUID assigned at creation and never edited |
| `title` | string | Yes | Trimmed; must contain at least one non-whitespace character |
| `url` | string | Yes | Canonical serialized HTTP or HTTPS URL with a non-empty hostname |
| `description` | string | No | Trimmed; empty input stored as an empty string |
| `tags` | string array | Yes | Zero or more trimmed, non-empty values; unique by normalized comparison key; first visible spelling retained |
| `createdAt` | timestamp | Yes | Assigned at creation; immutable |
| `updatedAt` | timestamp | Yes | Assigned at creation and replaced after every successful edit |

### Invariants

- `title` and `url` are valid before a write begins.
- `id` and `createdAt` never change during editing.
- `updatedAt` is not earlier than `createdAt`.
- No bookmark contains duplicate tags after comparison normalization.
- User-entered strings are rendered as text, never interpreted as markup.

### Lifecycle

```text
draft → validating → persisted
  └──────────────→ validation error (draft retained)

persisted → editing → validating → persisted (updated)
                    ├→ validation error (edit retained)
                    └→ cancelled (original retained)

persisted → delete pending → deleted
                         └→ cancelled (persisted)
```

A storage failure from any validating/deleting transition returns the interface to the prior persisted collection and exposes an actionable error.

## Tag (derived view)

A tag is an organizational label derived from all bookmark `tags` arrays; it is not stored independently.

| Field | Type | Rules |
|---|---|---|
| `label` | string | First retained user-facing spelling |
| `comparisonKey` | string | Trimmed, Unicode-normalized, locale-aware lowercase value |
| `bookmarkCount` | number | Count of bookmarks containing the comparison key |

Removing the final association removes the tag from the filter choices automatically.

## Repository operations

- `list(): Promise<Bookmark[]>`
- `create(input): Promise<Bookmark>`
- `update(id, input): Promise<Bookmark>`
- `delete(id): Promise<void>`

The repository reports missing records and storage failures explicitly. Each mutation is one transaction and resolves only after commit.
