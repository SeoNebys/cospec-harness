# Feature Specification: Bookmark Management

**Feature Branch**: `[001-manage-bookmarks]`

**Created**: 2026-09-24

**Status**: Draft

**Input**: User description: "Build an app to save and manage bookmarks, automatically gather page details and imagery, support a read-later workflow, and archive bookmarks separately from permanent deletion."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save Enriched Bookmarks (Priority: P1)

As a user, I can save a web address and have its title, description, site icon, and available preview image gathered for me, then update or remove it, so my bookmark library is informative and easy to scan without repetitive data entry.

**Why this priority**: Saving and maintaining links is the core value of a bookmark manager and provides a viable first release on its own.

**Independent Test**: Save a valid public web address with page metadata, verify that the gathered details appear in the library, update its editable details, and delete it. This delivers a complete basic bookmark-management flow without relying on search or organization features.

**Acceptance Scenarios**:

1. **Given** the user enters a valid public web address, **When** the page can be inspected, **Then** the app gathers the available page title, description, site icon, and preview image and shows them for review before saving.
2. **Given** gathered page information is shown, **When** the user changes the title or description, **Then** the user's changes are retained when the bookmark is saved.
3. **Given** some or all page information is missing or cannot be gathered, **When** the user saves the bookmark, **Then** the app preserves the entered address, allows manual title and description entry, uses a clear fallback for missing imagery, and explains the limitation without blocking creation.
4. **Given** a bookmark is saved, **When** it appears in the library, **Then** its title, destination, available description and imagery, reading status, and creation date are presented in a scannable form.
5. **Given** a bookmark already exists, **When** the user changes its title, address, description, notes, favorite status, reading status, or tags, **Then** the updated values are shown throughout the library.
6. **Given** a bookmark exists, **When** the user confirms its permanent deletion, **Then** it no longer appears in either the active or archived library.
7. **Given** the user starts permanently deleting a bookmark, **When** the user cancels the confirmation, **Then** the bookmark remains unchanged.

---

### User Story 2 - Manage a Read-Later List (Priority: P2)

As a user, I can distinguish bookmarks I still want to read from those I have finished, so saved reading does not become an undifferentiated list.

**Why this priority**: Returning to unread material is a primary reason to save links and is distinct from marking a link as important.

**Independent Test**: Save bookmarks with different reading states, view only the to-read bookmarks, mark one as read, and verify that it leaves the to-read view while remaining saved.

**Acceptance Scenarios**:

1. **Given** the user creates a bookmark without changing its reading status, **When** it is saved, **Then** it is marked as to-read by default.
2. **Given** active bookmarks have mixed reading states, **When** the user selects the to-read view, **Then** only active bookmarks marked to-read are shown.
3. **Given** a bookmark is marked to-read, **When** the user marks it as read, **Then** it no longer appears in the to-read view but remains in the active library.
4. **Given** a bookmark is marked read, **When** the user marks it as to-read again, **Then** it returns to the to-read view.
5. **Given** a bookmark is a favorite, **When** its reading status changes, **Then** its favorite status remains unchanged.

---

### User Story 3 - Archive Without Deleting (Priority: P2)

As a user, I can archive bookmarks I no longer want in my main library, review them separately, and restore them later, so cleanup does not require permanent deletion.

**Why this priority**: Archiving supports safe ongoing maintenance and keeps the main library focused without destroying information.

**Independent Test**: Archive an active bookmark, verify that it disappears from normal and to-read views and appears in the archive, then restore it with its information and statuses intact.

**Acceptance Scenarios**:

1. **Given** an active bookmark, **When** the user archives it, **Then** it leaves the main library and appears in the archived view.
2. **Given** an archived bookmark, **When** the user restores it, **Then** it returns to the main library with its details, tags, favorite status, and reading status intact.
3. **Given** archived bookmarks exist, **When** the user views the archive, **Then** only archived bookmarks are shown and they can be searched, filtered, and sorted there.
4. **Given** an archived bookmark, **When** the user chooses permanent deletion and confirms it, **Then** the bookmark is removed from the archive and cannot be restored through the app.

---

### User Story 4 - Find a Saved Bookmark (Priority: P2)

As a user, I can search, filter, and sort my bookmarks so I can quickly find a link as my library grows.

**Why this priority**: Retrieval is the main reason to maintain a bookmark collection and becomes essential once the library contains more than a few items.

**Independent Test**: Populate the library with varied titles, addresses, descriptions, notes, tags, favorite states, and reading states, then verify that search, filters, and sort choices return the expected bookmarks.

**Acceptance Scenarios**:

1. **Given** the library contains multiple bookmarks, **When** the user searches for text found in a title, address, description, note, or tag, **Then** only matching bookmarks are shown.
2. **Given** the library contains bookmarks with varied tags, favorite states, and reading states, **When** the user applies one of those filters, **Then** only bookmarks satisfying the active filter are shown.
3. **Given** search text and a filter are both active, **When** results are displayed, **Then** every result satisfies both conditions.
4. **Given** the library contains multiple bookmarks, **When** the user sorts by date added, title, or most recently updated, **Then** the displayed order matches that selection.
5. **Given** no bookmarks match the active search and filters, **When** results are displayed, **Then** the user sees a clear empty state and can reset the active criteria.

---

### User Story 5 - Organize with Tags and Favorites (Priority: P3)

As a user, I can label bookmarks with reusable tags and mark important bookmarks as favorites so I can organize links according to my own workflow.

**Why this priority**: Lightweight organization improves a growing library while avoiding the hierarchy and maintenance burden of folders in the initial release.

**Independent Test**: Add and remove tags on bookmarks, mark and unmark favorites, and verify the changes are visible and available as filters.

**Acceptance Scenarios**:

1. **Given** a user is creating or editing a bookmark, **When** the user adds one or more tags, **Then** the tags are associated with that bookmark and available for reuse.
2. **Given** equivalent tags differ only by letter case or surrounding spaces, **When** the user saves them, **Then** the app treats them as one tag rather than creating duplicates.
3. **Given** a bookmark is not a favorite, **When** the user marks it as a favorite, **Then** its favorite state is visibly reflected and can be used as a filter.
4. **Given** a tag is removed from a bookmark, **When** no other bookmark uses that tag, **Then** the unused tag is no longer offered as a library filter.

### Edge Cases

- An address is rejected with a clear explanation when it is empty, malformed, or does not use a supported web protocol.
- If the same normalized web address is already saved, the user is warned and can either open the existing bookmark for editing or intentionally save another copy.
- Leading and trailing spaces in titles, addresses, notes, searches, and tags do not create misleading values or prevent expected matches.
- Long titles, addresses, and notes remain readable without breaking the library layout; input limits are communicated before data is lost.
- Search is case-insensitive and handles punctuation and non-English text consistently.
- Removing a filter or clearing a search restores the appropriate library results.
- A failed attempt to inspect a web page does not prevent manual bookmark creation.
- Metadata gathering that returns only some fields saves the available information and provides clear fallbacks for fields that are absent.
- Archiving or restoring a bookmark preserves its reading state, favorite status, tags, notes, and gathered page information.
- Archived bookmarks do not appear in the main library, to-read view, or active-library search results.
- Destructive actions require confirmation and cannot occur from a single accidental selection.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow users to create a bookmark with a valid HTTP or HTTPS address and a title.
- **FR-002**: The system MUST allow a bookmark to include a title, optional description, optional notes, zero or more tags, a favorite status, a reading status, and an archive status.
- **FR-003**: On submission of a web address, the system MUST attempt to gather the destination page's title, description, site icon, and preview image before saving.
- **FR-004**: The system MUST let the user review and edit the gathered title and description before saving and MUST provide usable fallbacks when page information or imagery is unavailable.
- **FR-005**: The system MUST validate required bookmark information before saving and explain how the user can correct invalid information.
- **FR-006**: The system MUST warn users when the normalized address matches an existing active or archived bookmark and MUST let them choose between opening the existing bookmark for editing and intentionally saving a duplicate.
- **FR-007**: The system MUST display active bookmarks in a browsable main library with, at minimum, title, destination host, available description and imagery, tags, favorite status, reading status, and date added.
- **FR-008**: Users MUST be able to open a saved bookmark's destination from the library.
- **FR-009**: Users MUST be able to edit a bookmark's title, address, description, notes, tags, favorite status, and reading status.
- **FR-010**: New bookmarks MUST default to a to-read status, and users MUST be able to switch any bookmark between to-read and read.
- **FR-011**: Users MUST be able to view only active bookmarks marked to-read.
- **FR-012**: Users MUST be able to archive an active bookmark without deleting it, and archived bookmarks MUST be excluded from the main library, the to-read view, and active-library searches.
- **FR-013**: Users MUST be able to view archived bookmarks separately and restore them with all bookmark information and statuses preserved.
- **FR-014**: Users MUST be able to permanently delete an active or archived bookmark only after confirming the destructive action.
- **FR-015**: Users MUST be able to search bookmarks using text found in titles, addresses, descriptions, notes, or tags.
- **FR-016**: Users MUST be able to filter the applicable active or archived view by one tag, favorite status, or reading status.
- **FR-017**: Search text and active filters MUST combine so that results satisfy all active criteria.
- **FR-018**: Users MUST be able to sort bookmarks by date added, title, or most recently updated.
- **FR-019**: The system MUST provide distinct, actionable empty states for an empty library, an empty archive, an empty to-read view, and search or filter criteria with no matches.
- **FR-020**: The system MUST normalize tag capitalization and surrounding whitespace to prevent duplicate tags that are visually equivalent.
- **FR-021**: The system MUST preserve saved bookmarks, gathered page information, and all organization and status values between user sessions on the same configured installation.
- **FR-022**: The system MUST clearly communicate failures without discarding valid information the user has already entered.

### Key Entities

- **Bookmark**: A saved web destination, including its address, title, optional description and notes, available site icon and preview image, favorite status, reading status (to-read or read), archive status, date added, most recent update date, and associated tags.
- **Tag**: A reusable user-defined label associated with one or more bookmarks; its normalized name is unique within the library.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of first-time users can save their first bookmark without assistance in under one minute.
- **SC-002**: Users can locate and open a known bookmark from a library of 1,000 bookmarks in under 15 seconds using search or filters.
- **SC-003**: Search, filtering, and sorting show the correct bookmark set and order in 100% of defined acceptance-scenario tests.
- **SC-004**: At least 95% of users in usability testing can edit, favorite, tag, change reading status, archive, restore, and permanently delete a bookmark on their first attempt without assistance.
- **SC-005**: The library remains usable with at least 10,000 saved bookmarks, with updated search or filter results visible within two seconds of a user action under normal operating conditions.
- **SC-006**: No confirmed, successfully saved bookmark changes are lost after the user leaves and returns to the app in persistence testing.
- **SC-007**: For pages that publicly expose a title, description, site icon, or preview image, at least 95% of available fields are correctly gathered and shown for review during bookmark creation.
- **SC-008**: Users can move a bookmark between to-read and read states, or between active and archived states, in no more than two interactions from its current library view.

## Assumptions

- The initial release serves one personal bookmark library per configured installation; multi-user accounts, sharing, permissions, and collaborative collections are outside this feature's scope.
- The initial release is an online-capable application intended for current desktop and mobile web browsers.
- HTTP and HTTPS web addresses are supported; other address schemes are outside scope.
- Tags, favorites, reading status, and archiving provide the initial organization model; folders, nested collections, and custom taxonomies are outside scope.
- A newly saved bookmark is considered to-read unless the user explicitly marks it read during creation.
- Page descriptions and preview images are saved only when exposed by the destination page; absent or inaccessible metadata is represented by a non-blocking fallback rather than synthesized content.
- Importing from browsers or external services, exporting, browser extensions, and automated broken-link monitoring are outside scope for the initial release.
- Opening a bookmark may navigate away from the app or open another browser context according to the user's browser behavior.
- Users are responsible for the content at external destinations; the app stores and manages references to those destinations rather than copying their content.
