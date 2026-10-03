# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "I want to build an app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A person finds a web page they want to keep and saves it to the app by
providing its address. The app records the page so it can be returned to later.

**Why this priority**: Saving is the core reason the app exists. Without it
there is nothing to manage. This single story is a viable MVP on its own.

**Independent Test**: Enter a valid web address, confirm the bookmark appears in
the saved list with a recognisable title and remains there after reloading.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user submits a valid web
   address, **Then** a new bookmark is added to the list showing its title and
   address.
2. **Given** the user submits an address without a title, **When** the bookmark
   is saved, **Then** the app derives a readable title from the address so the
   entry is still recognisable.
3. **Given** the user submits an invalid or empty address, **When** they try to
   save, **Then** the app rejects it with a clear message and saves nothing.

---

### User Story 2 - Browse and find saved bookmarks (Priority: P2)

The user opens the app and sees their saved bookmarks. As the collection grows
they search or filter by keyword to locate a specific one quickly.

**Why this priority**: A saved bookmark has no value if it cannot be found
again. Retrieval makes the collection usable, but depends on saving existing
first.

**Independent Test**: With several bookmarks saved, type a keyword and confirm
only matching bookmarks are shown; clear the keyword and confirm all return.

**Acceptance Scenarios**:

1. **Given** several saved bookmarks, **When** the user opens the app, **Then**
   all bookmarks are listed with their titles and addresses.
2. **Given** several saved bookmarks, **When** the user enters a keyword,
   **Then** only bookmarks whose title, address, or tag matches are shown.
3. **Given** a keyword that matches nothing, **When** the search runs, **Then**
   the app shows a clear "no matches" state rather than an empty error.

---

### User Story 3 - Organise, edit, and remove bookmarks (Priority: P3)

The user keeps the collection tidy by editing a bookmark's title, grouping
bookmarks with tags, and deleting ones no longer needed.

**Why this priority**: Organisation and cleanup preserve long-term usefulness
but are not required for the app to deliver initial value.

**Independent Test**: Edit a bookmark's title and confirm the change persists;
add a tag and filter by it; delete a bookmark and confirm it is gone after
reload.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user edits its title or tags and
   saves, **Then** the updated values are shown and persist after reload.
2. **Given** an existing bookmark, **When** the user deletes it and confirms,
   **Then** it is removed from the list and does not reappear after reload.
3. **Given** bookmarks with tags, **When** the user selects a tag, **Then** only
   bookmarks carrying that tag are shown.

---

### Edge Cases

- What happens when the user saves the same address twice? The app flags it as a
  possible duplicate rather than silently creating two identical entries.
- How does the app handle a very long title or address? It stores and displays
  it without breaking the layout, truncating in the list view where needed.
- What happens when a delete is requested by mistake? The action requires
  confirmation before the bookmark is removed.
- How does the app behave with no bookmarks saved yet? It shows a friendly empty
  state inviting the user to add their first bookmark.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to save a bookmark by providing a web
  address, with an optional title and optional tags.
- **FR-002**: System MUST validate the submitted address and reject empty or
  malformed addresses with a clear message.
- **FR-003**: System MUST derive a readable title from the address when the user
  does not supply one.
- **FR-004**: System MUST persist saved bookmarks so they remain available after
  the app is closed and reopened.
- **FR-005**: System MUST display all saved bookmarks in a list showing at least
  the title and address.
- **FR-006**: Users MUST be able to search or filter bookmarks by keyword
  matching title, address, or tag.
- **FR-007**: Users MUST be able to edit an existing bookmark's title and tags.
- **FR-008**: Users MUST be able to delete a bookmark, with a confirmation step
  before removal.
- **FR-009**: Users MUST be able to assign one or more tags to a bookmark and
  filter the list by a selected tag.
- **FR-010**: System MUST warn the user when saving an address that already
  exists in the collection.
- **FR-011**: System MUST show a clear empty state when no bookmarks exist and a
  clear "no matches" state when a search returns nothing.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved web reference. Key attributes: web address, title,
  optional tags, and the date it was saved.
- **Tag**: A short label used to group related bookmarks. A bookmark may carry
  several tags; a tag may apply to many bookmarks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark in under 20 seconds from opening the
  app.
- **SC-002**: A user can locate a specific bookmark among 100 saved entries in
  under 10 seconds using search or tag filtering.
- **SC-003**: 100% of saved bookmarks remain present and unchanged after closing
  and reopening the app.
- **SC-004**: 90% of first-time users successfully save and later retrieve a
  bookmark without external help.

## Assumptions

- This is a single-user personal app for the first version; multi-user accounts,
  sign-in, and sharing are out of scope for v1.
- The app runs as a web application accessed through a browser.
- Bookmarks are stored locally to the app's environment; syncing across devices
  and cloud backup are out of scope for v1.
- The app does not need to fetch or archive the full contents of bookmarked
  pages; it stores the reference and a title only.
- Importing bookmarks from a browser or exporting them is out of scope for v1.
- Standard web app expectations apply for performance and error handling.
