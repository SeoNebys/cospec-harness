# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-24

**Status**: Draft

**Input**: User description: "An app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A user comes across a web page they want to keep and saves it to the app by
providing its address. The app stores it so the user can return to it later.

**Why this priority**: Saving links is the core reason the app exists. Without
it, nothing else has value. This single capability is a usable product on its
own.

**Independent Test**: Enter a valid web address, save it, and confirm the new
bookmark appears in the user's list and reopens the original page.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user saves a bookmark with a
   valid address, **Then** the bookmark appears in the list with a title and its
   address.
2. **Given** the user submits an address without a title, **When** the bookmark
   is saved, **Then** the app derives a readable title (e.g. from the page or the
   address) so the entry is identifiable.
3. **Given** the user submits an entry with an invalid or empty address,
   **When** they attempt to save, **Then** the app rejects it with a clear
   message and does not create a bookmark.

---

### User Story 2 - Browse and find saved bookmarks (Priority: P1)

A user with many saved bookmarks views their collection and quickly locates a
specific one by searching or filtering.

**Why this priority**: Saved links are only useful if they can be found again.
Retrieval is as essential as saving for the app to deliver value.

**Independent Test**: With several bookmarks saved, view the full list, then
search by a keyword and confirm only matching bookmarks are shown.

**Acceptance Scenarios**:

1. **Given** several saved bookmarks, **When** the user opens the app, **Then**
   all bookmarks are displayed in a consistent order (most recently added first).
2. **Given** several saved bookmarks, **When** the user searches for a keyword,
   **Then** only bookmarks whose title, address, or tags match are shown.
3. **Given** a search that matches nothing, **When** results are shown, **Then**
   the app displays a clear empty-results state rather than an error.

---

### User Story 3 - Edit and delete bookmarks (Priority: P2)

A user corrects a bookmark's title or tags, or removes a bookmark they no longer
need.

**Why this priority**: Keeping the collection tidy and accurate matters for
long-term use, but the app is already usable for saving and finding without it.

**Independent Test**: Edit an existing bookmark's title and confirm the change
persists; delete a bookmark and confirm it no longer appears.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user edits its title or tags and
   saves, **Then** the updated values are shown and persist after reload.
2. **Given** an existing bookmark, **When** the user deletes it and confirms,
   **Then** it is removed from the list and no longer appears after reload.
3. **Given** a delete action, **When** the user is asked to confirm, **Then**
   the bookmark is only removed after explicit confirmation.

---

### User Story 4 - Organize bookmarks with tags (Priority: P3)

A user labels bookmarks with tags and filters their collection by a tag to group
related links.

**Why this priority**: Organization improves the experience for large
collections but is not required for the core save-and-retrieve loop.

**Independent Test**: Assign a tag to two bookmarks, filter by that tag, and
confirm only those two are shown.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user adds one or more tags, **Then** the
   tags are shown with the bookmark.
2. **Given** bookmarks with tags, **When** the user filters by a tag, **Then**
   only bookmarks carrying that tag are shown.

---

### Edge Cases

- What happens when the user tries to save a bookmark whose address is already
  saved? (Assumption: the app warns of the duplicate but allows it.)
- How does the system handle a very long title or address? (Displayed
  truncated but stored in full.)
- What happens when the app cannot reach a page to derive its title? (Falls back
  to using the address as the title; saving still succeeds.)
- How does the system handle an address missing a scheme, e.g. `example.com`?
  (Assumption: a common scheme is assumed so the link still opens.)
- What happens when the user searches or filters and no bookmark matches?
  (Empty-results state, not an error.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST allow a user to save a bookmark consisting of a web
  address and a title, with optional tags and an optional note.
- **FR-002**: The app MUST validate that a bookmark has a usable web address
  before saving and reject entries that do not.
- **FR-003**: The app MUST derive a readable title automatically when the user
  does not supply one.
- **FR-004**: The app MUST persist saved bookmarks so they remain available
  across sessions and after reload.
- **FR-005**: The app MUST display all saved bookmarks in a consistent, defined
  order (most recently added first by default).
- **FR-006**: Users MUST be able to search bookmarks by keyword, matching against
  title, address, and tags.
- **FR-007**: Users MUST be able to edit an existing bookmark's title, tags, and
  note.
- **FR-008**: Users MUST be able to delete a bookmark, with an explicit
  confirmation step before removal.
- **FR-009**: Users MUST be able to open a bookmark's original page from the app.
- **FR-010**: Users MUST be able to assign tags to bookmarks and filter the
  collection by a tag.
- **FR-011**: The app MUST show clear, user-friendly messages for validation
  errors and empty states.
- **FR-012**: The app MUST warn the user when saving an address that already
  exists in their collection.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved link. Key attributes: web address, title, optional note,
  set of tags, creation timestamp, last-updated timestamp.
- **Tag**: A short label used to group bookmarks. A bookmark may have many tags;
  a tag may apply to many bookmarks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark in under 30 seconds from opening the
  app.
- **SC-002**: A user can locate a specific bookmark among at least 100 saved
  entries in under 10 seconds using search or filter.
- **SC-003**: Saved bookmarks persist with 100% reliability across app restarts
  and reloads.
- **SC-004**: 95% of first-time users successfully save and reopen a bookmark
  without external instructions.
- **SC-005**: The bookmark list remains responsive (results appear within 1
  second) with at least 1,000 saved bookmarks.

## Assumptions

- This is a single-user personal app for the first version; multi-user accounts,
  sharing, and authentication are out of scope for v1.
- The app is a web application reviewed in a browser.
- Bookmarks are stored locally to the app's environment; syncing across devices
  and cloud backup are out of scope for v1.
- Importing bookmarks from browsers and exporting them are out of scope for v1.
- When a title is not provided, the app derives one from the page where possible
  and otherwise falls back to the address.
- Duplicate addresses are permitted but the user is warned.
- Addresses without an explicit scheme are assumed to use a common web scheme so
  they remain openable.
