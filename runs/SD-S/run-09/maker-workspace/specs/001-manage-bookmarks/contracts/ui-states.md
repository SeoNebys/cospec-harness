# UI State Contract: Personal Bookmark Manager

This contract defines observable interface behavior. It does not prescribe visual styling.

## Global Shell

- The app has three top-level states: checking session, signed out, and signed in.
- Loading and error placeholders do not carry `data-harness-ready="true"`.
- The sign-in page, a valid empty library, and a loaded non-empty library carry `data-harness-ready="true"` once their required data is available.
- Desktop and mobile layouts expose the same actions and status text. Mobile may collapse folders, tags, filters, and account controls into drawers or menus.
- Every icon-only control has an accessible name. Keyboard focus remains visible and follows dialogs correctly.
- External bookmark destinations open in a new browsing context with opener isolation. The saved record is unchanged.

## Authentication Views

### Sign in

- Fields: email, password, remember-me control.
- Actions: sign in, navigate to registration, navigate to password recovery.
- Invalid credentials use a generic message and retain the entered email.
- Rate limiting explains when another attempt can be made without revealing account existence.

### Registration

- Fields: display name, email, password, password confirmation.
- The password guidance states the 15–128 character rule.
- Submission uses generic account-existence behavior. Successful registration directs the user to sign in because auto-sign-in is disabled.

### Password recovery and reset

- Recovery asks only for email and always shows the same confirmation state.
- The reset view accepts the emailed token from the entry URL, asks for a new password and confirmation, and handles invalid/expired tokens without exposing sensitive detail.
- After a successful reset, prior sessions are invalid and the user returns to sign in.

## Library Initial States

### New library

- The primary call to action is the URL input for saving the first bookmark.
- Search, filter, and sort controls remain understandable but do not imply missing data.

### Loaded library

- The visible result count, active filters, sort order, and bookmark cards/list are consistent.
- Loading another cursor page does not reorder or duplicate already rendered items.
- A bookmark item exposes title, address/domain, icon, favorite state, folder, tags, relevant date, open, edit, and delete actions.

### No matching results

- The view clearly distinguishes “no matches” from an empty library.
- Active query/filter chips remain visible and a single action clears them.

### Recoverable load failure

- Existing shell/navigation stays available.
- The failure message includes a retry action and does not falsely present an empty library.

## Save Bookmark Composer

### Entry

- URL is the only required user-entered field.
- Entering a syntactically valid URL starts a debounced metadata preview without submitting the bookmark.
- The user can open optional controls for title, notes, folder, tags, and favorite state.

### Metadata loading

- A bounded loading indicator appears beside the title/icon preview.
- The Save action remains available. The user is never forced to wait indefinitely for metadata.
- If the user types a title while metadata is loading, that title becomes authoritative and is not overwritten by the response.

### Metadata ready

- Captured title and validated site icon appear automatically.
- The title is editable before save.
- The icon is presented as page metadata, not as a required editable field.

### Metadata fallback

- A readable address-derived title and generic icon appear.
- Neutral text explains that page details could not be fetched and that saving still works.
- Internal-address policy and network diagnostics are not disclosed.

### Invalid URL

- The URL field identifies the correction needed.
- No bookmark is created and no metadata request is attempted for unsupported schemes.

### Duplicate warning

- The app shows the existing bookmark's title and address before creating another copy.
- Actions are “View existing”, “Save another copy”, and “Cancel”.
- Choosing “Save another copy” repeats the create request with explicit duplicate intent.

### Save failure

- URL, title, notes, folder, tags, and favorite choices remain in the composer.
- The message states that the bookmark was not saved and offers another attempt.

### Save success

- The new bookmark appears in the current result set if it matches the current query and filters.
- The composer resets only after confirmed success.
- If background metadata is still pending, the bookmark displays fallback data and may update only while its title remains fallback-sourced.

## Search, Filters, and Sort

- Search matches title, URL, or tags without case sensitivity and updates after a short input debounce.
- Folder, tag, and favorite filters may be combined; every active filter is visible and independently removable.
- Sort choices are Newest, Oldest, and Title.
- Search/filter/sort state is reflected in the URL query string so refresh and browser history preserve the view.
- Changing search, filters, or sort resets pagination to the first page.

## Bookmark Maintenance

### Favorite

- Favorite toggling is immediately visible.
- If the request fails, the visual state rolls back and a non-blocking error is announced.

### Edit

- The edit form starts with the current title, URL, notes, folder, and tags.
- Saving a changed title marks it as user-authored.
- Changing the URL restarts metadata eligibility, but an explicitly edited title remains authoritative.
- Validation or network failure retains all edits.

### Delete

- Delete always opens a confirmation dialog naming the bookmark.
- Cancel leaves all data unchanged.
- Confirm removes the bookmark from every view only after server success.
- Failure closes neither the user's context nor the ability to retry.

### Metadata retry

- Blocked, failed, or partial metadata may offer a Retry details action.
- Retry is rate-limited and never clears the current title or generic/captured icon while pending.
- A successful retry replaces the title only if it is still fallback-sourced.

## Folder and Tag Management

- Create and rename validate trimmed, normalized uniqueness and retain input after failure.
- Deleting a folder or tag confirms that bookmarks will remain.
- After folder deletion, affected bookmarks appear unfiled.
- After tag deletion, affected bookmarks remain and search/filter state updates without stale entries.
- Counts update after bookmark, folder, or tag mutations.

## Accessibility and Feedback

- Validation messages are programmatically associated with fields.
- Dialogs trap focus while open, close on Cancel/Escape, and return focus to the invoking control.
- Success and error feedback is announced through an appropriate live region without stealing focus.
- Color is never the only indication of favorite, selected filter, error, or metadata status.
- Long titles, URLs, tag lists, and notes wrap or truncate without covering open/edit/delete controls.
- Touch targets remain usable at narrow widths and all primary workflows are keyboard-operable.
