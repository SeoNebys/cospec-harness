# Feature Specification: Bookmark Manager

**Feature Branch**: `[001-manage-bookmarks]`

**Created**: 2026-09-23

**Status**: Draft

**Input**: User description: "I want to build an app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save and revisit bookmarks (Priority: P1)

As a user, I can save a web address with a title and later open it from my bookmark collection so that useful pages are easy to revisit.

**Why this priority**: Saving and reopening links is the minimum useful bookmark-management experience.

**Independent Test**: Save a valid web address, confirm it appears in the collection with its title, and open it to reach the saved destination.

**Acceptance Scenarios**:

1. **Given** the bookmark collection is visible, **When** the user submits a valid web address and title, **Then** the bookmark is saved and appears in the collection.
2. **Given** a saved bookmark exists, **When** the user chooses to open it, **Then** the saved destination opens without changing the bookmark record.
3. **Given** the user submits a missing or invalid web address, **When** the save is attempted, **Then** no bookmark is created and the user receives a clear correction message.

---

### User Story 2 - Find and organize bookmarks (Priority: P2)

As a user, I can add tags and search or filter my collection so that I can quickly locate a bookmark as the collection grows.

**Why this priority**: A bookmark collection loses value when saved items cannot be found efficiently.

**Independent Test**: Add tags to several bookmarks, then verify that text search and tag filtering each return only matching bookmarks and can be cleared.

**Acceptance Scenarios**:

1. **Given** bookmarks with different titles, addresses, notes, and tags exist, **When** the user enters a search term, **Then** the collection shows bookmarks matching that term in any of those fields.
2. **Given** bookmarks have different tags, **When** the user selects a tag filter, **Then** only bookmarks carrying that tag are shown.
3. **Given** search or filters are active, **When** the user clears them, **Then** the full collection is shown again.
4. **Given** no bookmarks match the current search or filter, **When** results are displayed, **Then** the user sees a clear empty-results state and can reset the criteria.

---

### User Story 3 - Maintain the collection (Priority: P3)

As a user, I can edit, favorite, archive, and delete bookmarks so that the collection stays accurate and useful over time.

**Why this priority**: Ongoing maintenance prevents stale, incorrect, or low-value items from overwhelming the collection.

**Independent Test**: Modify a bookmark, mark it as a favorite, archive and restore it, then delete it with confirmation and verify each state change is reflected in the collection.

**Acceptance Scenarios**:

1. **Given** a saved bookmark exists, **When** the user changes its title, address, notes, or tags with valid values, **Then** the updated values replace the previous values.
2. **Given** a saved bookmark exists, **When** the user marks or unmarks it as a favorite, **Then** its favorite state changes and can be used to filter the collection.
3. **Given** an active bookmark exists, **When** the user archives it, **Then** it leaves the active collection and remains available in the archived collection.
4. **Given** an archived bookmark exists, **When** the user restores it, **Then** it returns to the active collection.
5. **Given** a saved bookmark exists, **When** the user requests deletion, **Then** the app asks for confirmation and permanently removes it only after confirmation.

### Edge Cases

- Leading and trailing whitespace is removed from bookmark fields before validation and saving.
- Web addresses without an explicit scheme are interpreted as secure web addresses when they otherwise resemble a valid host; unsupported or malformed addresses are rejected.
- Saving an address that already exists in the same collection warns the user and offers to update the existing bookmark instead of silently creating a duplicate.
- Titles, notes, or tags containing punctuation, emoji, or non-Latin characters remain searchable and display correctly.
- Search is case-insensitive and treats an empty or whitespace-only query as no search.
- A deleted bookmark disappears from active, archived, favorite, search, and filtered views.
- If a bookmark destination is unavailable, the saved bookmark remains intact; destination availability is outside the app's control.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST let users save a bookmark with a valid web address and a title.
- **FR-002**: The app MUST let users optionally add notes and one or more reusable tags to a bookmark.
- **FR-003**: The app MUST validate required values and show actionable messages without creating or overwriting a bookmark when validation fails.
- **FR-004**: The app MUST display active bookmarks in a collection showing, at minimum, title, destination, tags, favorite state, and date saved.
- **FR-005**: Users MUST be able to open a saved destination from its bookmark.
- **FR-006**: Users MUST be able to edit a bookmark's title, destination, notes, and tags.
- **FR-007**: Users MUST be able to search bookmarks by title, destination, notes, or tag using case-insensitive partial text matching.
- **FR-008**: Users MUST be able to filter bookmarks by tag, favorite state, and active or archived state.
- **FR-009**: Users MUST be able to mark and unmark bookmarks as favorites.
- **FR-010**: Users MUST be able to archive and restore bookmarks without losing their details.
- **FR-011**: Users MUST be able to permanently delete a bookmark after an explicit confirmation step.
- **FR-012**: The app MUST preserve saved bookmarks and their state between user sessions on the same installation.
- **FR-013**: When a user attempts to save a duplicate destination, the app MUST identify the existing bookmark and offer a route to update it.
- **FR-014**: The app MUST provide distinct, understandable states for an empty collection and for searches or filters with no matches.
- **FR-015**: The app MUST order the collection with the most recently saved bookmarks first by default.

### Key Entities

- **Bookmark**: A saved web resource, identified by its destination and containing a title, optional notes, tags, favorite status, archive status, creation date, and last-updated date.
- **Tag**: A reusable label associated with zero or more bookmarks; its name is unique without regard to letter case.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of first-time users can save and reopen a bookmark without assistance in under one minute.
- **SC-002**: Users can locate a known bookmark in a collection of 1,000 items through search or filtering in under 10 seconds, with matching results appearing within one second of an action.
- **SC-003**: In acceptance testing, 100% of valid create, edit, favorite, archive, restore, and delete actions remain reflected after closing and reopening the app.
- **SC-004**: At least 95% of test participants can distinguish an empty collection from a no-matches result and identify the next available action without assistance.
- **SC-005**: In validation testing, 100% of malformed or missing destinations are rejected without corrupting or replacing an existing bookmark.

## Assumptions

- The first release is a personal, single-user application; accounts, sharing, teams, and permissions are outside this feature's scope.
- The first release manages bookmarks entered by the user; browser synchronization, browser extensions, bulk import/export, automatic metadata retrieval, link-health monitoring, and page-content capture are outside scope.
- The app is intended for a modern web browser on desktop and mobile-sized screens.
- A bookmark may have any number of tags, while notes are optional plain text.
- Saved data belongs to one installation. Cross-device synchronization and backup are outside scope.
- Internet access is needed only to visit saved destinations; users can still view and manage already saved records when a destination is unreachable.

