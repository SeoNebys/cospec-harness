# Feature Specification: Personal Bookmark Manager

**Feature Branch**: `not-created`

**Created**: 2026-09-16

**Status**: Approved

**Input**: User description: "I want to build an app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a Bookmark (Priority: P1)

As a user, I want to save a web address with a recognizable title so that I can return to it later.

**Why this priority**: Saving links is the core value of a bookmark manager. Without it, no other management capability is useful.

**Independent Test**: A user can submit a valid web address, optionally adjust its title and notes, and see the saved bookmark in their collection after returning to the app.

**Acceptance Scenarios**:

1. **Given** the user is viewing their collection, **When** they save a valid web address and title, **Then** the bookmark appears in the collection with its web address, title, and creation date.
2. **Given** the user enters a valid web address without a title, **When** the address provides a recognizable page title, **Then** the app proposes that title and lets the user change it before saving.
3. **Given** the web address is invalid or unsupported, **When** the user attempts to save it, **Then** the app explains the problem and preserves the entered information for correction.
4. **Given** the same web address already exists in the user's active collection, **When** the user attempts to save it again, **Then** the app warns them and offers to open or update the existing bookmark instead of silently creating a duplicate.

---

### User Story 2 - Find and Open Bookmarks (Priority: P2)

As a user, I want to browse, search, and filter my saved bookmarks so that I can quickly find and open the resource I need.

**Why this priority**: A growing collection only remains useful when saved items can be retrieved quickly.

**Independent Test**: With a collection containing bookmarks with varied titles, web addresses, notes, tags, and favorites, a user can locate a known item by browsing, searching, or applying filters and can open its destination.

**Acceptance Scenarios**:

1. **Given** the user has saved bookmarks, **When** they view their collection, **Then** active bookmarks are displayed newest first with enough information to distinguish them.
2. **Given** matching bookmarks exist, **When** the user searches by words found in a title, web address, note, or tag, **Then** only relevant matches are shown.
3. **Given** bookmarks have different tags and favorite states, **When** the user applies one or more available filters, **Then** the collection shows only bookmarks that satisfy all selected filters.
4. **Given** a bookmark is visible, **When** the user chooses to open it, **Then** its saved destination opens without removing the user from their collection context.
5. **Given** no bookmark matches the current search or filters, **When** results are shown, **Then** the app displays a clear empty state and a way to clear the search or filters.

---

### User Story 3 - Organize and Maintain a Collection (Priority: P3)

As a user, I want to edit, tag, favorite, archive, and delete bookmarks so that my collection stays organized and current.

**Why this priority**: Ongoing maintenance increases the long-term usefulness of the collection after saving and retrieval work reliably.

**Independent Test**: A user can modify a bookmark's details and organization, move it out of the active collection, restore it, or permanently remove it with an appropriate safeguard.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user changes its title, web address, notes, tags, or favorite state, **Then** the updated values appear wherever that bookmark is shown.
2. **Given** a bookmark has tags, **When** the user removes a tag or adds a new one, **Then** its tag filters immediately reflect the change.
3. **Given** an active bookmark, **When** the user archives it, **Then** it leaves the active collection and remains available in an archived view.
4. **Given** an archived bookmark, **When** the user restores it, **Then** it returns to the active collection with its details intact.
5. **Given** a bookmark, **When** the user requests permanent deletion and confirms the action, **Then** the bookmark is removed and is no longer discoverable in the collection.

### Edge Cases

- An address that differs from an existing bookmark only by capitalization of the host, a trailing slash, or another non-meaningful variation is treated as a possible duplicate.
- If a page title cannot be retrieved, the user can provide a title manually and still save the bookmark.
- If title retrieval is slow or fails, the user can continue saving without waiting indefinitely.
- Very long titles, web addresses, notes, and tags are constrained with clear limits and validation before saving; entered information is not lost on validation failure.
- Tag comparisons ignore capitalization and surrounding whitespace so visually identical tags do not fragment the collection.
- Archived bookmarks do not appear in the active collection or its search results unless the user explicitly views archived items.
- If an edited address would duplicate another active bookmark, the same duplicate warning used during creation is shown.
- Opening a destination that is no longer available does not alter or delete the saved bookmark.
- A new user with no bookmarks sees an explanation of the collection and a clear action to save their first bookmark.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST keep each user's bookmark collection private to that user.
- **FR-002**: Users MUST be able to save a bookmark with a valid `http` or `https` web address.
- **FR-003**: Each bookmark MUST include a title and web address, and MAY include notes and tags.
- **FR-004**: The system MUST attempt to propose a page title when the user provides a web address without a title, while allowing the user to edit or replace the proposal.
- **FR-005**: The system MUST allow a bookmark to be saved with a user-provided title when a page title cannot be obtained.
- **FR-006**: The system MUST validate bookmark input, explain invalid fields in plain language, and preserve entered values so the user can correct them.
- **FR-007**: The system MUST warn users when a new or edited web address appears to duplicate an active bookmark and MUST provide access to the existing bookmark.
- **FR-008**: Users MUST be able to view their active bookmarks in reverse chronological order by default.
- **FR-009**: Each bookmark shown in a collection MUST display its title, destination domain, tags, favorite state, and save date when those values are available.
- **FR-010**: Users MUST be able to search active bookmarks by partial, case-insensitive matches across title, web address, notes, and tags.
- **FR-011**: Users MUST be able to filter bookmarks by one or more tags and by favorite state, with all selected filters applied together.
- **FR-012**: Users MUST be able to clear search and filter criteria in a single action.
- **FR-013**: Users MUST be able to open a bookmark's saved destination while retaining their place in the collection.
- **FR-014**: Users MUST be able to edit a bookmark's title, web address, notes, tags, and favorite state.
- **FR-015**: Users MUST be able to create tags while saving or editing a bookmark and remove tags from a bookmark without deleting the bookmark.
- **FR-016**: Tag names MUST be compared without regard to capitalization or surrounding whitespace to prevent duplicate tag variants within a user's collection.
- **FR-017**: Users MUST be able to archive an active bookmark, view archived bookmarks separately, and restore an archived bookmark with all of its details intact.
- **FR-018**: Users MUST be able to permanently delete a bookmark only after an explicit confirmation that communicates the action cannot be undone.
- **FR-019**: The system MUST show actionable empty states for a new collection and for searches or filters with no matches.
- **FR-020**: The system MUST preserve saved bookmark data across user sessions.
- **FR-021**: The system MUST enforce documented input limits consistently and communicate those limits before or during data entry.

### Key Entities

- **User**: A person with a private bookmark collection and an authenticated session; owns bookmarks and tags.
- **Bookmark**: A saved web resource owned by one user; includes a title, web address, optional notes, zero or more tags, favorite state, lifecycle state (active or archived), creation date, and last-updated date.
- **Tag**: A user-defined organizational label associated with zero or more bookmarks in the same user's collection; has a normalized name used to avoid duplicate variants.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of first-time users can save their first valid bookmark without assistance in under 60 seconds.
- **SC-002**: A user can find and open a known bookmark from a collection of 1,000 items in under 10 seconds using search or filters.
- **SC-003**: Search or filter results become visible within 1 second for collections containing up to 10,000 bookmarks under normal operating conditions.
- **SC-004**: 100% of tested invalid-address and duplicate-address scenarios provide a clear corrective next step without discarding the user's entered title, notes, or tags.
- **SC-005**: At least 95% of users in usability testing can edit, archive, and restore a bookmark successfully on their first attempt.
- **SC-006**: No user can view or modify another user's bookmarks in access-control testing.
- **SC-007**: All successful bookmark changes remain present after the user signs out and later returns to the app.

## Assumptions

- The first release is a personal, account-based experience; each authenticated user manages only their own collection.
- The app is intended for modern web browsers on desktop and mobile-sized screens, but native mobile applications are outside the first release.
- A bookmark opens in a separate browsing context so the collection remains available.
- Duplicate detection identifies likely duplicates but does not prevent a user from intentionally keeping distinct records when the addresses represent meaningfully different destinations.
- Search and filters operate within either the active or archived view, not across both at the same time.
- Browser extensions, collaborative/shared collections, folders, bulk import/export, offline use, automated link-health checking, and webpage content snapshots are outside the first release.
- The client will approve concrete maximum lengths for titles, web addresses, notes, and tags during planning; the user-facing behavior around limits is part of this specification.
- Standard account access, recovery, privacy, and secure-session behavior are supporting capabilities; the detailed identity experience is not part of bookmark-management scope.
