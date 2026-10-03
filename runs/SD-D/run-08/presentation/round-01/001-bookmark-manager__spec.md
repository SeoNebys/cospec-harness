# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "An app to save and manage bookmarks"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A person finds a web page they want to keep and saves it to the app by
providing its address. The app records the page so it can be found again later.

**Why this priority**: Saving is the core reason the app exists. Without it,
there is nothing to manage. This story alone delivers a usable product: a place
to stash links you don't want to lose.

**Independent Test**: Can be fully tested by adding a bookmark with a valid web
address and confirming it appears in the saved list, delivering the value of
"I won't lose this link."

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user submits a valid web
   address, **Then** a new bookmark is saved and shown in the list.
2. **Given** the user submits an address without an accompanying title, **When**
   the bookmark is saved, **Then** the app derives a readable title from the
   address so the entry is not blank.
3. **Given** the user submits something that is not a valid web address, **When**
   they try to save it, **Then** the app rejects it with a clear message and
   saves nothing.

---

### User Story 2 - Browse and find saved bookmarks (Priority: P1)

A person returns to the app to retrieve a link they saved earlier. They see
their bookmarks and can search or filter to locate the one they want, then open
it in their browser.

**Why this priority**: A saved bookmark has no value if it cannot be retrieved.
Viewing, searching, and opening are what turn storage into a manager. Paired with
Story 1 this is the minimum viable product.

**Independent Test**: Can be tested by seeding several bookmarks, searching by a
keyword, and confirming only matching entries are shown and each can be opened.

**Acceptance Scenarios**:

1. **Given** several saved bookmarks, **When** the user opens the app, **Then**
   all bookmarks are listed with their title and address.
2. **Given** several saved bookmarks, **When** the user types a search term,
   **Then** only bookmarks whose title, address, or tags match are shown.
3. **Given** a bookmark in the list, **When** the user activates it, **Then** the
   original web page opens in a new browser tab.
4. **Given** no bookmarks match a search term, **When** the results are shown,
   **Then** the app displays a clear "no results" message rather than a blank
   screen.

---

### User Story 3 - Organize bookmarks with tags (Priority: P2)

A person with many bookmarks groups them by attaching one or more tags (e.g.
"work", "recipes") and later filters the list by a tag to see a focused subset.

**Why this priority**: Organization becomes valuable once a collection grows.
It is important but not required for a first usable release.

**Independent Test**: Can be tested by tagging bookmarks, selecting a tag, and
confirming only bookmarks carrying that tag are displayed.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user adds one or more tags to it, **Then**
   the tags are saved and shown on the bookmark.
2. **Given** bookmarks with various tags, **When** the user selects a tag,
   **Then** only bookmarks carrying that tag are shown.
3. **Given** a tag filter is active, **When** the user clears it, **Then** the
   full list is shown again.

---

### User Story 4 - Edit and delete bookmarks (Priority: P2)

A person corrects a bookmark's title, address, or tags when details change, or
removes a bookmark they no longer need.

**Why this priority**: Keeping a collection accurate and uncluttered is part of
"managing," but the app is still useful for a while without it.

**Independent Test**: Can be tested by editing a saved bookmark's title and
confirming the change persists, and by deleting a bookmark and confirming it no
longer appears.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user edits its title, address, or
   tags and saves, **Then** the updated values are stored and displayed.
2. **Given** a saved bookmark, **When** the user deletes it and confirms, **Then**
   the bookmark is removed from the list.
3. **Given** a delete action, **When** the user is asked to confirm, **Then** no
   deletion occurs unless the user confirms.

---

### Edge Cases

- **Duplicate address**: When the user saves an address that already exists, the
  app warns that the bookmark already exists and does not create a silent
  duplicate (the user may choose to save anyway).
- **Very long titles or addresses**: Long values are stored in full and
  displayed truncated so the layout is not broken.
- **Missing or malformed address**: An empty or clearly invalid address is
  rejected with guidance rather than saved.
- **Large collections**: The list remains usable and searchable with several
  thousand bookmarks.
- **Special characters**: Titles, tags, and addresses containing special
  characters are stored and displayed safely without breaking the interface.
- **Unreachable page**: The app stores the address even if the page is currently
  offline; verifying live reachability is not required to save.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to save a bookmark by providing a web address,
  with an optional title and optional tags.
- **FR-002**: System MUST validate that the provided address is a well-formed web
  address before saving and reject invalid input with a clear message.
- **FR-003**: System MUST derive a readable title from the address when the user
  does not supply one, so no bookmark is displayed without a label.
- **FR-004**: System MUST persist saved bookmarks so they remain available across
  app restarts and browser sessions.
- **FR-005**: Users MUST be able to view a list of all saved bookmarks showing at
  least the title, address, and any tags.
- **FR-006**: Users MUST be able to search bookmarks by keyword, matching against
  title, address, and tags.
- **FR-007**: Users MUST be able to open a bookmark's original web page in a new
  browser tab.
- **FR-008**: Users MUST be able to attach and remove tags on a bookmark.
- **FR-009**: Users MUST be able to filter the list to bookmarks carrying a
  selected tag, and to clear the filter.
- **FR-010**: Users MUST be able to edit an existing bookmark's title, address,
  and tags.
- **FR-011**: Users MUST be able to delete a bookmark, with a confirmation step
  before removal.
- **FR-012**: System MUST warn the user when saving an address that already
  exists in the collection.
- **FR-013**: System MUST display a clear empty state when no bookmarks exist and
  a clear "no results" state when a search or filter matches nothing.
- **FR-014**: System MUST record when each bookmark was created and preserve a
  consistent default ordering (most recently added first).
- **FR-015**: System MUST safely store and display values containing special
  characters without breaking the interface.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved reference to a web page. Key attributes: web address,
  title, optional description/note, set of tags, creation timestamp, last-updated
  timestamp. A bookmark carries zero or more tags.
- **Tag**: A short label used to group bookmarks (e.g. "work"). A tag applies to
  many bookmarks; a bookmark may have many tags.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark in under 20 seconds from opening the
  app.
- **SC-002**: A user can locate a specific previously-saved bookmark among at
  least 500 entries in under 10 seconds using search or tag filtering.
- **SC-003**: Search and filter results appear within 1 second of the user's
  input for collections of up to 5,000 bookmarks.
- **SC-004**: Saved bookmarks are still present after the app is closed and
  reopened in 100% of cases.
- **SC-005**: 95% of first-time users can save, find, and open a bookmark without
  external instructions.
- **SC-006**: Invalid addresses are rejected before saving in 100% of attempts,
  with a message the user can act on.

## Assumptions

- **Single user, no accounts (v1)**: The app serves one user's personal
  collection and does not require sign-in, multi-user separation, or sharing in
  the first version. Accounts and sync can be added later.
- **Web application**: Delivered as a browser-based application reachable at the
  review URLs defined by the project's runtime conventions.
- **Local/server-side persistence**: Bookmarks are stored so they survive
  restarts; a specific storage technology is not mandated by this spec.
- **No automatic metadata fetching (v1)**: The app does not automatically fetch a
  page's real title, favicon, or preview; titles are user-provided or derived
  from the address. This may be added later.
- **No browser import/export (v1)**: Importing from or exporting to browser
  bookmark files is out of scope for the first version.
- **Modern browser**: Users access the app with a current mainstream web browser.
