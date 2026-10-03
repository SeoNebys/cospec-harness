# Feature Specification: Bookmark Manager

**Feature Branch**: `001-manage-bookmarks`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "I want to build an app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save and Revisit Bookmarks (Priority: P1)

As a user, I can save a web address with a readable title and later open it from my bookmark collection so that useful pages are not lost.

**Why this priority**: Saving and reopening links is the core value of a bookmark manager.

**Independent Test**: Save a valid web address, confirm it appears in the collection after revisiting the app, and open the saved destination.

**Acceptance Scenarios**:

1. **Given** the user is viewing their collection, **When** they submit a valid web address and title, **Then** the bookmark is saved and shown with its title, address, and creation date.
2. **Given** a saved bookmark exists, **When** the user selects it, **Then** its web address opens without altering the saved bookmark.
3. **Given** the user submits an invalid or unsupported web address, **When** validation runs, **Then** the bookmark is not saved and a clear correction message is shown.
4. **Given** the user submits a web address already in the collection, **When** validation runs, **Then** the existing bookmark is identified and no duplicate is created.

---

### User Story 2 - Find and Organize Bookmarks (Priority: P2)

As a user with a growing collection, I can add tags and search or filter my bookmarks so that I can quickly find a saved page.

**Why this priority**: A collection remains useful only when users can retrieve relevant links without scanning everything.

**Independent Test**: Add tags to several bookmarks, then find specific bookmarks using a title/address search and a tag filter.

**Acceptance Scenarios**:

1. **Given** a bookmark is being created or edited, **When** the user assigns one or more tags, **Then** those tags are saved and displayed with the bookmark.
2. **Given** multiple bookmarks exist, **When** the user searches by text contained in a title, address, or tag, **Then** only matching bookmarks are shown.
3. **Given** bookmarks use multiple tags, **When** the user selects a tag filter, **Then** only bookmarks carrying that tag are shown and the active filter is apparent.
4. **Given** no bookmark matches the current search or filter, **When** results are evaluated, **Then** a clear empty state appears with a way to clear the criteria.

---

### User Story 3 - Maintain the Collection (Priority: P3)

As a user, I can edit outdated bookmark details and remove bookmarks I no longer need so that my collection stays accurate.

**Why this priority**: Maintenance prevents stale or mistaken entries from reducing the collection's usefulness.

**Independent Test**: Edit a bookmark's title, address, and tags, verify the changes persist, then delete it with confirmation and verify it is gone.

**Acceptance Scenarios**:

1. **Given** a saved bookmark exists, **When** the user changes its title, address, or tags with valid values, **Then** the updated details replace the previous details and persist.
2. **Given** a saved bookmark exists, **When** the user requests deletion, **Then** the app asks for confirmation before removal.
3. **Given** deletion confirmation is shown, **When** the user cancels, **Then** the bookmark remains unchanged.
4. **Given** deletion confirmation is shown, **When** the user confirms, **Then** the bookmark is removed from the collection.

### Edge Cases

- A submitted address contains surrounding spaces, mixed-case host text, a long path, query parameters, or a fragment.
- A title or tag contains leading/trailing spaces, repeated whitespace, or reaches the allowed length limit.
- The same tag is entered more than once on a bookmark or with different capitalization.
- A user edits a bookmark's address to one already saved elsewhere in the collection.
- The collection is empty, or a search/filter produces no results.
- A destination page is unavailable after its bookmark has already been saved; the saved record remains available for editing or deletion.
- A save, edit, or delete operation cannot be completed; the app retains the prior consistent state and explains that the action failed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to save a bookmark with a valid `http` or `https` web address and a non-empty title.
- **FR-002**: The system MUST reject unsupported or malformed addresses and explain how to correct them.
- **FR-003**: The system MUST prevent more than one bookmark for the same normalized web address and direct the user to the existing entry.
- **FR-004**: The system MUST retain each bookmark's title, web address, tags, creation date, and last-updated date between user sessions.
- **FR-005**: Users MUST be able to view all saved bookmarks in a collection that clearly shows each bookmark's title, address, tags, and saved date.
- **FR-006**: Users MUST be able to open a saved bookmark's destination from the collection.
- **FR-007**: Users MUST be able to assign, remove, and view zero or more tags on each bookmark.
- **FR-008**: The system MUST treat tags that differ only by capitalization or surrounding whitespace as the same tag.
- **FR-009**: Users MUST be able to search bookmarks using text from titles, web addresses, and tags.
- **FR-010**: Users MUST be able to filter the collection by a selected tag.
- **FR-011**: Users MUST be able to clear active search and filter criteria and return to the full collection.
- **FR-012**: Users MUST be able to edit a bookmark's title, web address, and tags subject to the same validation and duplicate rules used when saving.
- **FR-013**: Users MUST be able to delete a bookmark only after explicitly confirming the deletion.
- **FR-014**: The system MUST provide distinct, helpful empty states for an empty collection and for search or filter criteria with no matches.
- **FR-015**: If an attempted change fails, the system MUST preserve the last successfully saved state and tell the user that the action was not completed.
- **FR-016**: The collection MUST be private to its user; one user MUST NOT be able to view or modify another user's bookmarks.
- **FR-017**: The experience MUST support keyboard-only completion of saving, searching, filtering, editing, opening, and deleting bookmarks, with controls and status feedback exposed using meaningful labels.

### Key Entities

- **User**: The owner of a private bookmark collection. Each bookmark belongs to exactly one user.
- **Bookmark**: A saved web destination identified by its web address, with a title, creation date, last-updated date, and zero or more tags.
- **Tag**: A reusable organizational label associated with one or more bookmarks in a user's collection; equivalent capitalization and surrounding whitespace do not create separate tags.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of first-time users can save and reopen a bookmark without guidance on their first attempt.
- **SC-002**: A user can save a bookmark with a title and address in under 30 seconds.
- **SC-003**: For a collection of 10,000 bookmarks, search and tag-filter results become visible within 1 second of the user's action in at least 95% of attempts under normal operating conditions.
- **SC-004**: Users can locate and open a known bookmark in a 500-item collection within 15 seconds using search or tag filtering.
- **SC-005**: In acceptance testing, 100% of rejected addresses and duplicate submissions leave the collection unchanged and show a specific corrective message.
- **SC-006**: In accessibility acceptance testing, all primary bookmark-management journeys can be completed using only a keyboard, with the current focus and action result perceivable at every step.

## Assumptions

- The first release is a responsive web experience intended for individual users on desktop and mobile browsers.
- Users have an established identity or can establish one through a conventional account flow; the precise authentication method is an implementation-planning decision.
- Titles are entered by users in the first release; automatically retrieving page titles, descriptions, thumbnails, or icons is outside scope.
- Bookmarks are private by default. Sharing, collaboration, public collections, and team permissions are outside scope.
- Importing from browsers or other services, exporting, browser extensions, favorites, folders, archiving, annotations, link-health monitoring, and offline use are outside scope for the first release.
- Search is case-insensitive and matches partial text; tag filtering uses one selected tag at a time in the first release.
- The app preserves query parameters and fragments because they may identify meaningful destinations, while normalizing addresses only enough to identify unambiguous duplicates.
- Reasonable text-length limits will be defined during planning and communicated before submission without changing the user journeys in this specification.
