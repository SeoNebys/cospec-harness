# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-18

**Status**: Draft — awaiting client approval

**Input**: User description: "I want to build an app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save and revisit bookmarks (Priority: P1)

As a user, I want to save a web address with useful identifying details and open it later so that I do not lose resources I care about.

**Why this priority**: Saving and reopening links is the core value of a bookmark manager.

**Independent Test**: Save a valid web address, confirm it appears in the bookmark collection with its title, and open it from the collection.

**Acceptance Scenarios**:

1. **Given** the bookmark collection is available, **When** the user submits a valid web address and title, **Then** the bookmark is saved and appears in the collection.
2. **Given** a saved bookmark exists, **When** the user selects its web address, **Then** the destination opens without losing the bookmark collection.
3. **Given** an invalid or incomplete web address, **When** the user attempts to save it, **Then** the app explains the problem and preserves the entered information for correction.

---

### User Story 2 - Find and organize bookmarks (Priority: P2)

As a user, I want to search, tag, filter, and sort my bookmarks so that I can quickly locate a saved resource as my collection grows.

**Why this priority**: A bookmark collection becomes useful over time only if its contents remain easy to retrieve.

**Independent Test**: Create bookmarks with different titles, web addresses, descriptions, and tags; then verify that search, tag filtering, and sorting return the expected items.

**Acceptance Scenarios**:

1. **Given** several saved bookmarks, **When** the user searches for text found in a title, web address, description, or tag, **Then** only matching bookmarks are shown.
2. **Given** bookmarks with different tags, **When** the user filters by one or more tags, **Then** the collection shows bookmarks matching every selected tag.
3. **Given** several saved bookmarks, **When** the user chooses a supported sort order, **Then** the visible collection is ordered by date saved, title, or most recently updated as selected.
4. **Given** no bookmark matches the current search or filters, **When** results are displayed, **Then** the app shows a clear empty state and offers a way to clear the search or filters.

---

### User Story 3 - Maintain the collection (Priority: P3)

As a user, I want to update, favorite, archive, and delete bookmarks so that the collection stays accurate and focused.

**Why this priority**: Ongoing maintenance prevents outdated or lower-value items from overwhelming the active collection.

**Independent Test**: Edit a bookmark, mark it as a favorite, archive and restore it, then delete it with confirmation and verify each state change.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user changes its title, web address, description, or tags, **Then** the updated values are shown and retained.
2. **Given** a saved bookmark, **When** the user marks or unmarks it as a favorite, **Then** its favorite state changes and it can be filtered accordingly.
3. **Given** an active bookmark, **When** the user archives it, **Then** it leaves the active collection and remains available in an archived view where it can be restored.
4. **Given** a saved bookmark, **When** the user chooses to delete it, **Then** the app asks for confirmation before permanently removing it.

### Edge Cases

- Saving a web address that already exists warns the user and points to the existing bookmark rather than silently creating a duplicate.
- Titles, descriptions, and tags containing punctuation, accented characters, or emoji remain searchable and display correctly.
- Leading and trailing whitespace is ignored when validating fields and tags; tags that differ only by letter case are treated as the same tag.
- A bookmark may have no description or tags, but must have both a title and valid web address.
- Long titles and web addresses remain readable without breaking collection navigation.
- Search and filter controls remain usable when the collection is empty or contains no matching bookmarks.
- If a save or update cannot be completed, the user sees a clear error and their unsaved edits remain available to retry.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST allow the user to save a bookmark with a valid web address and a title.
- **FR-002**: The app MUST allow an optional plain-text description and zero or more tags for each bookmark.
- **FR-003**: The app MUST reject invalid web addresses with an actionable message and MUST preserve the user's entered values for correction.
- **FR-004**: The app MUST detect an already-saved normalized web address and warn the user before any duplicate is created.
- **FR-005**: The app MUST display active bookmarks with their title, destination, tags, favorite state, and date saved.
- **FR-006**: The user MUST be able to open a bookmark's destination while retaining access to the bookmark collection.
- **FR-007**: The user MUST be able to edit a bookmark's title, web address, description, and tags.
- **FR-008**: The user MUST be able to mark and unmark a bookmark as a favorite and filter the collection by favorite status.
- **FR-009**: The user MUST be able to archive an active bookmark, view archived bookmarks separately, and restore an archived bookmark.
- **FR-010**: The user MUST be able to permanently delete a bookmark only after confirming the action.
- **FR-011**: The app MUST support case-insensitive search across bookmark titles, web addresses, descriptions, and tags.
- **FR-012**: The app MUST allow filtering by one or more tags, with results matching every selected tag.
- **FR-013**: The app MUST allow bookmarks to be sorted by date saved, title, or most recently updated.
- **FR-014**: The app MUST show clear empty states for an empty collection and for searches or filters with no matches.
- **FR-015**: The app MUST retain saved bookmarks and their organization state between user sessions on the same app installation.
- **FR-016**: The app MUST record when each bookmark was created and most recently updated.
- **FR-017**: The app MUST make primary bookmark actions usable with keyboard-only navigation as well as pointer input.
- **FR-018**: The app MUST present readable labels, visible focus states, and status or validation feedback that does not depend on color alone.

### Key Entities

- **Bookmark**: A saved resource with a web address, title, optional description, zero or more tags, favorite status, active or archived status, creation time, and most recent update time.
- **Tag**: A normalized organizational label associated with one or more bookmarks. A bookmark may have multiple tags, and a tag may belong to multiple bookmarks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of first-time test users can save and reopen a bookmark without assistance in under 60 seconds.
- **SC-002**: Users can locate a known bookmark in a collection of 1,000 items using search or tags in under 10 seconds.
- **SC-003**: Search, filter, sort, save, and update results are visibly reflected within 1 second for a collection of 10,000 bookmarks under normal operating conditions.
- **SC-004**: In acceptance testing, 100% of valid bookmark changes remain available after closing and reopening the app.
- **SC-005**: In usability testing, at least 90% of participants successfully edit, archive and restore, favorite, and delete a bookmark on their first attempt without assistance.
- **SC-006**: All primary bookmark workflows can be completed using only a keyboard, with the current interaction target always visually identifiable.

## Assumptions

- The first release is a personal, single-user bookmark manager; accounts, collaboration, sharing, and permissions are outside this feature's scope.
- Users enter the bookmark title themselves; automatic page-title or preview retrieval is outside the initial scope.
- Import from browsers or other services, export, browser extensions, offline page copies, and link-health monitoring are outside the initial scope.
- Bookmarks are retained on the app installation where they were created; cross-device synchronization is outside the initial scope.
- The app accepts standard web destinations using `http` or `https`; other destination types are outside the initial scope.
- Permanent deletion is not reversible after the user confirms it.
