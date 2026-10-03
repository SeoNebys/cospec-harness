# UI Behavior Contract: Personal Bookmark Manager

## Global behavior

- The interface is keyboard-operable and uses semantic labels, focus management, visible focus indicators, and announced status/error messages.
- Active and archived collection state, search text, tag filters, and favorite filter are represented in the URL so refresh and browser navigation preserve context.
- Loading indicators do not remove already visible collection content. Mutations disable only conflicting controls.
- Opening a saved destination uses a new browsing context with safe opener isolation.

## Account access

- An unauthenticated visitor sees sign-in and create-account options.
- Successful authentication enters the active collection. Failed credentials use a generic message that does not reveal whether an email exists.
- Signing out ends the current session and returns to sign-in.

## Bookmark form

The same dialog supports create and edit modes. Fields are URL, title, notes, tags, and favorite state.

### Automatic title suggestion

1. Pasting into the URL field triggers validation immediately; typed input is checked on blur.
2. If the URL is valid and the title is empty and untouched, the UI automatically starts a title-preview request after a short debounce. No button press is required.
3. While pending, the title area shows a non-blocking “Finding title…” status. The user can keep typing or save once all required fields are valid.
4. If a title arrives while the title remains empty and untouched for the same URL, it populates the field and remains fully editable.
5. If the user types a title, changes the URL, closes the dialog, or starts a newer request, an older response must not alter the form.
6. Missing-title, timeout, blocked-address, non-HTML, oversized-response, and network outcomes display a short manual-entry prompt; they do not clear any input or prevent saving with a valid manual title.
7. Editing an existing bookmark never automatically replaces its current title. A preview is attempted only if the user clears the title, changes the URL, and leaves the title untouched afterward.

### Validation and duplicates

- Field errors appear next to their fields and preserve all current values.
- Tag entry trims and consolidates capitalization/whitespace variants before submission.
- A duplicate response opens a warning naming the existing bookmark, with actions to open it, edit it, return to the form, or intentionally save/update anyway.
- Continuing after a warning resubmits the unchanged draft with explicit duplicate consent.

## Collection view

- Active bookmarks load newest first in pages of fifty.
- Cards/rows show title, domain, tags, favorite state, and save date; notes may be shown in a secondary detail region.
- Search updates after a short debounce and covers title, URL, notes, and tags.
- Selecting multiple tags requires all selected tags. The favorite filter combines with search and tags.
- “Clear filters” resets search, tags, and favorite state in one action.
- No-result state distinguishes an empty collection from filters with no matches.

## Bookmark actions

- Favorite changes update immediately with an accessible progress/error state and revert on failure.
- Edit reopens the form with current values.
- Archive removes an item from active results after success. Restore removes it from archived results after success.
- Delete always opens a focused confirmation dialog that names the bookmark and states the action cannot be undone. Cancellation changes nothing.
- After successful archive, restore, or delete, focus moves to a logical nearby item or the collection heading and a status message is announced.

## Responsive behavior

- Desktop layouts may use a persistent filter area; narrow layouts collapse filters behind a clearly labeled control.
- All primary actions remain available without horizontal scrolling at a 320 CSS-pixel viewport.
- Dialogs fit the viewport, keep action controls reachable, and allow their content to scroll independently.
