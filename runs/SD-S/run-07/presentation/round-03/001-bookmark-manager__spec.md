# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "Build an app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A person finds a web page they want to return to later. They paste or enter its
web address into the app and save it. The app captures the page so it appears in
their list of saved bookmarks.

**Why this priority**: Saving a link is the core reason the app exists. Without
it there is nothing to manage. This single story is a usable product on its own.

**Independent Test**: Enter a valid web address, save it, and confirm it appears
in the bookmark list with a recognizable title and its address.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user saves a valid web address,
   **Then** a new bookmark appears in the list showing its title and address.
2. **Given** the save form, **When** the user submits without a web address,
   **Then** the app rejects the entry and explains that an address is required.
3. **Given** the save form, **When** the user enters text that is not a valid web
   address, **Then** the app rejects it and explains the address is invalid.

---

### User Story 2 - Browse and find saved bookmarks (Priority: P1)

The person opens the app and sees all the bookmarks they have saved, most recent
first. They can search by keyword to quickly locate a specific bookmark among
many.

**Why this priority**: A saved bookmark has no value if it cannot be found again.
Viewing and searching are what make the collection "managed" rather than a dead
pile of links.

**Independent Test**: With several bookmarks saved, open the list and confirm all
appear; type a keyword and confirm the list narrows to matching bookmarks.

**Acceptance Scenarios**:

1. **Given** several saved bookmarks, **When** the user opens the app, **Then**
   all bookmarks are listed with the most recently saved shown first.
2. **Given** a list of bookmarks, **When** the user types a keyword that matches
   a bookmark's title or address, **Then** only matching bookmarks are shown.
3. **Given** a search keyword with no matches, **When** the search runs, **Then**
   the app shows a clear "no results" message.
4. **Given** a bookmark in the list, **When** the user activates it, **Then** the
   original web page opens in a new browser tab.

---

### User Story 3 - Edit and delete bookmarks (Priority: P2)

The person wants to correct a bookmark's title, or remove bookmarks they no
longer need, so the collection stays accurate and uncluttered.

**Why this priority**: Keeping the collection clean is important for long-term
use but the app is already useful for saving and finding links without it.

**Independent Test**: Edit a saved bookmark's title and confirm the change
persists; delete a bookmark and confirm it disappears from the list.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user edits its title and saves,
   **Then** the list shows the updated title.
2. **Given** an existing bookmark, **When** the user deletes it and confirms,
   **Then** the bookmark is removed from the list and does not reappear on
   reload.
3. **Given** a delete action, **When** the user is asked to confirm, **Then** no
   bookmark is removed unless the user confirms.

---

### User Story 4 - Organize bookmarks with tags (Priority: P3)

The person labels bookmarks with one or more tags (e.g. "work", "recipes") and
later filters the list to a single tag to see only related bookmarks.

**Why this priority**: Organization adds convenience for larger collections but
is not required for the app to deliver value at smaller scale.

**Independent Test**: Add a tag to a bookmark, then filter by that tag and
confirm only bookmarks carrying it are shown.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user adds one or more tags, **Then** the
   tags are shown on the bookmark.
2. **Given** bookmarks with different tags, **When** the user filters by a tag,
   **Then** only bookmarks carrying that tag are shown.

---

### Edge Cases

- What happens when the user saves an address that is already bookmarked? The app
  warns of the duplicate and does not create a second identical entry.
- What happens when a saved page's title cannot be retrieved automatically? The
  app falls back to using the address itself as the title, which the user can
  later edit.
- How does the system handle very long titles or addresses? They are stored in
  full and shown truncated in the list so layout is preserved.
- What happens on first use with no bookmarks yet? The app shows a friendly empty
  state inviting the user to save their first bookmark.
- How does the system handle a search or tag filter that matches nothing? A clear
  "no results" message is shown with a way to clear the filter.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to save a bookmark by providing a web address.
- **FR-002**: System MUST validate that a saved address is a well-formed web
  address and reject empty or malformed entries with a clear message.
- **FR-003**: System MUST record a title for each bookmark, attempting to derive
  it from the page automatically and falling back to the address when a title is
  unavailable.
- **FR-004**: Users MUST be able to provide or edit a bookmark's title.
- **FR-005**: System MUST persist bookmarks so they remain available after the
  user closes and reopens the app.
- **FR-006**: System MUST display all saved bookmarks in a list ordered with the
  most recently saved first.
- **FR-007**: Users MUST be able to search bookmarks by keyword matching the
  title or address, and see only matching results.
- **FR-008**: Users MUST be able to open a bookmarked page from the list, which
  opens in a new browser tab.
- **FR-009**: Users MUST be able to edit an existing bookmark's title.
- **FR-010**: Users MUST be able to delete a bookmark, with a confirmation step
  before removal.
- **FR-011**: System MUST warn the user when saving an address that already
  exists and MUST NOT create a duplicate identical entry.
- **FR-012**: Users MUST be able to assign one or more tags to a bookmark and
  filter the list to a chosen tag.
- **FR-013**: System MUST show a clear empty state when no bookmarks exist and a
  clear "no results" state when a search or filter matches nothing.
- **FR-014**: System MUST record the date and time each bookmark was saved.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved web page. Key attributes: web address, title, optional
  tags, and the date/time it was saved. Belongs to the collection of the person
  who saved it.
- **Tag**: A short user-defined label used to group related bookmarks. A bookmark
  may carry several tags; a tag may apply to many bookmarks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark in under 15 seconds from opening the
  app to seeing it in the list.
- **SC-002**: A user can locate a specific bookmark within a collection of 100 in
  under 10 seconds using search.
- **SC-003**: 95% of first-time users successfully save and re-find a bookmark on
  their first attempt without external help.
- **SC-004**: Saved bookmarks remain available across 100% of app restarts (no
  data loss).
- **SC-005**: The bookmark list is visible and interactive within 2 seconds of
  opening the app for a collection of up to 500 bookmarks.

## Assumptions

- The app is a single-user personal tool for its first version; multi-user
  accounts, sharing, and sign-in are out of scope for v1.
- The app is used through a web browser on a desktop or laptop; a dedicated
  mobile app is out of scope for v1.
- Bookmarks are stored locally within the app's own persistence; syncing across
  multiple devices is out of scope for v1.
- Automatic title retrieval depends on the target page being reachable; when it
  is not, the address is used as the title.
- Importing or exporting bookmarks from other browsers or services is out of
  scope for v1.
- "Most recent first" ordering is the default; user-configurable sort orders are
  out of scope for v1.
