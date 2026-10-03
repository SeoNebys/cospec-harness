# Feature Specification: Bookmark Manager

**Feature Branch**: `[001-bookmark-manager]`

**Created**: 2026-09-23

**Status**: Draft — awaiting client approval

**Input**: User description: "I want to build an app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save and revisit a bookmark (Priority: P1)

As a user, I can save a web address with a useful title and later open it, so I do not lose pages I want to revisit.

**Why this priority**: Saving and reopening links is the core value of a bookmark manager.

**Independent Test**: Save one valid web address, leave the collection view, return, and open the saved bookmark. The same address and title remain available and the destination opens.

**Acceptance Scenarios**:

1. **Given** an empty collection, **When** the user saves a valid web address and title, **Then** the bookmark appears in the collection with its title and address.
2. **Given** a saved bookmark, **When** the user chooses to open it, **Then** the bookmarked destination opens without losing the user's place in the collection.
3. **Given** an invalid or missing web address, **When** the user tries to save it, **Then** the bookmark is not saved and a clear correction message is shown.

---

### User Story 2 - Find and organize bookmarks (Priority: P2)

As a user, I can add tags and search or filter my collection, so I can quickly find a bookmark as the collection grows.

**Why this priority**: Retrieval and organization make saved links useful beyond a very small collection.

**Independent Test**: Create bookmarks with different titles, addresses, descriptions, and tags; search for text and filter by a tag; verify only matching bookmarks are shown and that clearing the controls restores the collection.

**Acceptance Scenarios**:

1. **Given** bookmarks with different titles, addresses, descriptions, and tags, **When** the user searches for matching text, **Then** all and only bookmarks matching at least one of those fields are shown.
2. **Given** bookmarks with different tags, **When** the user selects a tag, **Then** only bookmarks carrying that tag are shown.
3. **Given** active search or tag filters, **When** the user clears them, **Then** the full collection is shown again.
4. **Given** no bookmarks match the active criteria, **When** results are displayed, **Then** the user sees an informative empty state and can clear the criteria.

---

### User Story 3 - Maintain the collection (Priority: P3)

As a user, I can edit outdated bookmark details and remove bookmarks I no longer need, so my collection stays accurate and useful.

**Why this priority**: Maintenance prevents the collection from becoming stale, but it follows the core save and retrieval flows.

**Independent Test**: Edit a bookmark's title, address, description, and tags, confirm the changes persist, then delete the bookmark and confirm it no longer appears.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user saves valid edits, **Then** the updated details replace the old details everywhere in the collection.
2. **Given** an existing bookmark, **When** the user cancels editing, **Then** no changes are saved.
3. **Given** an existing bookmark, **When** the user confirms deletion, **Then** the bookmark is removed from the collection.
4. **Given** a pending deletion, **When** the user cancels it, **Then** the bookmark remains unchanged.

### Edge Cases

- Saving an address already present in the collection warns the user and lets them cancel or intentionally keep a separate bookmark.
- Addresses entered without a web scheme are normalized when they are otherwise recognizable as web addresses; malformed or unsupported addresses are rejected.
- Titles and descriptions containing punctuation, emoji, or non-Latin characters remain intact.
- Leading and trailing spaces in user-entered details are ignored; an otherwise empty required value remains invalid.
- Long titles, addresses, descriptions, and large tag sets remain readable without breaking collection navigation.
- Search is case-insensitive and shows a clear no-results state when nothing matches.
- A bookmark may have no description or tags, but must always have a title and web address.
- If a save, edit, or delete cannot be completed, the user's existing collection remains intact and a useful error is shown.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let users create a bookmark with a required title and web address and optional description and tags.
- **FR-002**: The system MUST validate that each saved address is a usable web address and explain how to correct invalid input.
- **FR-003**: The system MUST preserve saved bookmarks between visits from the same user in the same app environment.
- **FR-004**: The system MUST present saved bookmarks as a browsable collection showing, at minimum, title, address, and tags.
- **FR-005**: Users MUST be able to open a bookmarked destination without losing their current collection context.
- **FR-006**: Users MUST be able to edit every saved bookmark field and either save or cancel the changes.
- **FR-007**: Users MUST be able to delete a bookmark only after an explicit confirmation opportunity.
- **FR-008**: Users MUST be able to search bookmarks by title, address, description, or tag using case-insensitive text matching.
- **FR-009**: Users MUST be able to filter bookmarks by one tag and clear the active filter.
- **FR-010**: Users MUST be able to assign multiple reusable tags to a bookmark and remove tags from it.
- **FR-011**: The system MUST display clear, actionable empty states for an empty collection and for a search or filter with no matches.
- **FR-012**: When a user attempts to save an address already in the collection, the system MUST warn them before allowing a separate duplicate bookmark.
- **FR-013**: The system MUST preserve existing data when an attempted create, edit, or delete operation fails.
- **FR-014**: The system MUST order the collection with the most recently added bookmarks first by default.

### Key Entities

- **Bookmark**: A saved web destination, identified by its address and described by a title, optional description, zero or more tags, and created and last-updated timestamps.
- **Tag**: A user-defined organizational label that can be associated with multiple bookmarks; its visible name is unique without regard to letter case.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of first-time users can save their first valid bookmark without assistance in under 60 seconds.
- **SC-002**: A user can locate a known bookmark in a collection of 1,000 items through search or tag filtering in under 10 seconds, with matching results visible within 1 second of an action.
- **SC-003**: In acceptance testing, 100% of successfully created or edited bookmarks remain available with the same details after leaving and returning to the app.
- **SC-004**: At least 95% of test participants complete the save, find, edit, open, and delete workflows successfully on their first attempt.
- **SC-005**: Invalid addresses, duplicate addresses, empty collections, and no-match searches each produce an understandable next step in 100% of acceptance tests.

## Assumptions

- The initial release is a personal, single-user experience; accounts, sharing, collaboration, and role-based permissions are outside this feature's scope.
- The app manages ordinary web links. File uploads, archived page copies, browser-extension capture, automatic metadata extraction, and link-health monitoring are outside the initial scope.
- Users enter bookmark titles themselves; the app does not need to fetch page titles or descriptions from external sites.
- Bookmarks are private to the app environment in which they are saved; cross-device synchronization and import/export are outside the initial scope.
- Search uses simple partial-text matching rather than advanced query syntax, ranking, or semantic search.
- Tag filtering uses one selected tag at a time in the initial release.
