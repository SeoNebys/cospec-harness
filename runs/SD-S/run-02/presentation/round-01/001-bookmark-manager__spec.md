# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "Build an app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A person finds a web page they want to return to later. They paste or enter the
page's address, optionally give it a title, and save it. The bookmark then
appears in their list of saved bookmarks.

**Why this priority**: Saving is the core purpose of the app. Without it there
is nothing to manage. This single story is a viable MVP: a user can capture
links and see them persist.

**Independent Test**: Enter a valid web address, save it, and confirm it appears
in the list and is still present after reloading or reopening the app.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user enters a valid web
   address and saves, **Then** the bookmark appears in the list with its address
   and title.
2. **Given** the user enters an address without a title, **When** they save,
   **Then** the bookmark is saved and shown using the address (or a derived
   name) as its display title.
3. **Given** a saved bookmark, **When** the user reloads or reopens the app,
   **Then** the bookmark is still present.

---

### User Story 2 - Browse and open saved bookmarks (Priority: P1)

A person opens the app to see everything they have saved and clicks a bookmark
to open the original page in their browser.

**Why this priority**: Saved links have no value unless they can be viewed and
revisited. Combined with Story 1 this forms the minimum useful product.

**Independent Test**: With several bookmarks saved, view the full list and click
one to confirm it opens the correct destination in a new browser tab.

**Acceptance Scenarios**:

1. **Given** several saved bookmarks, **When** the user opens the app, **Then**
   all saved bookmarks are listed with their titles and addresses.
2. **Given** a bookmark in the list, **When** the user activates it, **Then**
   the original web page opens in a new browser tab.
3. **Given** no bookmarks have been saved, **When** the user opens the app,
   **Then** a clear empty state invites them to add their first bookmark.

---

### User Story 3 - Edit and delete bookmarks (Priority: P2)

A person corrects a bookmark's title or address, or removes a bookmark they no
longer need.

**Why this priority**: Management (keeping the collection tidy and accurate) is
the second half of the request, but the collection is still useful without it.

**Independent Test**: Edit an existing bookmark's title and confirm the change
persists; delete a bookmark and confirm it disappears and stays gone after
reload.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user edits its title or address
   and saves, **Then** the updated values are shown and persist after reload.
2. **Given** an existing bookmark, **When** the user deletes it and confirms,
   **Then** it is removed from the list and does not reappear after reload.
3. **Given** a delete action, **When** the user is asked to confirm, **Then**
   they can cancel and the bookmark remains.

---

### User Story 4 - Find bookmarks quickly (Priority: P3)

A person with many saved bookmarks searches or filters by keyword to locate a
specific one without scrolling through the whole list.

**Why this priority**: Improves usability at scale but is not needed for a
functional first version.

**Independent Test**: With many bookmarks saved, type a keyword and confirm only
matching bookmarks (by title or address) are shown.

**Acceptance Scenarios**:

1. **Given** many saved bookmarks, **When** the user types a keyword, **Then**
   only bookmarks whose title or address matches the keyword are shown.
2. **Given** a search with no matches, **When** results are displayed, **Then** a
   clear "no results" message is shown.
3. **Given** an active search, **When** the user clears the keyword, **Then** the
   full list is shown again.

---

### Edge Cases

- What happens when the user submits an empty address or one that is not a valid
  web address? The app rejects it with a clear message and does not save.
- What happens when the user tries to save an address that is already bookmarked?
  The app warns of the duplicate and does not create a second identical entry.
- How does the app handle a very long title or address? It stores the full value
  and displays it without breaking the layout (e.g., truncates visually).
- What happens when the list is empty? A friendly empty state is shown.
- What happens if the user cancels an edit midway? No changes are saved.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to save a bookmark consisting of a web
  address and an optional title.
- **FR-002**: System MUST validate that the address is a well-formed web address
  before saving and reject invalid input with a clear message.
- **FR-003**: System MUST, when no title is provided, display the bookmark using
  the address or a name derived from it.
- **FR-004**: System MUST persist saved bookmarks so they remain available after
  the app is reloaded or reopened.
- **FR-005**: System MUST display all saved bookmarks in a list showing each
  bookmark's title and address.
- **FR-006**: Users MUST be able to open a bookmark's original web page from the
  list (in a new browser tab).
- **FR-007**: Users MUST be able to edit an existing bookmark's title and
  address, with changes persisted.
- **FR-008**: Users MUST be able to delete a bookmark, with a confirmation step
  before removal.
- **FR-009**: System MUST prevent saving a duplicate of an address that is
  already bookmarked and inform the user.
- **FR-010**: System MUST show a clear empty state when no bookmarks exist.
- **FR-011**: Users MUST be able to search or filter bookmarks by keyword
  matching the title or address.
- **FR-012**: System MUST record when each bookmark was added and present
  bookmarks in a predictable order (most recently added first by default).

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved reference to a web page. Key attributes: web address,
  display title, and the date/time it was added. Optionally a short note or
  tags may be associated with it (see Assumptions for scope).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark in under 15 seconds from opening the
  app.
- **SC-002**: 100% of saved bookmarks remain available after the app is reloaded
  or reopened.
- **SC-003**: A user can locate a specific bookmark among at least 100 saved
  bookmarks in under 10 seconds using search.
- **SC-004**: Invalid or duplicate addresses are rejected in 100% of attempts,
  each with a clear explanation.
- **SC-005**: The bookmark list renders and becomes usable within 2 seconds for
  a collection of up to 500 bookmarks.

## Assumptions

- This is a single-user application for a first version; multi-user accounts,
  sign-in, and sharing are out of scope for v1.
- Bookmarks are stored locally/persistently for that single user; cloud sync
  across devices is out of scope for v1.
- Organizational features beyond keyword search — such as tags, folders, and
  free-text notes — are out of scope for v1 but the data model should not
  preclude adding them later.
- Automatically fetching a page's real title, favicon, or preview is a
  nice-to-have and out of scope for v1; the user-entered or address-derived
  title is sufficient.
- The app is used through a modern web browser on desktop; dedicated mobile apps
  are out of scope for v1, though the layout should remain readable on smaller
  screens.
- "Valid web address" means an http or https URL.
