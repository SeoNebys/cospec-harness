# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-24

**Status**: Draft

**Input**: User description: "An app to save and manage bookmarks"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A person finds a web page they want to return to later. They open the app,
paste or enter the page's address, optionally give it a friendly title, and save
it. The bookmark now appears in their list so they can find it again.

**Why this priority**: Saving a link is the core reason the app exists. Without
it there is nothing to manage. This single story is a usable product on its own.

**Independent Test**: Enter a valid web address, save it, and confirm the new
bookmark appears in the list with its address and title after a page reload.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user submits a valid web
   address with a title, **Then** the bookmark is stored and shown at the top of
   the list.
2. **Given** the user submits a web address without typing a title, **When** the
   bookmark is saved, **Then** it is stored with a sensible default title (e.g.
   the address itself) and still appears in the list.
3. **Given** the user submits an entry that is not a valid web address, **When**
   they try to save, **Then** the app rejects it with a clear message and does
   not create a bookmark.

---

### User Story 2 - Browse and open saved bookmarks (Priority: P1)

A person returns to the app to reach something they saved earlier. They see
their bookmarks in a list, read the titles, and click one to open the target
page in a new browser tab.

**Why this priority**: A saved bookmark has no value unless it can be found and
opened again. Together with Story 1 this forms the minimum viable product.

**Independent Test**: With at least one saved bookmark, load the app and confirm
the list renders; click a bookmark and confirm the target page opens in a new
tab.

**Acceptance Scenarios**:

1. **Given** several saved bookmarks, **When** the user opens the app, **Then**
   all bookmarks are listed with their titles and addresses.
2. **Given** a bookmark in the list, **When** the user activates it, **Then**
   the target address opens in a new browser tab.
3. **Given** no bookmarks have been saved yet, **When** the user opens the app,
   **Then** a friendly empty state explains how to add the first bookmark.

---

### User Story 3 - Edit and delete bookmarks (Priority: P2)

A person wants to correct a mistyped title, update an address, or remove a
bookmark they no longer need. They pick a bookmark, change its details or delete
it, and the list reflects the change.

**Why this priority**: Managing (not just saving) is part of the request.
Important, but the app is already useful without it.

**Independent Test**: Edit an existing bookmark's title, save, and confirm the
new title persists; delete a bookmark and confirm it disappears from the list
after reload.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user edits its title or address
   and saves, **Then** the updated values are stored and shown.
2. **Given** an existing bookmark, **When** the user deletes it and confirms,
   **Then** it is removed from the list and does not reappear after reload.
3. **Given** the user starts a delete, **When** they cancel the confirmation,
   **Then** the bookmark remains unchanged.

---

### User Story 4 - Organize and find bookmarks (Priority: P3)

As the collection grows, a person wants to find a specific bookmark quickly.
They can add one or more tags to a bookmark when saving or editing, filter the
list by a tag, and type in a search box to narrow the list by title or address.

**Why this priority**: Adds real value at scale but is not needed for a small
collection. Deferrable without breaking the core experience.

**Independent Test**: Tag two bookmarks differently, filter by one tag and
confirm only matching bookmarks show; type part of a title in search and confirm
the list narrows to matches.

**Acceptance Scenarios**:

1. **Given** bookmarks with different tags, **When** the user selects a tag
   filter, **Then** only bookmarks carrying that tag are shown.
2. **Given** a search term, **When** the user types it, **Then** the list shows
   only bookmarks whose title or address contains the term.
3. **Given** an active filter or search, **When** the user clears it, **Then**
   the full list is shown again.

---

### Edge Cases

- **Duplicate address**: When the user saves an address that already exists, the
  app warns that it is already saved but still allows the user to proceed.
- **Very long title or address**: Long values are stored fully and displayed
  truncated with a way to see the full value.
- **Address without a scheme** (e.g. `example.com`): The app accepts it and
  normalizes it to a usable link (assumes `https://`).
- **Empty search / filter result**: A clear "no matching bookmarks" message is
  shown, with a way to clear the filter.
- **Deleting the last bookmark**: The empty state reappears.
- **Special characters in title or tags**: Stored and displayed safely without
  breaking the layout.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to create a bookmark by providing a web
  address and an optional title.
- **FR-002**: System MUST validate the web address and reject entries that are
  not usable web addresses with a clear, human-readable message.
- **FR-003**: System MUST assign a sensible default title (such as the address)
  when the user does not provide one.
- **FR-004**: System MUST persist bookmarks so they remain available after the
  app is closed and reopened.
- **FR-005**: System MUST display all saved bookmarks in a list showing at least
  the title and address, with the most recently added shown first.
- **FR-006**: Users MUST be able to open a bookmark's target address in a new
  browser tab.
- **FR-007**: Users MUST be able to edit an existing bookmark's title, address,
  and tags.
- **FR-008**: Users MUST be able to delete a bookmark, with a confirmation step
  to prevent accidental loss.
- **FR-009**: System MUST allow users to add zero or more tags to a bookmark.
- **FR-010**: Users MUST be able to filter the list to show only bookmarks that
  carry a selected tag.
- **FR-011**: Users MUST be able to search bookmarks by text contained in the
  title or address.
- **FR-012**: System MUST show a friendly empty state when no bookmarks exist
  and a clear "no results" state when a search or filter matches nothing.
- **FR-013**: System MUST warn when a user saves an address that already exists
  but MUST NOT block them from saving it.
- **FR-014**: System MUST display and store bookmark content safely, without
  allowing entered text to break or alter the app's behavior.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved reference to a web page. Key attributes: web address,
  title, optional tags, creation time, last-updated time.
- **Tag**: A short label used to group bookmarks. A bookmark may have many tags;
  a tag may apply to many bookmarks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save their first bookmark in under 30 seconds from
  opening the app.
- **SC-002**: A saved bookmark remains present and openable after the app is
  closed and reopened.
- **SC-003**: In a collection of at least 100 bookmarks, a user can locate a
  specific one via search or tag filter in under 10 seconds.
- **SC-004**: The bookmark list becomes usable (visible and interactive) within
  2 seconds of opening the app for a collection of up to 500 bookmarks.
- **SC-005**: 95% of first-time users can save, find, and open a bookmark
  without external instructions.

## Assumptions

- **Single user, no accounts (v1)**: The app serves one user's personal
  collection; multi-user accounts, sign-in, and sharing are out of scope for v1.
- **Web application**: Delivered as a browser-based app reviewed at
  `http://maker:4000`; native mobile apps are out of scope for v1.
- **Local/server persistence**: Bookmarks are stored durably by the app; syncing
  across multiple devices is out of scope for v1.
- **No automatic metadata fetching**: The app does not fetch page titles,
  favicons, or previews from the target site in v1; titles are user-provided or
  defaulted to the address.
- **No import/export**: Importing from browser bookmarks or exporting to a file
  is out of scope for v1.
- **Modern browser**: Users access the app with a current mainstream browser
  with JavaScript enabled.
