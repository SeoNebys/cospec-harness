# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "I want to build an app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save and Revisit Bookmarks (Priority: P1)

As a user, I can save a web address with a useful title so that I can find and open it later.

**Why this priority**: Saving and reopening links is the core value of a bookmark manager and forms the smallest useful product.

**Independent Test**: Save a valid web address, leave and return to the bookmark list, then open the saved item and confirm it points to the original address.

**Acceptance Scenarios**:

1. **Given** the bookmark list is available, **When** the user saves a valid web address and title, **Then** the bookmark appears in the list with the saved title and address.
2. **Given** a bookmark has been saved, **When** the user returns in a later session, **Then** the bookmark is still present.
3. **Given** a saved bookmark, **When** the user chooses to open it, **Then** the destination opens without replacing or losing the bookmark collection.
4. **Given** an invalid or unsupported address, **When** the user tries to save it, **Then** the app explains the problem and preserves the entered details for correction.

---

### User Story 2 - Find and Organize Bookmarks (Priority: P2)

As a user with a growing collection, I can add tags and search or filter my bookmarks so that I can quickly locate a relevant link.

**Why this priority**: A collection becomes useful over time only if saved items remain easy to retrieve.

**Independent Test**: Create several bookmarks with different titles, addresses, notes, and tags; verify that search and tag filtering show all and only the expected matches.

**Acceptance Scenarios**:

1. **Given** a bookmark is being created or edited, **When** the user assigns one or more tags, **Then** those tags are shown with the bookmark and are available as filters.
2. **Given** multiple saved bookmarks, **When** the user searches using text contained in a title, address, note, or tag, **Then** matching bookmarks are shown.
3. **Given** bookmarks with different tags, **When** the user selects a tag filter, **Then** only bookmarks carrying that tag are shown.
4. **Given** a search or filter with no matches, **When** results are evaluated, **Then** the app shows a clear empty state and a way to clear the search or filter.

---

### User Story 3 - Maintain the Collection (Priority: P3)

As a user, I can update, favorite, archive, and delete bookmarks so that my collection remains accurate and manageable.

**Why this priority**: Maintenance controls keep the collection useful but depend on the core save-and-find flows.

**Independent Test**: Change a bookmark's details, favorite it, archive it, restore it, and delete it; verify the list reflects every action and asks for confirmation before permanent removal.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user edits its title, address, note, or tags, **Then** the updated details replace the previous details.
2. **Given** a saved bookmark, **When** the user marks or unmarks it as a favorite, **Then** its favorite status changes and it can be filtered by that status.
3. **Given** an active bookmark, **When** the user archives it, **Then** it leaves the default active list and remains available in an archived view.
4. **Given** an archived bookmark, **When** the user restores it, **Then** it returns to the active list with its details intact.
5. **Given** a saved bookmark, **When** the user requests deletion, **Then** the app requires confirmation before permanently removing it.

### Edge Cases

- Saving an address already present in the active or archived collection warns the user, identifies the existing bookmark, and allows the user to cancel or save another copy.
- Addresses with surrounding whitespace are normalized before validation; only web addresses using `http` or `https` are accepted in this version.
- Titles, notes, and tags that exceed their stated limits are rejected with a clear message before saving.
- Search is case-insensitive and tolerates leading or trailing whitespace.
- Removing a tag from its last bookmark removes it from the available tag filters.
- A failed save or edit does not discard the user's unsaved input.
- An empty collection and an empty filtered result are presented as distinct states with appropriate next actions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow users to save a bookmark with a valid `http` or `https` address and a title.
- **FR-002**: The system MUST allow an optional plain-text note and zero or more tags on each bookmark.
- **FR-003**: The system MUST limit titles to 200 characters, notes to 2,000 characters, individual tags to 40 characters, and tags per bookmark to 20, and MUST explain any violated limit.
- **FR-004**: The system MUST retain saved bookmarks and their management state across user sessions.
- **FR-005**: The system MUST display active bookmarks in a browsable list showing, at minimum, title, destination host, tags, favorite state, and save date.
- **FR-006**: Users MUST be able to open a saved bookmark's destination while retaining access to their collection.
- **FR-007**: Users MUST be able to edit a bookmark's title, address, note, and tags.
- **FR-008**: Users MUST be able to permanently delete a bookmark only after confirming the action.
- **FR-009**: Users MUST be able to mark and unmark bookmarks as favorites and view only favorites.
- **FR-010**: Users MUST be able to archive and restore bookmarks; archived bookmarks MUST be excluded from the default active list.
- **FR-011**: Users MUST be able to search bookmarks by title, address, note, or tag using case-insensitive text matching.
- **FR-012**: Users MUST be able to filter bookmarks by tag and clear active search and filter criteria.
- **FR-013**: Users MUST be able to sort the currently viewed bookmarks by newest saved, oldest saved, or title.
- **FR-014**: When a submitted address already belongs to another bookmark, the system MUST warn the user, identify the existing item, and require an explicit choice before saving a duplicate.
- **FR-015**: The system MUST preserve valid existing bookmark data when an add or edit attempt fails validation.
- **FR-016**: The system MUST distinguish between an entirely empty collection and a search or filter that has no matches, and MUST offer a relevant recovery action for each.
- **FR-017**: All core bookmark actions MUST be operable using keyboard-only navigation and MUST expose clear text labels or accessible names.

### Key Entities

- **Bookmark**: A saved web destination with a unique identity, address, title, optional note, zero or more tags, favorite status, archive status, creation time, and last-updated time.
- **Tag**: A user-defined organizational label. A tag may be assigned to many bookmarks and is available as a filter while at least one bookmark uses it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of first-time users can save and reopen their first bookmark without assistance in under 60 seconds.
- **SC-002**: Users can locate a known bookmark in a collection of 1,000 items using search or tags in under 10 seconds.
- **SC-003**: Search, filtering, sorting, archiving, favoriting, and editing show their completed result within 1 second for collections of up to 10,000 bookmarks under normal operating conditions.
- **SC-004**: In acceptance testing, 100% of valid add, edit, archive, restore, favorite, and confirmed-delete actions remain correct after leaving and returning to the app.
- **SC-005**: At least 95% of representative users complete the save, find, edit, archive, and delete journeys on their first attempt without external guidance.
- **SC-006**: All primary bookmark-management journeys can be completed using keyboard-only navigation, with no critical accessibility barriers in an agreed accessibility review.

## Assumptions

- The first release is a personal, single-user bookmark manager; accounts, sharing, collaboration, and role-based access are outside this feature's scope.
- The app manages bookmarks entered by the user and does not import browser bookmark files or synchronize with browser bookmark stores in the first release.
- The app does not guarantee that a destination page is safe, reachable, or unchanged; opening a bookmark uses the saved address.
- Automatic webpage metadata, thumbnails, folders, bulk actions, and link-health monitoring are outside the first-release scope.
- User-entered notes are plain text rather than formatted content.
- English is the initial interface language, while bookmark text may contain Unicode characters.
