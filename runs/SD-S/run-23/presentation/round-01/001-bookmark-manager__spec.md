# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-25

**Status**: Draft

**Input**: User description: "An app to save and manage bookmarks"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A user finds a web page they want to keep and saves it to the app by entering
its address, optionally giving it a title, so they can return to it later.

**Why this priority**: Saving is the core reason the app exists. Without it, no
other feature has anything to act on. This slice alone delivers value: a user
can capture links they care about in one place.

**Independent Test**: Can be fully tested by adding a bookmark with an address
and confirming it appears in the saved list and persists after reloading.

**Acceptance Scenarios**:

1. **Given** an empty list, **When** the user submits a valid web address,
   **Then** the bookmark is saved and shown in the list.
2. **Given** the user submits an address with a custom title, **When** it is
   saved, **Then** the list shows that title instead of the raw address.
3. **Given** the user submits an entry with no address, **When** they try to
   save, **Then** the app rejects it with a clear message and saves nothing.

---

### User Story 2 - Browse and open saved bookmarks (Priority: P1)

A user opens the app to see everything they have saved and clicks a bookmark to
open the original page in their browser.

**Why this priority**: Saved links are only useful if they can be found and
reopened. Together with Story 1 this forms the minimum viable product.

**Independent Test**: Can be tested by viewing a list of previously saved
bookmarks and confirming each opens its target address in a new browser tab.

**Acceptance Scenarios**:

1. **Given** several saved bookmarks, **When** the user opens the app, **Then**
   all bookmarks are listed with their titles and addresses.
2. **Given** a listed bookmark, **When** the user activates it, **Then** the
   target page opens in a new browser tab.
3. **Given** no bookmarks exist, **When** the user opens the app, **Then** a
   friendly empty state invites them to add their first bookmark.

---

### User Story 3 - Edit and delete bookmarks (Priority: P2)

A user corrects a title or address on an existing bookmark, or removes a
bookmark they no longer need.

**Why this priority**: Keeping the collection accurate and uncluttered is
important for "managing" bookmarks, but the app is already useful without it.

**Independent Test**: Can be tested by changing a saved bookmark's title and
confirming the change persists, and by deleting a bookmark and confirming it
no longer appears.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user edits its title or address and
   saves, **Then** the updated values are shown and persist after reload.
2. **Given** a saved bookmark, **When** the user deletes it and confirms,
   **Then** it is removed from the list permanently.
3. **Given** a delete action, **When** it is triggered, **Then** the user is
   asked to confirm before the bookmark is removed.

---

### User Story 4 - Find bookmarks (Priority: P3)

A user with many saved bookmarks searches or filters to quickly locate a
specific one.

**Why this priority**: Valuable as a collection grows, but not needed for a
small collection or an initial release.

**Independent Test**: Can be tested by entering a search term and confirming
only matching bookmarks remain visible.

**Acceptance Scenarios**:

1. **Given** many bookmarks, **When** the user types a search term, **Then**
   only bookmarks whose title or address matches are shown.
2. **Given** a search with no matches, **When** results are shown, **Then** a
   clear "no results" message is displayed.

---

### Edge Cases

- What happens when the user submits an address without a scheme (e.g.
  `example.com`)? The app assumes `https://` and saves a usable link.
- What happens when the user submits a malformed address? The app rejects it
  with a clear validation message.
- What happens when the user saves a duplicate address? The app saves it but
  flags that a bookmark with the same address already exists.
- How does the system handle a very long title or address? It stores it and
  displays it without breaking the layout (truncated with full value available).
- What happens when the underlying page no longer exists? The bookmark still
  opens; the app does not guarantee link liveness.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to save a bookmark consisting of a web
  address and an optional title.
- **FR-002**: System MUST validate that a submitted address is a well-formed web
  link before saving, and reject invalid entries with a clear message.
- **FR-003**: System MUST assume an `https://` scheme when the user omits one.
- **FR-004**: When no title is provided, System MUST display the address (or its
  host) as the bookmark's label.
- **FR-005**: System MUST display all saved bookmarks in a list.
- **FR-006**: Users MUST be able to open a bookmark's target address in a new
  browser tab.
- **FR-007**: Users MUST be able to edit the title and address of an existing
  bookmark.
- **FR-008**: Users MUST be able to delete a bookmark, with a confirmation step
  before removal.
- **FR-009**: System MUST persist bookmarks so they remain available after the
  app is closed and reopened.
- **FR-010**: System MUST record when each bookmark was created and order the
  list with the most recently added first by default.
- **FR-011**: Users MUST be able to search/filter bookmarks by title or address.
- **FR-012**: System MUST show a friendly empty state when no bookmarks exist
  and a "no results" state when a search matches nothing.
- **FR-013**: System MUST warn the user when saving an address that duplicates
  an existing bookmark, while still allowing the save.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved link. Key attributes: web address (required), title
  (optional label), creation timestamp, last-updated timestamp. Optionally a
  short note/description for future extension.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark in under 15 seconds from opening
  the app.
- **SC-002**: 95% of first-time users successfully save and reopen a bookmark
  without external guidance.
- **SC-003**: Saved bookmarks persist across app restarts with zero data loss in
  normal use.
- **SC-004**: A user can locate a specific bookmark in a collection of 200 in
  under 5 seconds using search.
- **SC-005**: The bookmark list is visible within 2 seconds of opening the app.

## Assumptions

- Single-user, single-device use for the initial release; multi-user accounts,
  authentication, and cross-device sync are out of scope for v1.
- Bookmarks are for web (http/https) addresses only.
- The app is a web application accessed through a modern browser.
- The app does not fetch page metadata (title, favicon) automatically in v1;
  titles are user-provided. This may be added later.
- Import/export of bookmarks and browser integration (extensions) are out of
  scope for v1.
- Tags/folders/categories are out of scope for v1 (search covers organization
  needs initially).
