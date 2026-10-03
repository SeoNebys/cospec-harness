# Feature Specification: Bookmark Manager

**Feature Branch**: `[001-bookmark-manager]`

**Created**: 2026-09-24

**Status**: Draft

**Input**: User description: "I want to build an app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a Bookmark (Priority: P1)

As a user, I want to save a web address with useful identifying details so that I can return to it later.

**Why this priority**: Saving links is the essential value of a bookmark manager; without it, no other management feature is useful.

**Independent Test**: Save a valid web address with a title and optional notes and tags, then confirm it appears in the bookmark library with the entered details.

**Acceptance Scenarios**:

1. **Given** the bookmark library is available, **When** the user saves a valid web address and title, **Then** the bookmark appears in the library with its address, title, and saved date.
2. **Given** the user is entering a bookmark, **When** they add optional notes and one or more tags, **Then** those details are stored and displayed with the bookmark.
3. **Given** the entered web address is missing or invalid, **When** the user attempts to save it, **Then** the bookmark is not created and the user receives a clear explanation of how to correct the entry.
4. **Given** the web address already exists in the library, **When** the user attempts to save it again, **Then** the app identifies the existing bookmark and lets the user open or update it without silently creating a duplicate.

---

### User Story 2 - Find Saved Bookmarks (Priority: P2)

As a user, I want to browse, search, filter, and sort my bookmarks so that I can quickly find a saved resource.

**Why this priority**: A growing bookmark collection is valuable only if users can reliably retrieve what they saved.

**Independent Test**: Populate a library with bookmarks that have different titles, addresses, notes, tags, and saved dates; then verify that browsing, search, tag filtering, and sorting each produce the expected results.

**Acceptance Scenarios**:

1. **Given** the user has saved bookmarks, **When** they open the library, **Then** they see the collection ordered with the most recently saved bookmarks first by default.
2. **Given** bookmarks contain different titles, addresses, notes, and tags, **When** the user searches for a matching term, **Then** only bookmarks containing that term in one or more of those fields are shown.
3. **Given** bookmarks have different tags, **When** the user selects a tag filter, **Then** only bookmarks carrying that tag are shown.
4. **Given** the library is displayed, **When** the user selects an available sort order, **Then** the visible bookmarks are reordered by title, date saved, or date last updated.
5. **Given** no bookmarks match the active search or filters, **When** results are evaluated, **Then** the user sees a clear empty state and can remove the active criteria.

---

### User Story 3 - Update and Remove Bookmarks (Priority: P3)

As a user, I want to correct, reorganize, or remove saved bookmarks so that my library remains accurate and useful.

**Why this priority**: Ongoing maintenance prevents stale metadata and unwanted entries from reducing the usefulness of the collection.

**Independent Test**: Edit each bookmark field, confirm the changes persist, then delete the bookmark through a confirmation step and verify it no longer appears in the library or search results.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user changes its address, title, notes, or tags and saves, **Then** the updated details appear throughout the library and its last-updated date changes.
2. **Given** an existing bookmark, **When** the user starts deletion, **Then** the app asks for confirmation before permanently removing it.
3. **Given** the user confirms deletion, **When** the operation completes, **Then** the bookmark no longer appears in browsing, searches, or tag-filtered results.
4. **Given** the user cancels deletion, **When** they return to the library, **Then** the bookmark remains unchanged.

### Edge Cases

- A bookmark title, notes field, or tag contains leading or trailing whitespace, mixed capitalization, punctuation, or non-Latin characters.
- A valid address is unusually long, contains query parameters or fragments, or uses an uppercase host name.
- The same address is entered in a textually different but equivalent form; the app should apply one consistent duplicate-detection rule and explain any detected match.
- A search term contains no characters after surrounding whitespace is removed; the app should treat it as no search rather than an error.
- A tag selected as a filter is removed from all bookmarks; the obsolete filter should not leave the user trapped in an unexplained empty state.
- The library contains no bookmarks; the app should explain how to add the first one.
- An operation cannot be completed; the user should see a clear error, retain their entered information where possible, and be able to retry safely.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST allow the user to create a bookmark with a valid web address and a non-empty title.
- **FR-002**: The app MUST allow optional notes and zero or more tags to be associated with each bookmark.
- **FR-003**: The app MUST reject missing or invalid required values with a field-specific, actionable explanation and MUST preserve valid values already entered.
- **FR-004**: The app MUST detect an address that matches an existing bookmark under a consistent normalization rule and MUST direct the user to the existing item rather than silently creating a duplicate.
- **FR-005**: The app MUST present all saved bookmarks in a browsable library, ordered by most recently saved first by default.
- **FR-006**: The app MUST allow case-insensitive search across bookmark titles, addresses, notes, and tags.
- **FR-007**: The app MUST allow the library to be filtered by tag and MUST clearly identify and remove active filters.
- **FR-008**: The app MUST allow visible bookmarks to be sorted by title, date saved, or date last updated.
- **FR-009**: The app MUST allow the user to edit a bookmark's address, title, notes, and tags while retaining its original saved date and updating its last-updated date.
- **FR-010**: The app MUST require explicit confirmation before permanently deleting a bookmark.
- **FR-011**: After deletion, the app MUST remove the bookmark from the library and all search and filter results.
- **FR-012**: The app MUST provide informative empty states for an empty library and for searches or filters with no matches.
- **FR-013**: Saved bookmarks and their metadata MUST remain available to the same user across app restarts and ordinary device restarts.
- **FR-014**: Tags MUST be treated case-insensitively for grouping and filtering while preserving a consistent display label.
- **FR-015**: The app MUST provide a direct action to open a saved address in the user's web-browsing context.

### Key Entities

- **Bookmark**: A saved web resource with a unique identifier, web address, title, optional notes, zero or more tags, date saved, and date last updated.
- **Tag**: A user-defined organizational label associated with one or more bookmarks; tags with capitalization differences represent the same organizational label.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of first-time users can save their first valid bookmark without assistance in under 60 seconds.
- **SC-002**: Users can locate a known bookmark in a library of 1,000 items using search or tag filtering in under 10 seconds in at least 95% of usability trials.
- **SC-003**: Saving, editing, searching, filtering, sorting, opening, and deleting bookmarks each produce visible feedback within 1 second for a library of up to 10,000 bookmarks under normal operating conditions.
- **SC-004**: In acceptance testing, 100% of successfully saved bookmarks remain available with unchanged user-entered details after the app is restarted.
- **SC-005**: In acceptance testing, duplicate-address attempts, invalid required fields, empty results, and failed operations each produce a clear next step for the user.
- **SC-006**: At least 90% of representative users complete the core save-find-open journey on their first attempt without external guidance.

## Assumptions

- The first release serves one user with a private bookmark collection; accounts, multi-user permissions, and sharing are outside this feature's scope.
- The initial experience is intended for a general-purpose screen-based app with a keyboard-and-pointer-friendly interface; dedicated mobile apps are outside this feature's scope.
- Users enter bookmark titles themselves. Automatically retrieving page titles, preview images, favicons, page content, or link-health status is outside this feature's scope.
- Import from browsers or other bookmark services, export, folders, nested collections, favorites, archiving, bulk operations, and browser extensions are outside this feature's scope.
- Only web addresses intended for normal browser navigation are supported; saving local files, executable commands, or arbitrary application protocols is outside this feature's scope.
- Permanent deletion after explicit confirmation is acceptable for the first release; a recycle bin and recovery workflow are outside this feature's scope.
- The user's device provides the web-browsing context used to open a bookmark.
