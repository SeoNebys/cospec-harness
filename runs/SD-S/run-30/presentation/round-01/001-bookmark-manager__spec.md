# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "An app to save and manage bookmarks"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A person finds a web page they want to keep and saves it to the app by entering
its address. The app records the page so it can be found and revisited later.

**Why this priority**: Saving is the core reason the app exists. Without the
ability to capture a bookmark, no other feature has any value. This story alone
is a usable product: a personal list of saved links.

**Independent Test**: Can be fully tested by adding a link and confirming it
appears in the saved list with a recognizable title, delivering the essential
"keep this page" value on its own.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the person submits a valid web
   address, **Then** a new bookmark is saved and shown in the list with a title
   and its address.
2. **Given** the person submits an address without a readable title, **When** the
   bookmark is saved, **Then** the app still stores it and shows the address as a
   fallback label.
3. **Given** the person submits text that is not a valid web address, **When**
   they try to save, **Then** the app rejects it and explains what is wrong
   without losing what they typed.

---

### User Story 2 - Browse, search, and open bookmarks (Priority: P2)

A person returns to the app to find a page they saved earlier. They scan the
list, search by keyword, and click a bookmark to open the original page.

**Why this priority**: A saved list has little value if items cannot be found
and reopened. This turns a growing collection into something genuinely useful,
but it depends on Story 1 existing first.

**Independent Test**: With several bookmarks already saved, search for a keyword
and confirm only matching bookmarks appear, then open one and confirm it leads
to the original address.

**Acceptance Scenarios**:

1. **Given** several saved bookmarks, **When** the person opens the app, **Then**
   the bookmarks are listed with the most recently added shown first.
2. **Given** a search term, **When** the person searches, **Then** only
   bookmarks whose title, address, or notes match the term are shown.
3. **Given** a search with no matches, **When** results are shown, **Then** the
   app displays a clear "no results" message rather than an empty screen.
4. **Given** a bookmark in the list, **When** the person selects it, **Then** its
   original page opens in a new browser tab.

---

### User Story 3 - Organize and annotate bookmarks (Priority: P2)

A person with many bookmarks keeps them tidy by adding tags and a short note to
each, then filters the list to a single tag.

**Why this priority**: Organization keeps the collection usable as it grows and
is a primary differentiator from a plain browser bookmark list. It builds on
Stories 1 and 2.

**Independent Test**: Add tags to a few bookmarks, filter by one tag, and
confirm only bookmarks carrying that tag are shown.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the person adds one or more tags, **Then** the
   tags are saved and shown with the bookmark.
2. **Given** bookmarks with different tags, **When** the person filters by a tag,
   **Then** only bookmarks carrying that tag are shown.
3. **Given** a bookmark, **When** the person adds or edits a free-text note,
   **Then** the note is saved and shown with the bookmark.

---

### User Story 4 - Edit and delete bookmarks (Priority: P3)

A person cleans up their collection by correcting a title, updating tags, or
removing a bookmark they no longer need.

**Why this priority**: Maintenance prevents the collection from becoming stale
or cluttered. It is important for long-term use but not required to demonstrate
core value.

**Independent Test**: Edit a saved bookmark's title and confirm the change
persists; delete a bookmark and confirm it no longer appears.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the person edits its title, address,
   tags, or note, **Then** the changes are saved and reflected in the list.
2. **Given** a saved bookmark, **When** the person deletes it and confirms,
   **Then** the bookmark is removed from the list.
3. **Given** a delete action, **When** the person is asked to confirm, **Then**
   no bookmark is removed unless they confirm.

---

### Edge Cases

- **Duplicate address**: When the person saves an address that already exists,
  the app warns that it is already saved and does not create a silent duplicate.
- **Very long title or note**: Long text is stored and displayed without breaking
  the layout (truncated with a way to see the full text).
- **Unreachable page**: When a page's title cannot be fetched, saving still
  succeeds using the address as the label.
- **Large collection**: The list remains responsive and searchable with a large
  number of saved bookmarks.
- **Empty state**: A person with no bookmarks sees a helpful prompt to add their
  first one, not a blank screen.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a person to save a bookmark by providing a web
  address, and MUST store the address with the bookmark.
- **FR-002**: System MUST validate that a submitted address is a well-formed web
  address and reject invalid input with a clear message.
- **FR-003**: System MUST capture or derive a human-readable title for each
  bookmark, falling back to the address when no title is available.
- **FR-004**: System MUST let a person add an optional free-text note to a
  bookmark.
- **FR-005**: System MUST let a person assign zero or more tags to a bookmark.
- **FR-006**: System MUST display saved bookmarks in a list, ordered by most
  recently added first.
- **FR-007**: Users MUST be able to search bookmarks by keyword, matching against
  title, address, and note.
- **FR-008**: Users MUST be able to filter the list to show only bookmarks
  carrying a selected tag.
- **FR-009**: Users MUST be able to open a bookmark's original page in a new
  browser tab.
- **FR-010**: Users MUST be able to edit a bookmark's title, address, tags, and
  note.
- **FR-011**: Users MUST be able to delete a bookmark, with a confirmation step
  before removal.
- **FR-012**: System MUST persist all bookmarks and their details so they remain
  available across sessions and app restarts.
- **FR-013**: System MUST warn when a person saves an address that is already
  saved, and avoid creating a silent duplicate.
- **FR-014**: System MUST show a helpful empty state when no bookmarks (or no
  matching results) exist.
- **FR-015**: System MUST scope bookmark data according to the access model
  decided in [NEEDS CLARIFICATION: is this a single-user personal app (no
  login), or a multi-user app where each person signs in and sees only their own
  bookmarks?].

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved web page. Key attributes: address (URL), title, optional
  note, set of tags, date added, date last modified.
- **Tag**: A short label used to group bookmarks. A bookmark may have many tags;
  a tag may apply to many bookmarks.
- **User** *(only if multi-user, pending FR-015)*: A person who owns a private
  collection of bookmarks and signs in to access them.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person can save a new bookmark in under 20 seconds from opening
  the app.
- **SC-002**: A person can locate a specific saved bookmark among at least 500
  saved items in under 10 seconds using search or tag filtering.
- **SC-003**: Search returns matching results in under 1 second for a collection
  of at least 1,000 bookmarks.
- **SC-004**: 95% of first-time users successfully save and reopen a bookmark
  without external help.
- **SC-005**: No saved bookmark is lost across app restarts (100% persistence of
  confirmed saves).

## Assumptions

- The app is delivered as a web application accessed through a browser.
- Bookmarks are web pages identified by a URL; saving non-web resources (files,
  local paths) is out of scope for the first version.
- Organization is by free-form tags plus optional notes; nested folders and
  hierarchical collections are out of scope for the first version.
- Automatic title fetching is best-effort; if a page's title cannot be retrieved,
  the address is used as the label rather than blocking the save.
- Importing existing bookmarks from a browser or file, and sharing bookmarks with
  other people, are out of scope for the first version.
- Standard, user-friendly error handling and reasonable data-retention practices
  apply; bookmarks persist until the owner deletes them.
