# Design decisions

## Application shape

- A single-user, single-page browser application keeps saving, finding, and
  managing bookmarks in one place.
- A dependency-free Node HTTP service and browser-native client keep local setup
  small. Bookmark data is persisted as an atomically replaced JSON document.
- Remote page details are gathered by the server. A timeout or unsuitable page
  falls back to the website and address while still preserving the bookmark.

## State model

Each bookmark stores its URL, title, site name, automatic summary, personal
note, normalized tags, unread flag, archived flag, and timestamps. Archiving
changes state rather than moving or deleting data, so restoring preserves every
other field. Permanent deletion removes the record after a named confirmation.

## Interaction decisions carried from approval

- Details and notes use an inline editor.
- Tags are added through a dedicated quick action and removed from the label ×.
- All used active tags form a tag bar above the list.
- Unread and Archive are explicit labelled actions; Delete is inside More actions.
- New bookmarks default to unread. Archived items retain unread state but are
  excluded from active, unread, search, and tag views until restored.

## Alternatives not selected

- Pop-up detail editing, tag management checkboxes, tag-click filtering,
  checkbox unread controls, archive in an overflow menu, and archive-first
  deletion were explored and not selected.
