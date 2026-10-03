# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "An app to save and manage bookmarks"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A user has a web page they want to keep. They enter the page's address (and
optionally a title and notes) into the app and save it, so the link is stored
and available to return to later.

**Why this priority**: Saving links is the core reason the app exists. Without
it there is nothing to manage. This single capability is a usable product on
its own.

**Independent Test**: Add a bookmark by entering a URL, then confirm it appears
in the saved list and persists after reloading the app.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user enters a valid URL and
   saves, **Then** the bookmark appears in the list with its address.
2. **Given** the user is adding a bookmark, **When** they also provide a title
   and notes, **Then** those details are stored and shown with the bookmark.
3. **Given** the user enters text that is not a valid web address, **When** they
   try to save, **Then** the app rejects it with a clear message and does not
   create a bookmark.

---

### User Story 2 - Browse and find saved bookmarks (Priority: P2)

A user with many saved bookmarks wants to locate a specific one. They view the
list of saved bookmarks and can search or filter by keyword to narrow it down.

**Why this priority**: As the collection grows, the app is only useful if a user
can retrieve a specific link quickly. This builds directly on P1.

**Independent Test**: With several bookmarks saved, type a keyword and confirm
only matching bookmarks are shown, and clicking a bookmark opens its address.

**Acceptance Scenarios**:

1. **Given** several saved bookmarks, **When** the user opens the app, **Then**
   all bookmarks are listed with their titles and addresses.
2. **Given** several saved bookmarks, **When** the user searches for a keyword,
   **Then** only bookmarks whose title, address, or notes contain that keyword
   are shown.
3. **Given** a bookmark in the list, **When** the user selects it, **Then** its
   web address opens in a new browser tab.

---

### User Story 3 - Edit and delete bookmarks (Priority: P3)

A user wants to correct a bookmark's details or remove links they no longer
need, keeping the collection accurate and uncluttered.

**Why this priority**: Ongoing management keeps the collection valuable over
time, but the app already delivers value with saving and browsing alone.

**Independent Test**: Edit a saved bookmark's title and confirm the change
persists; delete a bookmark and confirm it is removed from the list.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user edits its title, address, or
   notes and saves, **Then** the updated details are shown and persist.
2. **Given** a saved bookmark, **When** the user deletes it, **Then** it is
   removed from the list and no longer appears after reload.
3. **Given** a delete action, **When** the user is asked to confirm, **Then** the
   bookmark is only removed after confirmation.

---

### User Story 4 - Organize with tags (Priority: P4)

A user assigns one or more tags (e.g. "work", "recipes") to bookmarks and later
filters the list by a tag to see a themed subset.

**Why this priority**: Organization is a valuable convenience but optional; the
app is fully functional without it.

**Independent Test**: Assign a tag to two bookmarks, filter by that tag, and
confirm only those two appear.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user adds one or more tags, **Then** the
   tags are stored and displayed with the bookmark.
2. **Given** tagged bookmarks, **When** the user filters by a tag, **Then** only
   bookmarks carrying that tag are shown.

---

### Edge Cases

- What happens when the user saves a bookmark whose URL is already saved? The
  app warns of the duplicate but allows the user to keep it.
- How does the app handle a very long title, notes, or URL? It stores and
  displays them without breaking the layout (truncating in the list view).
- What happens when a search or tag filter matches no bookmarks? The app shows a
  clear empty-result message rather than a blank screen.
- What happens on first use with no bookmarks yet? The app shows a welcoming
  empty state that invites the user to add their first bookmark.
- What happens if a URL omits its scheme (e.g. "example.com")? The app accepts it
  and normalizes it to a usable web address.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to save a bookmark by providing a web address.
- **FR-002**: Users MUST be able to add an optional title and optional notes to a
  bookmark.
- **FR-003**: The app MUST validate that the provided address is a well-formed web
  address and reject invalid input with a clear message.
- **FR-004**: The app MUST persist saved bookmarks so they remain available after
  the app is closed and reopened.
- **FR-005**: The app MUST display all saved bookmarks in a list showing at least
  the title and address.
- **FR-006**: Users MUST be able to search bookmarks by keyword, matching against
  title, address, and notes.
- **FR-007**: Users MUST be able to open a bookmark's web address.
- **FR-008**: Users MUST be able to edit a saved bookmark's title, address, and
  notes.
- **FR-009**: Users MUST be able to delete a bookmark, with a confirmation step
  before removal.
- **FR-010**: Users MUST be able to assign one or more tags to a bookmark and
  filter the list by a tag.
- **FR-011**: The app MUST warn the user when saving an address that duplicates an
  existing bookmark, while still allowing the save.
- **FR-012**: The app MUST show a clear empty state when there are no bookmarks and
  a clear no-results state when a search or filter matches nothing.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved link. Attributes: web address, optional title, optional
  notes, associated tags, and the date it was saved. Each bookmark is
  independent.
- **Tag**: A short label used to group bookmarks. A bookmark may have many tags,
  and a tag may apply to many bookmarks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark in under 20 seconds from opening the
  app.
- **SC-002**: A user can locate a specific bookmark within a collection of 100 in
  under 10 seconds using search or filtering.
- **SC-003**: 100% of saved bookmarks remain present and unchanged after closing
  and reopening the app.
- **SC-004**: 95% of first-time users successfully save and reopen a bookmark
  without external guidance.
- **SC-005**: Invalid web addresses are rejected 100% of the time with a message
  that tells the user how to correct the input.

## Assumptions

- This is a single-user application for v1; no multi-user accounts, sharing, or
  login are required.
- Bookmarks are stored locally for the individual user; cloud sync across devices
  is out of scope for v1.
- The app is used in a modern web browser on desktop; dedicated mobile apps are
  out of scope for v1, though the layout should remain usable on smaller screens.
- No automatic fetching of page titles, favicons, or link-health checking is
  required for v1 (titles are user-entered).
- Import/export of bookmarks (e.g. from a browser) is out of scope for v1.
