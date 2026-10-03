# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-24

**Status**: Draft

**Input**: User description: "An app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A person finds a web page worth keeping and saves its address into the app so they can return to it later. They provide the link and, optionally, a title; the app stores it and shows it in their list of saved bookmarks.

**Why this priority**: Saving links is the core reason the app exists. Without it, nothing else has value. This single story is a usable MVP: capture a link and see it in a list.

**Independent Test**: Add a bookmark by entering a URL, then confirm it appears in the saved list with a recognisable title and remains after reloading the app.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user submits a valid URL, **Then** a new bookmark appears in the list showing its title and address.
2. **Given** the user submits a URL without a title, **When** the bookmark is saved, **Then** the app derives a readable title (e.g. from the address) so the entry is not blank.
3. **Given** the user submits an entry that is not a valid web address, **When** they try to save, **Then** the app rejects it with a clear message and saves nothing.

---

### User Story 2 - Browse, search and open bookmarks (Priority: P2)

A person with many saved bookmarks wants to find a specific one quickly, and open it in their browser.

**Why this priority**: A growing collection is only useful if items can be found and reached again. This builds directly on the saved list from Story 1.

**Independent Test**: With several bookmarks saved, type a word into the search box and confirm only matching bookmarks remain visible, then click one and confirm it opens the correct address.

**Acceptance Scenarios**:

1. **Given** multiple saved bookmarks, **When** the user types text into the search field, **Then** the list narrows to bookmarks whose title, address, or tags contain that text.
2. **Given** a bookmark in the list, **When** the user activates it, **Then** its web address opens in a new browser tab.
3. **Given** a search that matches nothing, **When** results are shown, **Then** the app displays a clear "no matching bookmarks" state.

---

### User Story 3 - Organise and edit bookmarks (Priority: P3)

A person curates their collection over time: editing a title, adding tags to group related links, and deleting bookmarks they no longer need.

**Why this priority**: Organisation keeps a large collection manageable, but the app is already valuable without it. It is an enhancement over save/find.

**Independent Test**: Edit a saved bookmark's title and tags, confirm the changes persist, then delete a bookmark and confirm it disappears from the list permanently.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user edits its title or tags and saves, **Then** the updated values are shown and persist across reloads.
2. **Given** an existing bookmark, **When** the user deletes it and confirms, **Then** it is removed from the list and does not reappear.
3. **Given** bookmarks with tags, **When** the user filters by a tag, **Then** only bookmarks carrying that tag are shown.

---

### Edge Cases

- What happens when the user tries to save a URL that is already bookmarked? (The app flags the duplicate and does not create a second identical entry.)
- How does the system handle a very long title or address? (Displayed text is truncated gracefully; the full value is preserved.)
- What happens when a saved link later becomes unreachable? (The bookmark remains in the list; the app does not silently delete it.)
- How does the system handle deleting a bookmark by mistake? (Deletion asks for confirmation before removing.)
- What happens when the search or tag filter returns no results? (A clear empty-state message is shown rather than a blank screen.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to save a bookmark by providing a web address, with an optional title and optional tags.
- **FR-002**: System MUST validate that a submitted address is a well-formed web URL and reject invalid entries with a clear message.
- **FR-003**: System MUST derive a readable title when the user does not supply one, so no bookmark is displayed blank.
- **FR-004**: System MUST persist saved bookmarks so they remain available after the app is closed and reopened.
- **FR-005**: Users MUST be able to view all saved bookmarks in a list.
- **FR-006**: Users MUST be able to search bookmarks by text matching against title, address, and tags.
- **FR-007**: Users MUST be able to open a bookmark's address in their web browser.
- **FR-008**: Users MUST be able to edit a saved bookmark's title and tags.
- **FR-009**: Users MUST be able to delete a bookmark, with a confirmation step before removal.
- **FR-010**: Users MUST be able to assign one or more tags to a bookmark and filter the list by tag.
- **FR-011**: System MUST detect when a submitted address duplicates an existing bookmark and prevent a duplicate entry.
- **FR-012**: System MUST display clear empty states (no bookmarks yet; no search/filter matches).

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved link. Key attributes: web address, title, optional description/note, set of tags, date saved. Belongs to the collection of the person who saved it.
- **Tag**: A short label used to group related bookmarks. A bookmark may carry several tags; a tag may apply to many bookmarks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark in under 15 seconds from opening the save action.
- **SC-002**: A user can locate a specific bookmark among at least 500 saved items in under 5 seconds using search or tag filter.
- **SC-003**: 100% of saved bookmarks remain present and correct after the app is closed and reopened.
- **SC-004**: Search and filter results update within 1 second of the user finishing their input.
- **SC-005**: 95% of first-time users successfully save and later re-open a bookmark without external help.

## Assumptions

- Single-user, personal use is the target for v1; multi-user accounts, sharing, and collaboration are out of scope.
- The app runs as a web application accessed through a browser.
- Bookmarks are stored for the user; no automatic expiry or retention limit is applied.
- Importing bookmarks from a browser or file, and exporting them, are out of scope for v1.
- Automatic fetching of page metadata beyond a basic derived title (e.g. thumbnails, favicons, full page previews) is out of scope for v1.
- Users have a modern web browser and stable internet connectivity.
