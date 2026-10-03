# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-23

**Last Revised**: 2026-09-23

**Status**: Approved

**Approved**: 2026-09-23

**Input**: Build an app to save and manage bookmarks, including automatic page details, strict duplicate prevention, a read-later workflow, archiving, formatted notes, advanced search, tag suggestions, and selectable sorting.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a Link with Automatic Details (Priority: P1)

As a user, I want to paste a web address and have the app retrieve the page title, a short description, the site icon, and a preview image when available, so saving a useful bookmark requires little manual work. I can review and change the suggested title and description before saving or later.

**Why this priority**: Fast, low-effort capture is the core reason to use this app instead of keeping an unorganized list of links.

**Independent Test**: Paste a valid public web address that exposes page details, verify that the save form is populated, edit the suggested text, save the bookmark, leave and return to the app, and open the saved destination.

**Acceptance Scenarios**:

1. **Given** an empty save form, **When** the user pastes a valid web address, **Then** the app begins retrieving available page details and shows progress without blocking manual entry.
2. **Given** the destination exposes a title, description, site icon, and preview image, **When** retrieval completes, **Then** each available detail is shown in the save form for review.
3. **Given** retrieved details are displayed, **When** the user changes the title or description before saving, **Then** the user's version is saved instead of the retrieved version.
4. **Given** retrieval fails, times out, or a detail is unavailable, **When** the result is shown, **Then** the app explains that details could not be retrieved, keeps the entered web address, and allows the user to enter the required title and save without the missing optional details.
5. **Given** a bookmark is successfully saved, **When** the user returns to the app later, **Then** the bookmark and its saved details are still present.
6. **Given** a saved bookmark, **When** the user opens it, **Then** the destination opens without replacing or losing their place in the bookmark collection.

---

### User Story 2 - Find and Organize Bookmarks (Priority: P2)

As a user with many bookmarks, I want plain-text and structured search, reusable tags, favorites, filters, and selectable sorting so I can quickly narrow and order the collection in the way that suits the task.

**Why this priority**: A growing bookmark collection only remains useful when its contents can be found predictably.

**Independent Test**: Populate a collection with varied titles, addresses, descriptions, formatted notes, tags, favorite states, and dates; verify partial-text, quoted-phrase, tag, AND/OR searches, filters, suggestions, and every sort option against known results.

**Acceptance Scenarios**:

1. **Given** multiple bookmarks, **When** the user enters ordinary text, **Then** the app returns case-insensitive partial matches from titles, web addresses, descriptions, notes, and tags.
2. **Given** bookmarks containing a multi-word phrase, **When** the user places that phrase in quotation marks, **Then** only bookmarks containing the exact phrase are returned.
3. **Given** bookmarks with different tags, **When** the user searches with `tag:tag-name`, **Then** only bookmarks carrying that exact tag are returned.
4. **Given** multiple search conditions, **When** the user combines them with `AND` or `OR`, **Then** results satisfy all conditions for `AND` or at least one condition for `OR`; adjacent conditions without an operator behave as `AND`.
5. **Given** an expression that contains both `AND` and `OR`, **When** the search runs, **Then** `AND` is evaluated before `OR`, and parentheses can be used to change that grouping.
6. **Given** the user is entering a tag on a new or existing bookmark, **When** the entered text matches tags already in the collection, **Then** matching existing tags are suggested and can be selected without retyping.
7. **Given** one or more favorite bookmarks, **When** the user enables the favorites filter, **Then** only favorite bookmarks are shown.
8. **Given** the collection or filtered results, **When** the user selects title, date added, or date updated and a direction, **Then** the visible bookmarks are reordered accordingly and the choice persists for later visits.
9. **Given** active search text or filters, **When** the user clears them, **Then** the full active collection is shown again without changing the selected sort order.
10. **Given** no bookmark matches, **When** results are displayed, **Then** the app shows a clear no-results message and a way to return to the full collection.

---

### User Story 3 - Manage a Read-Later List (Priority: P3)

As a user, I want to mark any bookmark as “To read,” view all unread bookmarks together, and mark an item as read when finished so it leaves that list without being deleted.

**Why this priority**: A dedicated reading state separates unfinished reading from general reference bookmarks and makes saved reading actionable.

**Independent Test**: Mark active bookmarks as To read from both the save form and an existing bookmark, open the To Read view, mark one as read, and verify that it leaves that view but remains in the main collection.

**Acceptance Scenarios**:

1. **Given** a new or existing bookmark, **When** the user marks it as To read, **Then** it appears in the To Read view and remains in the active collection.
2. **Given** a bookmark in the To Read view, **When** the user marks it as read, **Then** it immediately leaves the To Read view but remains available in the active collection.
3. **Given** a bookmark previously marked read, **When** the user marks it To read again, **Then** it returns to the To Read view.
4. **Given** search, tag, favorite, and sort controls, **When** the user applies them in the To Read view, **Then** they operate on the To Read subset.

---

### User Story 4 - Maintain Details and Formatted Notes (Priority: P4)

As a user, I want to update saved details, favorites, tags, and longer formatted notes so each bookmark can carry useful context and remain accurate over time.

**Why this priority**: Bookmarks become more valuable when the user can add durable context and correct either retrieved or user-entered information.

**Independent Test**: Edit every editable field, apply each supported note format, view the rendered note, toggle the favorite state, and verify all changes persist.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user edits its title, web address, description, notes, or tags with valid values, **Then** the updated details replace the prior details and persist.
2. **Given** a bookmark note, **When** the user adds paragraphs, headings, bold text, italic text, bulleted or numbered lists, quotations, or links, **Then** those formats are preserved and displayed as formatted content when viewing the bookmark.
3. **Given** an existing bookmark, **When** the user toggles its favorite state, **Then** the new state is immediately visible and persists.
4. **Given** the user changes a bookmark web address, **When** the new address is valid and unique, **Then** the user may choose to refresh the automatically retrieved page details before saving the change.

---

### User Story 5 - Archive, Restore, and Permanently Delete (Priority: P5)

As a user, I want to archive bookmarks I no longer need in the normal collection, restore them later, and reserve confirmed deletion for permanent removal.

**Why this priority**: Archiving supports routine cleanup without forcing an irreversible decision, while permanent deletion remains available when explicitly wanted.

**Independent Test**: Archive an active bookmark, verify it disappears from active lists and searches, find it in the Archive view, restore it, then permanently delete it after confirmation; also verify that canceling deletion preserves it.

**Acceptance Scenarios**:

1. **Given** an active bookmark, **When** the user archives it, **Then** it leaves the active collection, active search results, and To Read view and appears in the Archive view.
2. **Given** an archived bookmark, **When** the user restores it, **Then** it returns to the active collection with its details, tags, favorite state, and read status preserved.
3. **Given** the Archive view, **When** the user searches, filters, or sorts it, **Then** those controls operate only on archived bookmarks.
4. **Given** an active or archived bookmark, **When** the user requests permanent deletion, **Then** the app asks for explicit confirmation.
5. **Given** a pending deletion, **When** the user cancels, **Then** the bookmark remains unchanged.
6. **Given** a confirmed deletion, **When** removal completes, **Then** the bookmark no longer appears in any view or search result.

### Edge Cases

- If a pasted address matches an existing active bookmark after normalization, no second bookmark is created; the app opens the existing bookmark for viewing or editing and explains why.
- If a pasted address matches an archived bookmark, no second bookmark is created; the app opens the archived bookmark and offers restoration or editing.
- If changing an existing bookmark's address would duplicate another bookmark, the change is not saved and the app opens or links to the conflicting bookmark.
- Web addresses are compared after trimming whitespace, treating the scheme and host as case-insensitive, removing default ports, and treating an empty path and `/` as equivalent. Other path, query, and fragment differences remain distinct.
- If page-detail retrieval finishes after the user has changed a field, the retrieved value does not overwrite the user's change.
- Missing or inaccessible page metadata never prevents manual saving when the address and title are valid; missing site icons and preview images use a neutral visual fallback.
- Leading and trailing spaces in titles, descriptions, search text, and tags do not produce unexpected matches or empty labels.
- Tags that differ only by capitalization or surrounding whitespace are treated as the same tag and are not suggested twice.
- Invalid search syntax identifies the location of the problem and preserves the query for correction rather than silently changing its meaning.
- Archived bookmarks are excluded from the active collection, active search, favorites, and To Read view even if they otherwise match.
- A bookmark with a long title, address, description, or formatted note remains readable without breaking the collection or detail layout.
- If stored data cannot be read or a change cannot be saved, the app reports the failure without silently discarding the user's current input.
- The new-user empty state, active no-results state, empty To Read state, empty Archive state, and data-access error state are visually distinct and each provides an appropriate next action.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST let the user begin a bookmark by entering or pasting a valid `http` or `https` web address.
- **FR-002**: After a valid address is entered, the app MUST automatically attempt to retrieve the page title, short description, site icon, and preview image and MUST show retrieval progress.
- **FR-003**: Retrieved title and description MUST remain editable before saving and afterward; a user's edits MUST take precedence over retrieved values.
- **FR-004**: The app MUST allow manual completion and saving when retrieval fails or any optional page detail is unavailable, provided that the web address and title are valid.
- **FR-005**: The app MUST validate required fields and supported address formats before saving and MUST provide a specific, actionable message for each invalid field.
- **FR-006**: The app MUST preserve successfully saved bookmarks and preferences across app restarts and later visits in the same user environment.
- **FR-007**: The app MUST prevent two bookmarks from having the same normalized web address across both active and archived bookmarks.
- **FR-008**: When a new address duplicates an active bookmark, the app MUST open the existing bookmark for viewing or editing instead of creating another.
- **FR-009**: When a new address duplicates an archived bookmark, the app MUST open that bookmark in the Archive view and offer restoration or editing instead of creating another.
- **FR-010**: When an edited address would duplicate another bookmark, the app MUST block the conflicting change and provide direct access to the existing bookmark.
- **FR-011**: The active collection MUST show, at minimum, each bookmark's title, destination host or address, available site icon or fallback, tags, favorite state, and To read state.
- **FR-012**: The bookmark detail view MUST show the description, preview image when available, formatted notes, timestamps, and all information shown in the collection.
- **FR-013**: The app MUST let the user open a saved destination without losing their place in the collection.
- **FR-014**: The app MUST support case-insensitive partial-text search across title, web address, description, notes, and tags.
- **FR-015**: The app MUST support quoted exact-phrase searches and exact tag conditions using `tag:tag-name`; tag names containing spaces MUST be supported by quoting the value.
- **FR-016**: The app MUST support case-insensitive `AND` and `OR` operators, implicit `AND` between adjacent conditions, `AND` precedence over `OR`, and parentheses for explicit grouping.
- **FR-017**: The app MUST explain invalid search syntax and preserve the query so the user can correct it.
- **FR-018**: The app MUST let the user filter by one selected tag, favorite status, and To read status, and MUST allow those filters to be combined with search conditions.
- **FR-019**: While the user enters tags, the app MUST suggest matching tags already used in the collection, ignoring capitalization and surrounding whitespace, and MUST allow a suggestion to be selected.
- **FR-020**: The app MUST let the user clear all active search conditions and filters in a single action.
- **FR-021**: The app MUST let the user sort visible bookmarks by title, date added, or date updated, each in ascending or descending order, and MUST retain the selected sort choice across later visits.
- **FR-022**: The app MUST apply search, filters, and sorting within the current view: active collection, To Read, or Archive.
- **FR-023**: The app MUST let the user mark an active bookmark To read or read during creation, from the collection, or from its detail view.
- **FR-024**: Marking a bookmark read MUST remove it from the To Read view without removing it from the active collection.
- **FR-025**: New bookmarks MUST default to not marked To read unless the user selects that state.
- **FR-026**: The app MUST let the user edit the title, address, description, notes, and tags of an existing bookmark and apply creation validation and duplicate prevention to those changes.
- **FR-027**: The app MUST let the user write multi-paragraph notes using headings, bold, italic, bulleted and numbered lists, quotations, and links, and MUST display those notes as formatted content.
- **FR-028**: Displayed notes MUST not execute embedded active content or otherwise alter the app outside the supported formatting actions.
- **FR-029**: The app MUST let the user mark and unmark any active bookmark as a favorite.
- **FR-030**: The app MUST let the user archive an active bookmark without permanently deleting it.
- **FR-031**: Archived bookmarks MUST be excluded from all active views and active search results and MUST be available in a distinct Archive view.
- **FR-032**: The app MUST let the user restore an archived bookmark with all saved details and states preserved.
- **FR-033**: The app MUST require explicit confirmation before permanently deleting an active or archived bookmark.
- **FR-034**: The app MUST distinguish among new-user, no-results, empty To Read, empty Archive, retrieval-failure, and data-access-error states and provide an appropriate next action for each.
- **FR-035**: The app MUST provide all bookmark-management workflows using keyboard-only input as well as pointer or touch input, with clear labels and visible focus state.
- **FR-036**: The app MUST remain usable on common phone and desktop viewport sizes without hiding any core workflow.

### Key Entities

- **Bookmark**: A unique saved destination containing a required title and normalized web address; optional description, site icon, preview image, and formatted notes; zero or more tags; favorite, read, and archive states; and created and last-updated times.
- **Tag**: A normalized organizational label associated with one or more bookmarks. A bookmark can have multiple tags, a tag can belong to multiple bookmarks, and previously used tags are available as entry suggestions.
- **Page Details**: Title, short description, site icon, and preview image retrieved from the bookmark destination when available. Retrieved text can be replaced by the user.
- **Collection View State**: The current collection context, search expression, selected filters, and sort field and direction. This changes what is displayed without changing the bookmarks themselves.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of first-time test participants can paste and save a valid bookmark without assistance in under 30 seconds when the destination exposes usable page details.
- **SC-002**: For a representative test set of 100 reachable pages that expose a title and description, at least 95% populate the available title and description within 5 seconds; failures leave the form usable for manual completion.
- **SC-003**: In all acceptance tests covering equivalent-address variations and both active and archived states, a duplicate save attempt creates zero new bookmarks and reaches the existing bookmark in no more than one additional action.
- **SC-004**: A user can locate and open a known bookmark from a collection of 1,000 items in under 10 seconds using plain text, exact phrases, tag conditions, Boolean combinations, or filters.
- **SC-005**: Search, filtering, sorting, read-status changes, favoriting, archiving, restoring, and deletion produce visible feedback within 1 second under normal use with 1,000 bookmarks.
- **SC-006**: In acceptance testing, 100% of bookmarks marked read leave the To Read view while remaining active, and 100% of archived bookmarks leave active views while remaining recoverable from Archive.
- **SC-007**: All core workflows can be completed at phone widths of 320 pixels and above and at desktop widths without horizontal page scrolling.
- **SC-008**: All successfully saved bookmarks, formatted notes, states, and display preferences remain present after closing and reopening the app in the same user environment.
- **SC-009**: At least 90% of test participants rate the ease of saving, organizing, and finding bookmarks as 4 or higher on a 5-point scale.

## Assumptions

- Version 1 is a private, single-user experience; accounts, authentication, sharing, collaboration, and permission roles remain outside this feature.
- Bookmark data is retained in the same user environment. The app is usable on phone and desktop layouts, but cross-device synchronization and cloud backup remain outside this feature.
- Page-detail retrieval depends on the destination being reachable and exposing usable information. Title and description are attempted automatically; site icons and preview images are optional and use a neutral fallback when unavailable.
- New bookmarks default to not marked To read; the user can select To read while saving or at any later time.
- “Date” sorting includes both date added and date updated, with newest-first and oldest-first choices; title sorting includes A–Z and Z–A.
- Search operators are shown in the interface with examples so users do not need prior knowledge of the syntax.
- Browser extensions, bookmarklet capture, bulk browser import or export, folders, nested collections, automated broken-link checking, and full offline copies of destination pages remain outside this feature.
- The initial release is a responsive web application intended for current mainstream desktop and mobile browsers.
