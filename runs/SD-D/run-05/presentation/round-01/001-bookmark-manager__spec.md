# Feature Specification: Bookmark Manager

**Feature Branch**: `not-created`

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: "I want to build an app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save and Revisit Bookmarks (Priority: P1)

As a user, I can save a web address with a readable title and optional notes, then view and open it later, so useful resources are not lost.

**Why this priority**: Saving and retrieving links is the core value of a bookmark manager and forms a usable first release by itself.

**Independent Test**: Save a valid web address, leave the creation flow, locate it in the bookmark list, and open it successfully.

**Acceptance Scenarios**:

1. **Given** the user is viewing their bookmarks, **When** they save a valid web address and title, **Then** the bookmark appears in their collection with its saved details.
2. **Given** a bookmark exists, **When** the user selects its web address, **Then** the destination opens without losing the bookmark.
3. **Given** the user enters an invalid or unsupported web address, **When** they try to save it, **Then** the bookmark is not created and the user sees how to correct the entry.

---

### User Story 2 - Find and Organize Bookmarks (Priority: P2)

As a user, I can organize bookmarks with tags and find them using search and filters, so a growing collection remains useful.

**Why this priority**: Retrieval becomes difficult as the collection grows; lightweight organization preserves the value of saved links.

**Independent Test**: Create bookmarks with different titles, notes, and tags, then verify that search and tag filters return only the matching bookmarks.

**Acceptance Scenarios**:

1. **Given** bookmarks with different titles, web addresses, notes, and tags exist, **When** the user searches for matching text, **Then** all and only relevant bookmarks are shown.
2. **Given** bookmarks have different tags, **When** the user filters by a tag, **Then** only bookmarks carrying that tag are shown.
3. **Given** a search or filter has no matches, **When** results are displayed, **Then** the user sees a clear empty state and can remove the active criteria.

---

### User Story 3 - Maintain the Collection (Priority: P3)

As a user, I can edit outdated bookmark details and remove bookmarks I no longer need, so the collection stays accurate and uncluttered.

**Why this priority**: Maintenance is necessary for long-term use but is less critical than initially saving and finding links.

**Independent Test**: Change an existing bookmark's details, confirm the changes persist, then delete it and confirm it is no longer present.

**Acceptance Scenarios**:

1. **Given** a bookmark exists, **When** the user edits its title, web address, notes, or tags with valid values, **Then** the updated details replace the prior values.
2. **Given** a bookmark exists, **When** the user chooses to delete it, **Then** the application asks for confirmation before removal.
3. **Given** the user confirms deletion, **When** the operation completes, **Then** the bookmark no longer appears in searches, filters, or the full collection.

### Edge Cases

- An address that differs only by capitalization in its host name or includes a trailing slash is recognized as a possible duplicate; the user is warned and may keep both entries.
- A bookmark can be saved without notes or tags, but not without a title or valid web address.
- Leading and trailing spaces in entered text are ignored; an entry containing only spaces is treated as empty.
- Tags that differ only by capitalization are treated as the same tag.
- Very long titles, addresses, notes, or tag lists are rejected at documented limits with a clear message and without losing the user's entered content.
- If a destination is unavailable when opened, the saved bookmark remains unchanged.
- Search is case-insensitive and handles punctuation and partial text without failing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let users create a bookmark with a valid `http` or `https` web address and a non-empty title.
- **FR-002**: The system MUST let users optionally add plain-text notes and zero or more tags to a bookmark.
- **FR-003**: The system MUST retain every saved bookmark and its details between user sessions until the user deletes it.
- **FR-004**: The system MUST show the user's bookmarks in a collection that includes, at minimum, the title, web address, tags, and creation date of each bookmark.
- **FR-005**: Users MUST be able to open a saved bookmark's destination while keeping the bookmark in their collection.
- **FR-006**: Users MUST be able to edit the title, web address, notes, and tags of an existing bookmark, subject to the same validation used during creation.
- **FR-007**: Users MUST be able to delete a bookmark only after an explicit confirmation step.
- **FR-008**: The system MUST allow case-insensitive search across bookmark titles, web addresses, notes, and tags.
- **FR-009**: The system MUST allow the collection to be filtered by one tag at a time and allow that filter to be cleared.
- **FR-010**: The system MUST allow the collection to be ordered by newest created, oldest created, or title.
- **FR-011**: The system MUST clearly distinguish the empty collection state from a search or filter that has no matches and offer an appropriate next action in each state.
- **FR-012**: The system MUST warn users when a newly entered web address appears to duplicate an existing bookmark and MUST allow them either to cancel or save it anyway.
- **FR-013**: The system MUST display actionable validation feedback without discarding valid information already entered by the user.
- **FR-014**: The system MUST preserve the current search, tag filter, and ordering while the user views and maintains the collection during a session.

### Scope Boundaries

The first release includes a personal bookmark collection, manual bookmark creation, editing, deletion, tags, search, filtering, sorting, and opening saved destinations.

The first release does not include shared collections, multiple user accounts, cross-device synchronization, browser extensions, automatic page-content capture, link-health monitoring, folders, bulk import/export, or offline copies of destination pages.

### Key Entities

- **Bookmark**: A saved web resource with a unique identity, web address, title, optional notes, zero or more tags, creation date, and last-updated date.
- **Tag**: A reusable, case-insensitive label associated with one or more bookmarks; each normalized tag name is unique within the collection.
- **Collection View**: The user's current search text, selected tag filter, and ordering choice; it affects presentation but not saved bookmark contents.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of first-time users can save and reopen a bookmark without assistance in under 60 seconds.
- **SC-002**: A user can find a known bookmark among 1,000 saved bookmarks using search or a tag in under 10 seconds.
- **SC-003**: For a collection of up to 10,000 bookmarks, 95% of searches, filters, and ordering changes display the completed result within 1 second under normal operating conditions.
- **SC-004**: All accepted create, edit, and delete actions remain reflected after ending and starting a new session.
- **SC-005**: In usability testing, at least 90% of participants complete the save, find, edit, and delete journeys on their first attempt without facilitator help.

## Assumptions

- The first release is a single-user personal application; account creation, permissions, sharing, and synchronization are out of scope.
- Users add bookmark details manually. Automatic title or preview retrieval is not required.
- A bookmark may point only to an `http` or `https` destination; other address schemes are out of scope.
- Tags provide sufficient organization for the first release; hierarchical folders are deferred.
- Search matches partial text across the user's stored bookmark data and does not search destination-page content.
- The target collection size for the first release is up to 10,000 bookmarks.
- Exact field-length and tag-count limits will be chosen during planning, documented for users, and set high enough for ordinary web addresses and notes.
- Availability and safety of external destination pages are outside the application's control.

