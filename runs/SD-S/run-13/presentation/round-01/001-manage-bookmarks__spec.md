# Feature Specification: Bookmark Manager

**Feature Directory**: `001-manage-bookmarks`

**Created**: 2026-09-23

**Status**: Draft — awaiting client approval

**Input**: User description: "I want to build an app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save and revisit a bookmark (Priority: P1)

As a user, I can save a web address with a recognizable title and later open it from my bookmark library, so useful pages are not lost.

**Why this priority**: Saving and revisiting links is the minimum useful bookmark-management experience.

**Independent Test**: Save a valid web address, leave and return to the app, locate the saved bookmark, and open its destination.

**Acceptance Scenarios**:

1. **Given** the bookmark library is available, **When** the user saves a valid web address and title, **Then** the bookmark appears in the library with its title, address, and creation date.
2. **Given** a bookmark was saved in an earlier session, **When** the user returns to the library, **Then** the bookmark remains available.
3. **Given** a saved bookmark, **When** the user activates it, **Then** its web address opens without removing or changing the bookmark.
4. **Given** an invalid or unsupported address, **When** the user attempts to save it, **Then** the bookmark is not created and the user sees a clear explanation.

---

### User Story 2 - Find and organize bookmarks (Priority: P2)

As a user, I can add tags and optional notes, mark important bookmarks as favorites, and search or filter my library, so I can quickly recover the right page as the collection grows.

**Why this priority**: Organization and retrieval turn a link list into a useful long-term library.

**Independent Test**: Create bookmarks with different titles, addresses, notes, tags, and favorite states; then confirm search and each filter return the expected subset.

**Acceptance Scenarios**:

1. **Given** the user is creating or editing a bookmark, **When** they add notes, tags, or a favorite status and save, **Then** those details are retained and displayed with the bookmark.
2. **Given** a library containing multiple bookmarks, **When** the user searches for text found in a title, address, note, or tag, **Then** only matching bookmarks are shown.
3. **Given** bookmarks with different tags and favorite states, **When** the user filters by a tag or favorites, **Then** only bookmarks satisfying the active filters are shown.
4. **Given** an active query or filter with no matches, **When** results are displayed, **Then** the user sees a clear empty state and can reset the query or filters.

---

### User Story 3 - Maintain the library (Priority: P3)

As a user, I can update outdated bookmark details, remove bookmarks I no longer need, and choose a useful display order, so the library stays accurate and manageable.

**Why this priority**: Maintenance preserves the value of the library but depends on bookmarks already existing.

**Independent Test**: Edit a bookmark, reorder the list using each supported sort option, and delete the bookmark after confirming the action.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user changes its title, address, notes, tags, or favorite status with valid values, **Then** the updated details replace the previous details.
2. **Given** an existing bookmark, **When** the user requests deletion, **Then** the app asks for confirmation before permanently removing it.
3. **Given** multiple bookmarks, **When** the user selects newest, oldest, or alphabetical order, **Then** the visible list follows that order.

### Edge Cases

- Saving an address already present in the library warns the user and points to the existing bookmark instead of silently creating a duplicate; the user may explicitly choose to save another copy.
- Addresses that omit a web scheme but otherwise resemble a valid website are normalized to a secure web address before saving; non-web schemes are rejected.
- Titles and tags containing leading or trailing whitespace are trimmed; blank titles and blank tags are not accepted.
- Repeated tags on one bookmark are treated as one tag without regard to letter case.
- Very long titles, addresses, notes, or tag lists are rejected at documented limits with an explanation that preserves the user's unsaved input.
- If a destination page is unavailable, the saved bookmark remains intact; opening failures do not delete or alter it.
- Search is case-insensitive and handles punctuation and partial words without producing an error.
- An empty library presents a clear invitation to add the first bookmark rather than an unexplained blank screen.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow the user to create a bookmark with a web address and title.
- **FR-002**: The system MUST allow optional notes, zero or more tags, and a favorite status on each bookmark.
- **FR-003**: The system MUST accept only web addresses using secure or standard web protocols and MUST explain validation failures without discarding entered values.
- **FR-004**: The system MUST normalize a website address that omits its protocol to use a secure web protocol before saving it.
- **FR-005**: The system MUST retain saved bookmarks and their details across user sessions.
- **FR-006**: The system MUST display all saved bookmarks with, at minimum, title, destination address, tags, favorite status, and creation date.
- **FR-007**: The user MUST be able to open a bookmark's destination from the library.
- **FR-008**: The user MUST be able to edit the address, title, notes, tags, and favorite status of an existing bookmark.
- **FR-009**: The user MUST be able to request deletion of a bookmark, and the system MUST require confirmation before permanent deletion.
- **FR-010**: The system MUST support case-insensitive search across bookmark titles, addresses, notes, and tags.
- **FR-011**: The system MUST support filtering by one tag and by favorite status, including use of both filters together.
- **FR-012**: The system MUST allow the visible bookmarks to be sorted by newest created, oldest created, or title in alphabetical order.
- **FR-013**: The system MUST warn when a submitted address already exists in the library, identify the existing bookmark, and require explicit confirmation before saving a duplicate.
- **FR-014**: The system MUST provide clear empty states for a library with no bookmarks and for a search or filter with no matches.
- **FR-015**: The system MUST make core create, browse, search, edit, and delete tasks usable on both small-screen and large-screen devices.
- **FR-016**: Bookmark data MUST remain private to the app's single user and MUST not be published or shared by the app.
- **FR-017**: The system MUST enforce and communicate these input limits: title up to 200 characters, address up to 2,048 characters, notes up to 2,000 characters, up to 20 tags per bookmark, and each tag up to 40 characters.

### Key Entities

- **Bookmark**: A saved web destination with a required address and title; optional notes and tags; a favorite status; and created and last-updated timestamps.
- **Tag**: A normalized label used to organize bookmarks. A tag can belong to many bookmarks, and a bookmark can have up to 20 distinct tags.
- **Library View**: The user's current search text, active tag and favorite filters, and selected sort order. It controls presentation but does not alter bookmark contents.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of first-time test participants can save their first valid bookmark and reopen it without assistance in under 60 seconds.
- **SC-002**: At least 95% of test participants can find a known bookmark in a library of 1,000 items using search or filters in under 10 seconds.
- **SC-003**: For a library of up to 10,000 bookmarks, 95% of user-initiated searches, filters, and sorts visibly update within 1 second under normal operating conditions.
- **SC-004**: In acceptance testing, 100% of saved bookmarks remain available with unchanged user-entered details after leaving and returning to the app.
- **SC-005**: At least 90% of test participants can edit and delete a bookmark on both small-screen and large-screen layouts without assistance on their first attempt.
- **SC-006**: All invalid-address, duplicate-address, empty-library, and no-result scenarios provide an actionable explanation rather than a blank or failed state.

## Assumptions

- The first release serves one user in a private library; account registration, multi-user permissions, sharing, and collaboration are outside scope.
- The app manages ordinary web links only. File links and other address schemes are outside scope.
- Adding a bookmark requires the user to supply its title; automatic page-metadata retrieval and page previews are outside scope.
- Tags are free-form labels. Nested folders, tag hierarchies, and smart collections are outside scope.
- Search covers the user's saved bookmark data; full-text indexing of destination-page contents is outside scope.
- Browser extensions, bulk import/export, link-health monitoring, offline copies of pages, and synchronization with third-party bookmark services are outside scope for this feature.
- Permanent deletion after confirmation is acceptable for the first release; trash recovery and version history are outside scope.
- Users have access to a modern web-capable device and a network connection when opening bookmark destinations.
