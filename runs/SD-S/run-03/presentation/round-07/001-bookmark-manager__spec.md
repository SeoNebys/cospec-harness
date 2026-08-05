# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "An app to save and manage bookmarks"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A person comes across a web page they want to return to later. They save it into
the app by providing its address, and the app keeps a titled, clickable record
of it so it can be found and re-opened at any time.

**Why this priority**: Saving links is the core reason the app exists. Without
it there is nothing to manage. This single story, on its own, is a usable
product: a place to stash links you don't want to lose.

**Independent Test**: Enter a web address, save it, then confirm the saved item
appears in the list with a recognisable title and can be opened in a browser.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user submits a valid web address, **Then** a new bookmark is created and shown in the list with its title and address.
2. **Given** a web address whose page has a discoverable title, **When** the user saves it without typing a title, **Then** the app fills in the page's title automatically.
3. **Given** a saved bookmark, **When** the user selects it, **Then** the underlying web page opens.
4. **Given** an entry that is not a valid web address, **When** the user tries to save it, **Then** the app rejects it with a clear message and saves nothing.

---

### User Story 2 - Browse, search, and find bookmarks (Priority: P2)

As the collection grows, the user needs to locate a specific bookmark quickly by
searching for words in its title, address, or notes, and by scanning the list.

**Why this priority**: A save-only tool becomes useless once it holds more than a
handful of links. Retrieval is what turns a pile of links into a manageable
collection, but it depends on Story 1 existing first.

**Independent Test**: With several bookmarks saved, type a search term and
confirm only matching bookmarks remain visible; clear the term and confirm all
return.

**Acceptance Scenarios**:

1. **Given** multiple saved bookmarks, **When** the user types a search term, **Then** only bookmarks matching the term (in title, address, notes, or tags) are shown.
2. **Given** a search that matches nothing, **When** results are displayed, **Then** the app shows an empty-result message rather than an error.
3. **Given** an active search, **When** the user clears the search term, **Then** the full list is restored.

---

### User Story 3 - Organise with tags and notes (Priority: P3)

The user groups related bookmarks by attaching one or more tags, and adds a short
note to remind themselves why a bookmark matters. They can then filter the list
to a single tag.

**Why this priority**: Organisation adds meaningful value for larger collections
but is not required for the app to be useful. It builds on saving and browsing.

**Independent Test**: Add tags and a note to a bookmark, then filter by one of
those tags and confirm the bookmark appears while unrelated ones do not.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user adds one or more tags, **Then** those tags are stored with the bookmark and shown alongside it.
2. **Given** bookmarks with different tags, **When** the user filters by a tag, **Then** only bookmarks carrying that tag are shown.
3. **Given** a bookmark, **When** the user adds or edits its note, **Then** the note is saved and displayed with the bookmark.

---

### User Story 4 - Edit and delete bookmarks (Priority: P3)

The user corrects a mistyped address or title, updates tags/notes, or removes a
bookmark that is no longer wanted.

**Why this priority**: Keeping a collection tidy over time is important for
long-term use, but the app delivers value before editing and deletion exist.

**Independent Test**: Change a saved bookmark's title, confirm the change
persists; delete a bookmark and confirm it no longer appears.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user edits its title, address, tags, or note and saves, **Then** the updated values are stored and displayed.
2. **Given** a saved bookmark, **When** the user deletes it and confirms, **Then** it is removed from the list and no longer appears.
3. **Given** a delete action, **When** the user is asked to confirm, **Then** no deletion occurs unless the user confirms.

---

### Edge Cases

- **Duplicate address**: When the user saves an address that already exists, the app warns that it is already saved and does not create a silent duplicate.
- **Unreachable page**: When a page's title cannot be fetched, the bookmark is still saved using the address (or a user-typed title) as its label.
- **Very long title, note, or address**: The app stores and displays these without breaking the layout, truncating for display where needed.
- **Deleting a tag in use**: Removing a tag from a bookmark affects only that bookmark; other bookmarks keep the tag.
- **Empty state**: On first use, with no bookmarks saved, the app shows a helpful prompt to add the first bookmark rather than a blank screen.
- **Special characters / non-Latin text** in titles, notes, and tags are preserved.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let the user save a bookmark by providing a web address.
- **FR-002**: System MUST validate that a submitted address is a well-formed web address and reject invalid input with a clear message.
- **FR-003**: System MUST attempt to determine a page's title automatically when the user does not supply one, and fall back to the address as the label if no title is available.
- **FR-004**: System MUST allow the user to provide or override a bookmark's title.
- **FR-005**: System MUST persist saved bookmarks so they remain available across sessions (after closing and reopening the app).
- **FR-006**: System MUST display saved bookmarks in a list showing at least each bookmark's title and address.
- **FR-007**: Users MUST be able to open a bookmark's underlying web page.
- **FR-008**: Users MUST be able to search bookmarks by text, matching against title, address, notes, and tags.
- **FR-009**: Users MUST be able to attach zero or more tags to a bookmark and filter the list by a tag.
- **FR-010**: Users MUST be able to attach a free-text note to a bookmark.
- **FR-011**: Users MUST be able to edit a bookmark's title, address, tags, and note.
- **FR-012**: Users MUST be able to delete a bookmark, with a confirmation step before removal.
- **FR-013**: System MUST warn the user when saving an address that already exists rather than silently creating a duplicate.
- **FR-014**: System MUST record the date/time each bookmark was saved and allow the list to be ordered by it (e.g. newest first).
- **FR-015**: System MUST present a helpful empty state when no bookmarks exist.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved reference to a web page. Attributes: web address, title, optional note, date/time saved, and its associated tags.
- **Tag**: A short user-defined label used to group bookmarks. A bookmark may have many tags; a tag may apply to many bookmarks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark in under 15 seconds from opening the "add" action to seeing it in the list.
- **SC-002**: A user can locate a specific bookmark in a collection of 500+ items within 10 seconds using search or tag filtering.
- **SC-003**: Search results update to reflect the entered term within 1 second for a collection of 1,000 bookmarks.
- **SC-004**: 100% of saved bookmarks remain present and openable after the app is closed and reopened.
- **SC-005**: 95% of first-time users successfully save and re-open a bookmark on their first attempt without external help.

## Assumptions

- **Single user, personal use**: The app serves one person's private collection. Multi-user accounts, sharing, and collaboration are out of scope for v1.
- **No cross-device sync in v1**: Bookmarks are stored for use by this app instance. Syncing across multiple devices is out of scope for the first version.
- **Web-page bookmarks only**: Bookmarks point to web addresses (http/https). Bookmarking files, apps, or other resource types is out of scope for v1.
- **Automatic title fetching is best-effort**: When a page's title cannot be retrieved (offline, blocked, or no title), saving still succeeds using the address or a user-typed title.
- **Importing from / exporting to browsers** (e.g. bulk import of existing browser bookmarks) is out of scope for v1 but is a likely future addition.
- **Standard app expectations** apply for error handling (clear, user-friendly messages) and responsiveness.
