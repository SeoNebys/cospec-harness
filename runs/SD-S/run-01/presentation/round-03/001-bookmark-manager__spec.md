# Feature Specification: Personal Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-16

**Status**: Approved

**Input**: User description: "I want to build an app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save and Revisit Bookmarks (Priority: P1)

As an individual user, I want to save a web address with a recognizable title and optional notes so that I can return to useful content later.

**Why this priority**: Saving and reopening links is the minimum useful bookmark-management experience.

**Independent Test**: Save a valid web address, find it in the collection, and open it. This delivers a usable bookmark list without requiring any organizational features.

**Acceptance Scenarios**:

1. **Given** the user is viewing their collection, **When** they enter a valid web address and a title and save it, **Then** the new bookmark appears in the collection with its saved details.
2. **Given** a saved bookmark exists, **When** the user chooses to visit it, **Then** the bookmarked destination opens without losing the user's place in the collection.
3. **Given** the user enters an invalid or unsupported web address, **When** they attempt to save it, **Then** the bookmark is not saved and the user receives clear guidance for correcting it.

---

### User Story 2 - Find and Organize Bookmarks (Priority: P2)

As a user with a growing collection, I want to search, tag, filter, sort, and favorite bookmarks so that I can quickly locate the item I need.

**Why this priority**: A bookmark collection loses value when useful links become difficult to retrieve.

**Independent Test**: Create bookmarks with different titles, addresses, notes, tags, and favorite states, then verify that searches, filters, and sorting return the expected subset and order.

**Acceptance Scenarios**:

1. **Given** bookmarks with different titles, addresses, notes, and tags, **When** the user searches for matching text, **Then** only relevant bookmarks are shown.
2. **Given** bookmarks assigned to different tags, **When** the user filters by a tag, **Then** only bookmarks carrying that tag are shown.
3. **Given** favorite and non-favorite bookmarks, **When** the user selects the favorites filter, **Then** only favorite bookmarks are shown.
4. **Given** a filtered or unfiltered collection, **When** the user changes the sort order, **Then** the visible bookmarks are reordered by the chosen option.

---

### User Story 3 - Maintain the Collection (Priority: P3)

As a user, I want to update, archive, restore, and permanently delete bookmarks so that my collection stays accurate and uncluttered.

**Why this priority**: Ongoing maintenance keeps the collection trustworthy while protecting users from accidental loss.

**Independent Test**: Edit an existing bookmark, archive it, restore it, archive it again, and permanently delete it after confirming the destructive action.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user changes its title, address, notes, or tags, **Then** the updated details are shown throughout the collection.
2. **Given** an active bookmark, **When** the user archives it, **Then** it leaves the active collection and remains available in the archive.
3. **Given** an archived bookmark, **When** the user restores it, **Then** it returns to the active collection with its details intact.
4. **Given** an archived bookmark, **When** the user requests permanent deletion, **Then** the app requires confirmation before removing it and clearly communicates completion or cancellation.

### Edge Cases

- Saving a web address that already exists in the active collection warns the user and lets them keep the existing bookmark or intentionally save another copy.
- Leading and trailing spaces in entered titles, addresses, notes, and tags do not create misleading differences.
- An empty collection, an empty archive, and a search or filter with no matches each display a clear next step.
- A bookmark remains manageable even when its destination is unavailable; destination availability does not erase the saved record.
- Long titles, addresses, notes, and numerous tags remain readable and do not prevent core actions.
- Combining search text with tag or favorite filters applies all selected criteria and makes those criteria visible.
- If a save or update cannot be completed, the user is informed and their entered information remains available for correction or retry.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST allow the user to create a bookmark with a valid web address and a required, non-blank title.
- **FR-002**: The app MUST allow each bookmark to include optional notes and zero or more tags.
- **FR-003**: The app MUST preserve each bookmark's address, title, notes, tags, favorite state, archive state, creation time, and last-updated time between user sessions.
- **FR-004**: The app MUST display the active bookmark collection with enough information to identify each bookmark and access its primary actions.
- **FR-005**: The user MUST be able to open a saved destination while retaining their current collection context.
- **FR-006**: The user MUST be able to edit a bookmark's address, title, notes, and tags.
- **FR-007**: The user MUST be able to mark and unmark a bookmark as a favorite.
- **FR-008**: The user MUST be able to search active bookmarks by title, address, notes, and tags without case sensitivity.
- **FR-009**: The user MUST be able to filter active bookmarks by tag and favorite state, and clear active filters.
- **FR-010**: The user MUST be able to sort the visible collection by newest created, oldest created, most recently updated, and title.
- **FR-011**: The app MUST allow a user to archive an active bookmark without deleting its saved details.
- **FR-012**: The app MUST provide a separate archive view from which bookmarks can be restored or selected for permanent deletion.
- **FR-013**: The app MUST require explicit confirmation before permanently deleting a bookmark.
- **FR-014**: The app MUST validate web addresses before saving and provide a specific, actionable message when required data is missing or invalid.
- **FR-015**: When a submitted web address duplicates an active bookmark, the app MUST warn the user and require an explicit choice before creating a duplicate.
- **FR-016**: The app MUST provide distinct, helpful empty states for a new collection, an empty archive, and a search or filter with no matches.
- **FR-017**: The app MUST communicate whether create, update, archive, restore, favorite, and delete actions succeeded or failed.
- **FR-018**: All primary bookmark-management tasks MUST be usable on both small-screen and large-screen devices.

### Key Entities

- **Bookmark**: A saved web destination with a title, address, optional notes, zero or more tags, favorite status, archive status, creation time, and last-updated time.
- **Tag**: A user-defined organizational label. A tag can be attached to many bookmarks, and a bookmark can have many tags.
- **Collection View State**: The user's current search text, selected filters, sort order, and active or archived view; it controls presentation but does not alter bookmark content.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In usability testing, at least 90% of first-time users can save and reopen a bookmark without assistance in under 60 seconds.
- **SC-002**: Users can locate a known bookmark in a collection of 1,000 items using search or filters in under 10 seconds, and visible results update within 1 second of an input change under normal conditions.
- **SC-003**: At least 95% of tested create, edit, favorite, archive, restore, and confirmed-delete attempts produce the expected visible collection state.
- **SC-004**: At least 90% of usability-test participants can identify which search and filter criteria are active and return to the full active collection without assistance.
- **SC-005**: All primary tasks—save, find, open, edit, favorite, archive, restore, and delete—can be completed at representative small-screen and large-screen sizes without horizontal page scrolling.
- **SC-006**: No bookmark is permanently removed during testing without a distinct confirmation action from the user.

## Assumptions

- The first release serves one individual user and one personal collection; user accounts, authentication, team workspaces, sharing, and permissions are out of scope.
- The first release is an online application used through a modern browser on small-screen and large-screen devices.
- Users supply the bookmark title and optional notes; automatically fetching page titles, descriptions, thumbnails, or icons is out of scope.
- Bulk import/export, browser extensions, bookmark syncing with other services, nested folders, link-health monitoring, and offline use are out of scope.
- Search covers the user's saved bookmark data only; it does not search the contents of destination pages.
- A duplicate is determined by the normalized web address within the active collection; archived matches do not block saving.
- Tags are user-entered labels rather than a separately managed hierarchy.
