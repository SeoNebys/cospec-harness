# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-25

**Status**: Draft

**Input**: User description: "An app to save and manage bookmarks"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A person finds a web page they want to return to later. They enter its address
into the app and save it. The bookmark is stored and appears in their list so
they can find it again.

**Why this priority**: Saving links is the core reason the app exists. Without
it there is nothing to manage. This single story is a viable MVP on its own.

**Independent Test**: Add a bookmark by entering an address, then confirm it
appears in the list and remains present after reloading the app.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user enters a valid web
   address and saves it, **Then** a new bookmark is created and shown in the
   list.
2. **Given** a bookmark being saved, **When** the user does not provide a title,
   **Then** the app derives a readable title from the page or its address so the
   bookmark is not blank.
3. **Given** the user enters a value that is not a valid web address, **When**
   they try to save, **Then** the app rejects it with a clear message and does
   not create a bookmark.

---

### User Story 2 - Browse and find bookmarks (Priority: P2)

A person who has saved many bookmarks wants to locate a specific one. They
browse the full list and use search to narrow it down by title or address.

**Why this priority**: A growing collection is only useful if items can be found
again. This makes the saved data usable but depends on Story 1 existing first.

**Independent Test**: With several bookmarks saved, search for a keyword and
confirm only the matching bookmarks are shown.

**Acceptance Scenarios**:

1. **Given** several saved bookmarks, **When** the user opens the app, **Then**
   all bookmarks are listed with their title and address.
2. **Given** several saved bookmarks, **When** the user types a search term,
   **Then** the list shows only bookmarks whose title or address matches the
   term.
3. **Given** a search that matches nothing, **When** the results are empty,
   **Then** the app shows a clear "no results" message rather than a blank
   screen.
4. **Given** a listed bookmark, **When** the user activates it, **Then** the
   bookmark's web page opens in a new browser tab.

---

### User Story 3 - Organize bookmarks with tags (Priority: P3)

A person with a large collection groups related bookmarks by applying labels
(tags) and later filters the list to a single tag to see only those items.

**Why this priority**: Organization adds meaningful value at scale but is not
required for the app to be useful. It builds on Stories 1 and 2.

**Independent Test**: Apply a tag to two bookmarks, filter by that tag, and
confirm only those two are shown.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user adds one or more tags to it, **Then**
   those tags are saved and displayed with the bookmark.
2. **Given** bookmarks with different tags, **When** the user filters by a tag,
   **Then** only bookmarks carrying that tag are shown.
3. **Given** a tag filter is active, **When** the user clears it, **Then** the
   full list is shown again.

---

### User Story 4 - Edit and delete bookmarks (Priority: P3)

A person keeps their collection tidy by correcting a bookmark's details or
removing links they no longer need.

**Why this priority**: Maintenance keeps the collection accurate and trustworthy
over time, but the app delivers value before it exists.

**Independent Test**: Edit a bookmark's title, confirm the change persists, then
delete a bookmark and confirm it no longer appears.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user edits its title, address,
   or tags and saves, **Then** the updated details are shown and persist after
   reload.
2. **Given** an existing bookmark, **When** the user deletes it and confirms,
   **Then** it is removed from the list and does not reappear after reload.
3. **Given** a delete action, **When** the user is asked to confirm, **Then** no
   bookmark is removed unless the user confirms.

---

### Edge Cases

- What happens when the user tries to save a bookmark whose address is already
  saved? (Assumption: the app warns about the duplicate but allows saving.)
- How does the system handle a very long title or address? (It is stored in full
  and shown in a readable, truncated form.)
- What happens when a saved page can no longer be reached? (The bookmark remains
  saved; the app does not silently delete unreachable links.)
- How does the system handle an address without a scheme, e.g. `example.com`?
  (Assumption: the app accepts it and normalizes it to a valid web address.)
- What happens when the user searches or filters and no bookmarks match? (A
  clear empty-state message is shown.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to create a bookmark by providing a web
  address, with an optional title and optional tags.
- **FR-002**: System MUST validate that the provided address is a well-formed
  web address before saving, and reject invalid entries with a clear message.
- **FR-003**: System MUST derive a readable title automatically when the user
  does not supply one, so no bookmark is saved without a display label.
- **FR-004**: System MUST persist bookmarks so they remain available across
  app restarts and page reloads.
- **FR-005**: System MUST display all saved bookmarks in a list showing at least
  each bookmark's title and address.
- **FR-006**: Users MUST be able to open a bookmark's web page from the list.
- **FR-007**: Users MUST be able to search bookmarks by title and address and
  see only matching results.
- **FR-008**: Users MUST be able to add and remove tags on a bookmark and filter
  the list to show only bookmarks carrying a chosen tag.
- **FR-009**: Users MUST be able to edit an existing bookmark's title, address,
  and tags.
- **FR-010**: Users MUST be able to delete a bookmark, with a confirmation step
  before removal.
- **FR-011**: System MUST show a clear empty state when there are no bookmarks
  and when a search or filter returns no matches.
- **FR-012**: System MUST warn the user when the address they are saving already
  exists in their collection, while still allowing them to proceed.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved reference to a web page. Key attributes: web address,
  display title, optional description/notes, associated tags, and the date it
  was saved. Relationships: a bookmark may carry many tags.
- **Tag**: A short user-defined label used to group bookmarks. Key attributes:
  name. Relationships: a tag may apply to many bookmarks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark in under 30 seconds from opening the
  app.
- **SC-002**: A user can locate a specific bookmark within a collection of 100+
  bookmarks in under 10 seconds using search or tag filtering.
- **SC-003**: 100% of saved bookmarks remain present and unchanged after closing
  and reopening the app.
- **SC-004**: 95% of first-time users can save, find, and open a bookmark without
  external instructions.
- **SC-005**: Invalid addresses are rejected before saving in 100% of attempts,
  with no malformed bookmarks entering the collection.

## Assumptions

- **Single user, personal use (v1)**: The app manages one person's private
  bookmark collection and does not require sign-in or multi-user accounts.
  Sharing collections between users is out of scope for v1.
- **Web application**: Delivered as a browser-based app reviewed at the runtime
  addresses defined in the project conventions.
- **Organization by tags**: Grouping is done with flexible tags rather than a
  strict single-folder hierarchy; a bookmark may belong to several tags at once.
- **Automatic title lookup is best-effort**: When a title is derived from the
  page, occasional failures fall back to using the address as the title; they do
  not block saving.
- **Bookmarks are private**: The collection is not published or indexed for
  others.
- **Modern browser**: Users access the app with a current mainstream web browser
  on desktop; dedicated mobile layout is a later enhancement.
