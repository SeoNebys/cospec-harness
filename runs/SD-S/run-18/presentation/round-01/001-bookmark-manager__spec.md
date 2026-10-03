# Feature Specification: Bookmark Manager

**Feature Branch**: `[001-bookmark-manager]`

**Created**: 2026-09-24

**Status**: Draft

**Input**: User description: "I want to build an app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save and revisit bookmarks (Priority: P1)

As a user, I want to save a web address with a useful title so that I can return to it later from one personal library.

**Why this priority**: Saving and reopening links is the core value of a bookmark manager; without it, the product has no viable purpose.

**Independent Test**: Save a valid web address, verify that it appears in the library after leaving and returning, and open it from the saved entry.

**Acceptance Scenarios**:

1. **Given** the user is viewing their library, **When** they save a valid web address and title, **Then** the new bookmark appears in the library with its title, web address, and creation date.
2. **Given** a bookmark exists, **When** the user selects it, **Then** the saved destination opens and the bookmark remains in the library.
3. **Given** the user enters an invalid or unsupported web address, **When** they try to save it, **Then** the bookmark is not created and the user sees a clear explanation of how to correct the address.
4. **Given** the same normalized web address already exists in the user's library, **When** the user tries to save it again, **Then** the app warns them and offers to view or update the existing bookmark rather than silently creating a duplicate.

---

### User Story 2 - Browse and organize bookmarks (Priority: P2)

As a user, I want to browse my saved bookmarks and assign tags so that related links are easy to group and rediscover.

**Why this priority**: A growing bookmark collection becomes difficult to use unless entries can be scanned and grouped.

**Independent Test**: Create several bookmarks, assign and remove tags, then verify that the library presents the saved information and tag groupings consistently.

**Acceptance Scenarios**:

1. **Given** the user has saved bookmarks, **When** they view the library, **Then** bookmarks are shown newest first by default with their title, destination, tags, and saved date.
2. **Given** a bookmark exists, **When** the user adds one or more tags, **Then** those tags appear on the bookmark and are available for filtering.
3. **Given** a tag is no longer useful on a bookmark, **When** the user removes it, **Then** the bookmark remains saved and the tag association is removed.

---

### User Story 3 - Find a saved bookmark (Priority: P3)

As a user, I want to search and filter my collection so that I can quickly find a bookmark without scanning the full library.

**Why this priority**: Retrieval is the main payoff of saving links, particularly once the collection becomes large.

**Independent Test**: Populate a library with bookmarks that differ by title, address, description, and tags; search and filter for known terms; and verify that only matching entries appear.

**Acceptance Scenarios**:

1. **Given** the library contains multiple bookmarks, **When** the user searches by text found in a title, web address, description, or tag, **Then** matching bookmarks are displayed.
2. **Given** bookmarks use several tags, **When** the user filters by a tag, **Then** only bookmarks carrying that tag are displayed.
3. **Given** no bookmarks match the current search or filter, **When** results are evaluated, **Then** the user sees a clear empty state and can reset the search or filters.
4. **Given** the user has entered a search term and selected a tag, **When** both controls are active, **Then** the displayed bookmarks satisfy both conditions.

---

### User Story 4 - Maintain saved bookmarks (Priority: P4)

As a user, I want to edit outdated bookmark details and remove bookmarks I no longer need so that my library stays accurate and useful.

**Why this priority**: Maintenance prevents stale or unwanted entries from reducing the quality of the collection.

**Independent Test**: Edit every user-maintained field of an existing bookmark, verify the changes persist, then delete the bookmark and confirm it no longer appears.

**Acceptance Scenarios**:

1. **Given** a bookmark exists, **When** the user changes its title, web address, description, or tags using valid values, **Then** the updated information is saved and shown throughout the library.
2. **Given** a bookmark exists, **When** the user requests deletion, **Then** the app asks for confirmation before permanently removing it.
3. **Given** the user cancels a deletion confirmation, **When** they return to the library, **Then** the bookmark remains unchanged.

### Edge Cases

- An address that omits a web scheme but is otherwise recognizable is normalized into a usable secure web address before validation.
- Web addresses using unsupported or unsafe schemes are rejected with a corrective message.
- Leading and trailing whitespace in text fields and tags is ignored; empty tags are not saved.
- Tag comparison is case-insensitive, so differently capitalized versions of the same tag do not create duplicate tags.
- Very long titles, descriptions, addresses, or tag lists are constrained with clear limits shown before submission and actionable validation messages when exceeded.
- If a saved destination is unavailable, the bookmark remains in the collection; opening it does not delete or silently change the stored entry.
- An empty library explains how to add the first bookmark rather than presenting a blank screen.
- Search is case-insensitive and ignores leading and trailing whitespace.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide each user with a private bookmark library that other users cannot view or modify.
- **FR-002**: Users MUST be able to create a bookmark with a web address and title, plus an optional description and zero or more tags.
- **FR-003**: The system MUST require a non-empty title and a valid web address using an approved web scheme before creating or updating a bookmark.
- **FR-004**: The system MUST normalize recognizable web addresses consistently before duplicate detection and storage.
- **FR-005**: The system MUST preserve saved bookmarks and their organization across user sessions until the user deletes them.
- **FR-006**: The library MUST display each bookmark's title, destination, tags, and saved date, ordered newest first by default.
- **FR-007**: Users MUST be able to open the saved destination from a bookmark entry.
- **FR-008**: The system MUST warn the user when a bookmark with the same normalized destination already exists and direct the user to the existing entry instead of silently duplicating it.
- **FR-009**: Users MUST be able to add existing tags, create new tags while editing a bookmark, and remove tag associations without deleting the bookmark.
- **FR-010**: Users MUST be able to search bookmarks by title, destination, description, and tag using case-insensitive text matching.
- **FR-011**: Users MUST be able to filter bookmarks by a selected tag and combine that filter with a text search.
- **FR-012**: Users MUST be able to clear active search and filter criteria in one action.
- **FR-013**: Users MUST be able to edit a bookmark's title, destination, description, and tags.
- **FR-014**: Users MUST be able to delete a bookmark only after an explicit confirmation step.
- **FR-015**: The system MUST display clear, actionable validation or empty-state guidance when an operation cannot be completed or no items match the current view.
- **FR-016**: Create, update, and delete actions MUST report a visible success or failure outcome to the user.

### Key Entities

- **User**: The owner of a private bookmark library; bookmarks and tags belong to exactly one user.
- **Bookmark**: A saved web destination with a required normalized web address and title, an optional description, a saved date, a last-updated date, and associations to zero or more tags.
- **Tag**: A user-defined organizational label with a display name; it can be associated with many bookmarks in the same user's library.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of first-time users can save their first valid bookmark without assistance in under 60 seconds.
- **SC-002**: Users can locate and open a known bookmark from a collection of 1,000 entries in under 10 seconds using search or tag filtering.
- **SC-003**: For a collection of 1,000 bookmarks, library views and search/filter results become usable within 2 seconds for at least 95% of attempts under normal operating conditions.
- **SC-004**: In acceptance testing, 100% of successful create, edit, tag, and delete operations remain correct after the user leaves and returns to the library.
- **SC-005**: At least 90% of usability-test participants complete the save, find, edit, and delete journeys on their first attempt without facilitator help.
- **SC-006**: No bookmark or tag belonging to one test user is visible or editable by another test user during access-control testing.

## Assumptions

- The first release is a responsive web experience for individual users; native mobile applications are outside this feature's scope.
- Users have an authenticated identity before accessing their private library. Registration, sign-in, password recovery, and identity-provider choices are supporting platform concerns, not bookmark-management scope.
- Supported destinations are standard web links; files, browser-internal pages, scripts, and other non-web address schemes are excluded.
- Bookmark metadata is entered and maintained by the user. Automatic page-title extraction, previews, availability checks, and content archiving are outside the first release.
- Sharing, collaborative collections, folders, favorites, browser extensions, bulk import/export, and automatic duplicate merging are outside the first release.
- A user may maintain at least 1,000 bookmarks without needing to archive or remove older entries.
- Permanent deletion after explicit confirmation is acceptable for the first release; a trash or recovery workflow is not included.
