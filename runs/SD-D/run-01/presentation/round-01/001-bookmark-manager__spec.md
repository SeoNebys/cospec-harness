# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "An app to save and manage bookmarks"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A person finds a web page they want to return to later. They save it in the app by
providing its address (URL). The app captures the page's title automatically where
possible, and the bookmark appears in their list so it can be found again.

**Why this priority**: Saving is the core reason the app exists. Without it, nothing
else has value. This alone is a usable product: capture links now, revisit later.

**Independent Test**: Add a bookmark by entering a URL, then confirm it appears in the
saved list with a recognizable title and its address intact.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user saves a valid URL, **Then** a new bookmark appears in the list showing its title and address.
2. **Given** a URL with no reachable title, **When** the user saves it, **Then** the bookmark is still saved and the address itself is shown as the title.
3. **Given** a bookmark that already exists with the same address, **When** the user tries to save it again, **Then** the app informs them it is already saved rather than creating a duplicate.

---

### User Story 2 - Browse and open saved bookmarks (Priority: P1)

The person opens the app and sees their saved bookmarks in a list. They can open any
bookmark's page in their browser with a single action.

**Why this priority**: Saved links are worthless if they cannot be viewed and opened.
This pairs with Story 1 to form the minimum viable product.

**Independent Test**: With several bookmarks saved, view the list and open one; confirm
the correct page is launched.

**Acceptance Scenarios**:

1. **Given** several saved bookmarks, **When** the user opens the app, **Then** all bookmarks are listed with title and address.
2. **Given** a bookmark in the list, **When** the user chooses to open it, **Then** its page is launched in the browser.
3. **Given** no bookmarks saved yet, **When** the user opens the app, **Then** a clear empty state invites them to add their first bookmark.

---

### User Story 3 - Edit and delete bookmarks (Priority: P2)

The person keeps their collection tidy by correcting a title, fixing an address, or
removing bookmarks they no longer need.

**Why this priority**: Management (not just saving) is in the app's name. Needed for a
collection to stay useful over time, but the app is still usable without it.

**Independent Test**: Change a saved bookmark's title, confirm the change persists; then
delete a bookmark and confirm it no longer appears.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user edits its title or address and saves, **Then** the updated values are shown and persist across sessions.
2. **Given** a saved bookmark, **When** the user deletes it, **Then** it is removed from the list.
3. **Given** a delete action, **When** the user confirms it, **Then** the bookmark is removed; **When** they cancel, **Then** nothing changes.

---

### User Story 4 - Organize with tags and search (Priority: P2)

As the collection grows, the person labels bookmarks with tags and searches or filters
to find what they need quickly.

**Why this priority**: Turns a flat list into a manageable collection. Valuable at scale
but not required for the first usable version.

**Independent Test**: Tag several bookmarks, filter by a tag, and search by keyword;
confirm only matching bookmarks are shown.

**Acceptance Scenarios**:

1. **Given** bookmarks with tags, **When** the user filters by a tag, **Then** only bookmarks carrying that tag are shown.
2. **Given** a search term, **When** the user searches, **Then** bookmarks whose title, address, or tags match the term are shown.
3. **Given** a search or filter with no matches, **When** it is applied, **Then** a clear "no results" state is shown.

---

### Edge Cases

- **Invalid address**: The user submits text that is not a valid web address — the app rejects it with a clear message and does not save.
- **Very long titles/addresses**: Titles and addresses are stored and displayed without breaking the layout (truncated with full value accessible).
- **Duplicate save**: Attempting to save an address that already exists surfaces the existing bookmark instead of duplicating it.
- **Unreachable page on save**: If the page's title cannot be retrieved, saving still succeeds using the address as the title.
- **Bulk data**: The list remains usable and responsive with a large number of bookmarks (e.g., thousands).
- **Deleting a tag in use**: Removing a tag from a bookmark does not delete the bookmark; a tag no longer used by any bookmark simply stops appearing in filters.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to save a bookmark by providing a web address (URL).
- **FR-002**: System MUST attempt to capture the page title automatically when a bookmark is saved, falling back to the address if no title is available.
- **FR-003**: System MUST validate that the provided address is a well-formed web address and reject invalid input with a clear message.
- **FR-004**: System MUST prevent duplicate bookmarks of the same address and inform the user when a duplicate is attempted.
- **FR-005**: System MUST persist saved bookmarks so they remain available across app restarts.
- **FR-006**: System MUST display all saved bookmarks in a list showing at least title and address.
- **FR-007**: Users MUST be able to open a bookmark's page in their web browser.
- **FR-008**: Users MUST be able to edit a bookmark's title and address.
- **FR-009**: Users MUST be able to delete a bookmark, with a confirmation step to prevent accidental loss.
- **FR-010**: Users MUST be able to assign one or more tags to a bookmark and remove tags.
- **FR-011**: Users MUST be able to filter the bookmark list by tag.
- **FR-012**: Users MUST be able to search bookmarks by keyword matching title, address, or tags.
- **FR-013**: System MUST show a clear empty state when no bookmarks exist and a "no results" state when a search or filter matches nothing.
- **FR-014**: System MUST record when each bookmark was saved and support ordering the list by most-recently-added.
- **FR-015**: Users MUST be able to optionally add a free-text note/description to a bookmark.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved link. Attributes: web address (URL), title, optional description/note, set of tags, date saved, date last modified.
- **Tag**: A short text label used to group bookmarks. A bookmark may have many tags; a tag may apply to many bookmarks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark in under 15 seconds from opening the app.
- **SC-002**: A user can locate a specific bookmark in a collection of 1,000 using search or filter in under 10 seconds.
- **SC-003**: 95% of saved bookmarks display a meaningful title (page title captured, not just the raw address) for reachable pages.
- **SC-004**: The bookmark list remains responsive (results appear within 1 second) with at least 5,000 saved bookmarks.
- **SC-005**: No bookmark data is lost across app restarts in 100% of normal-use sessions.
- **SC-006**: In usability testing, 90% of new users successfully save and re-open a bookmark on their first attempt without guidance.

## Assumptions

- **Single user, single device (v1)**: The app serves one user and stores bookmarks locally. Multi-user accounts, cloud sync, and cross-device sharing are out of scope for v1. *(This is the key open question below — please confirm.)*
- Bookmarks are web addresses (http/https); other URI schemes are out of scope for v1.
- Automatic title capture depends on the page being reachable at save time; failure falls back to the address and is not treated as an error.
- Import from and export to existing browser bookmark files is out of scope for v1 (candidate for a later release).
- The user has a working web browser available to open bookmark pages.
- Standard app expectations apply for error handling (clear messages) and data retention (bookmarks kept until the user deletes them).
