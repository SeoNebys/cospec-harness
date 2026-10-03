# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "An app to save and manage bookmarks"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A person finds a web page worth keeping and saves it to the app by providing its
web address. The app records the address so it can be returned to later, and
shows a friendly label for it (the page title or the address itself).

**Why this priority**: Saving a link is the core reason the app exists. Without
it there is nothing to manage. This single story is a viable MVP: a person can
capture links and see them in a list.

**Independent Test**: Enter a valid web address and save it; confirm it then
appears in the list of saved bookmarks and persists after reloading the app.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the person saves a valid web
   address, **Then** the bookmark appears in the list with a title and address.
2. **Given** the person is saving a bookmark, **When** they leave the title
   blank, **Then** the app uses the web address (or fetched page title) as the
   display label.
3. **Given** a saved bookmark exists, **When** the app is reloaded, **Then** the
   bookmark is still present.

---

### User Story 2 - Browse and open saved bookmarks (Priority: P1)

A person opens the app to see everything they have saved and clicks a bookmark
to open the original page in their browser.

**Why this priority**: Saved links have no value if they cannot be found and
revisited. Viewing and opening completes the minimal capture-and-retrieve loop.

**Independent Test**: With several bookmarks saved, view the list and click one;
confirm the correct original web page opens in a new browser tab.

**Acceptance Scenarios**:

1. **Given** several saved bookmarks, **When** the person opens the app, **Then**
   all bookmarks are listed with their titles and addresses.
2. **Given** a bookmark in the list, **When** the person clicks it, **Then** the
   original page opens in a new browser tab.
3. **Given** no bookmarks have been saved, **When** the person opens the app,
   **Then** an empty state invites them to add their first bookmark.

---

### User Story 3 - Edit and delete bookmarks (Priority: P2)

A person corrects a bookmark's title or address, or removes a bookmark they no
longer need.

**Why this priority**: Keeping a collection tidy is essential to "managing"
bookmarks, but the app is already useful for capture and retrieval without it.

**Independent Test**: Edit a bookmark's title and confirm the change is saved and
displayed; delete a bookmark and confirm it disappears from the list and does not
return after reload.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the person edits its title or address and
   saves, **Then** the updated values are shown and persisted.
2. **Given** a saved bookmark, **When** the person deletes it, **Then** it is
   removed from the list and does not reappear after reload.
3. **Given** the person requests deletion, **When** the delete action is
   presented, **Then** the app confirms intent before permanently removing it.

---

### User Story 4 - Organize with tags and search (Priority: P3)

A person adds one or more tags to a bookmark and later filters or searches their
collection to find a specific link quickly.

**Why this priority**: Organization becomes valuable as a collection grows, but a
small collection is manageable by scrolling. This is an enhancement over the MVP.

**Independent Test**: Add a tag to two bookmarks, then filter by that tag and
confirm only those two appear; type a keyword into search and confirm matching
bookmarks are shown.

**Acceptance Scenarios**:

1. **Given** bookmarks with assigned tags, **When** the person selects a tag
   filter, **Then** only bookmarks carrying that tag are shown.
2. **Given** a collection of bookmarks, **When** the person types a keyword,
   **Then** bookmarks whose title, address, or tags match the keyword are shown.
3. **Given** a search or filter with no matches, **When** it is applied, **Then**
   the app shows a clear "no results" state.

---

### Edge Cases

- **Invalid address**: When the person enters text that is not a usable web
  address, the app rejects it with a clear message rather than saving it.
- **Duplicate address**: When the person saves an address already bookmarked,
  the app warns that it already exists and does not create a silent duplicate.
- **Very long titles or addresses**: The app displays long values without
  breaking the layout (e.g. truncation with full value available).
- **Unreachable page when fetching title**: If the page title cannot be
  retrieved, the app falls back to using the address as the label and still
  saves the bookmark.
- **Empty collection**: The list shows a helpful empty state, not a blank screen.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST let a person save a bookmark by entering a web
  address, with an optional custom title.
- **FR-002**: The app MUST validate that a submitted web address is well-formed
  and reject malformed entries with a clear message.
- **FR-003**: When no custom title is provided, the app MUST derive a display
  label from the page title if available, otherwise from the web address.
- **FR-004**: The app MUST persist saved bookmarks so they remain available
  across app reloads and restarts.
- **FR-005**: The app MUST display all saved bookmarks in a list showing each
  bookmark's title and web address.
- **FR-006**: The app MUST allow a person to open a bookmark's original page in a
  new browser tab.
- **FR-007**: The app MUST allow a person to edit a saved bookmark's title and
  web address.
- **FR-008**: The app MUST allow a person to delete a saved bookmark, confirming
  intent before permanent removal.
- **FR-009**: The app MUST warn when a person attempts to save a web address that
  is already bookmarked, and MUST NOT create silent duplicates.
- **FR-010**: The app MUST let a person assign zero or more tags to a bookmark.
- **FR-011**: The app MUST let a person filter the collection by tag.
- **FR-012**: The app MUST let a person search bookmarks by keyword against
  title, web address, and tags.
- **FR-013**: The app MUST present a clear empty state when no bookmarks exist and
  a clear "no results" state when a filter or search matches nothing.
- **FR-014**: The app MUST show the date each bookmark was saved and order the
  list by most recently saved by default.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved web link. Key attributes: web address, display title,
  optional set of tags, date saved, date last modified.
- **Tag**: A short label used to group bookmarks. Key attributes: name; related
  to many bookmarks (a bookmark may carry many tags).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person can save a new bookmark in under 20 seconds from opening
  the add form to seeing it in the list.
- **SC-002**: 100% of saved bookmarks remain present and correct after the app is
  reloaded or restarted.
- **SC-003**: A person can locate a specific bookmark in a collection of 100 in
  under 10 seconds using search or tag filtering.
- **SC-004**: Malformed web addresses are rejected before saving in 100% of
  attempts, with no invalid entries reaching the saved list.
- **SC-005**: 90% of first-time users can save, find, and open a bookmark without
  external instructions.

## Assumptions

- **Single user, no accounts**: v1 serves a single local user; multi-user
  accounts, authentication, and sharing are out of scope.
- **Web addresses only**: Bookmarks reference HTTP/HTTPS web pages; other schemes
  (files, FTP, custom protocols) are out of scope for v1.
- **Local persistence is acceptable**: Bookmarks are stored so they survive
  reloads; cross-device sync and cloud backup are out of scope for v1.
- **Page-title fetching is best-effort**: Automatic title retrieval is a
  convenience; failure to fetch never blocks saving.
- **Browser-based experience**: The app is used in a web browser on a desktop
  screen; dedicated mobile layouts are a later enhancement.
- **Import/export of existing browser bookmarks** is out of scope for v1.
