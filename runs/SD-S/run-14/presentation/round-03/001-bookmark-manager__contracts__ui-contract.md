# UI Contract: Bookmark Manager

This contract defines the observable interface behavior. It is not an implementation API.

## Application readiness

- The page shows a loading state while the stored collection is being read.
- The main application receives `data-harness-ready="true"` only after the initial read succeeds and the usable collection or valid empty state is rendered.
- A load failure shows a recoverable error state and is not marked ready.

## Collection view

- A single page contains a clear heading, an “Add bookmark” action, search input, tag filter, result summary, and bookmark list.
- Each bookmark exposes its title as an external link, its address, description when present, tags, and Edit/Delete actions.
- Bookmarks appear newest-created first. Editing does not change their order.
- External links open in a new browsing context and communicate that behavior accessibly.

## Create and edit form

- Fields: title (required), web address (required), description (optional), tags (optional and multiple).
- Save validates all fields. Invalid fields retain their values and show adjacent actionable messages associated with the controls.
- Cancel closes the form and makes no persistent change.
- A successful action closes the form, updates the collection, and announces the outcome.
- Editing loads every existing value; a successful edit preserves the bookmark identity and creation time.

## Duplicate flow

- When a canonical address already exists, the initial save does not write.
- The confirmation identifies the duplicate condition and offers “Save duplicate” and “Cancel.”
- Cancel returns without writing; confirmation creates or updates as requested.

## Search and tag filter

- Search uses case-insensitive partial matching across title, canonical address, description, and tags.
- One tag may be selected at a time; search and tag filtering combine so results satisfy both criteria.
- Clearing controls restores the complete collection.
- Result count changes are announced without moving focus.
- No matches show a dedicated state with an action to clear active criteria.

## Delete confirmation

- Delete opens a modal confirmation naming the bookmark.
- The destructive action is explicit and is not the default focus.
- Cancel/Escape leaves data unchanged. Confirm removes the record only after storage commits.
- On close, focus returns to a logical surviving control.

## Error and accessibility behavior

- Storage failures preserve the prior rendered collection and show a useful retry message.
- All functionality is reachable by keyboard; focus is visible.
- Modal focus remains within the active dialog and returns to the initiating context when it closes.
- Status messages do not rely on color alone, and user content is displayed as plain text.
