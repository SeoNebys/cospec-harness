# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "An app to save and manage bookmarks"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A person finds a web page they want to return to later. They open the app,
paste or enter the page's address, optionally give it a title, and save it. The
bookmark now appears in their list of saved bookmarks.

**Why this priority**: Saving links is the core reason the app exists. Without
it there is nothing to manage. This single story is a usable product on its own.

**Independent Test**: Enter a valid URL, save it, and confirm it appears in the
list with its address and title. Reload the app and confirm it is still there.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user enters a valid URL and saves, **Then** the bookmark appears in the list and persists after reload.
2. **Given** the save form, **When** the user submits without a title, **Then** the bookmark is saved using the URL (or page address) as its display title.
3. **Given** the save form, **When** the user enters text that is not a valid web address, **Then** the app rejects it with a clear message and does not save.

---

### User Story 2 - Browse, search, and find bookmarks (Priority: P2)

As the collection grows, the user needs to find a specific bookmark quickly.
They can view all bookmarks in a list, search by keyword, and see the most
recently added ones first.

**Why this priority**: A saved link has no value if it cannot be found again.
This is what turns a pile of links into a usable collection, but it depends on
saving (P1) existing first.

**Independent Test**: With several bookmarks saved, type a keyword into search
and confirm only matching bookmarks are shown; clear the search and confirm all
return.

**Acceptance Scenarios**:

1. **Given** multiple saved bookmarks, **When** the user opens the app, **Then** all bookmarks are listed with newest first.
2. **Given** multiple saved bookmarks, **When** the user searches for a term present in a title or address, **Then** only matching bookmarks are shown.
3. **Given** a search with no matches, **When** results are displayed, **Then** the app shows a clear "no results" message.

---

### User Story 3 - Edit and delete bookmarks (Priority: P2)

The user needs to correct a title, fix an address, or remove a bookmark that is
no longer relevant.

**Why this priority**: Managing (not just saving) is explicitly requested.
Editing and deleting keep the collection accurate and uncluttered.

**Independent Test**: Select an existing bookmark, change its title, save, and
confirm the new title shows in the list. Delete a bookmark and confirm it is
removed and stays removed after reload.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user edits its title or address and saves, **Then** the updated values are shown and persisted.
2. **Given** an existing bookmark, **When** the user deletes it and confirms, **Then** it is removed from the list and does not reappear after reload.
3. **Given** a delete action, **When** the user is asked to confirm, **Then** cancelling leaves the bookmark unchanged.

---

### User Story 4 - Organize with tags (Priority: P3)

The user assigns one or more tags (e.g. "work", "recipes") to bookmarks and
filters the list to a single tag to see a focused subset.

**Why this priority**: Organization is valuable for larger collections but the
app is fully usable without it. It builds on the earlier stories.

**Independent Test**: Add a tag to two bookmarks, filter by that tag, and
confirm only those two appear.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user adds one or more tags, **Then** the tags are shown on the bookmark and saved.
2. **Given** bookmarks with different tags, **When** the user filters by a tag, **Then** only bookmarks carrying that tag are listed.
3. **Given** a tag filter is active, **When** the user clears it, **Then** the full list returns.

---

### Edge Cases

- **Duplicate URL**: When the user saves an address that already exists, the app warns that the bookmark already exists rather than silently creating a duplicate.
- **Very long title or address**: Long values are stored in full and displayed truncated so the layout does not break.
- **Missing scheme**: An address entered without `http://`/`https://` (e.g. `example.com`) is accepted and normalized to a valid web address.
- **Empty state**: With no bookmarks yet, the app shows a friendly prompt guiding the user to add their first bookmark.
- **Whitespace-only input**: Titles or addresses consisting only of spaces are treated as empty and validated accordingly.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to save a bookmark by providing a web address, with an optional title and optional tags.
- **FR-002**: System MUST validate that the provided address is a well-formed web address and reject invalid input with a clear message.
- **FR-003**: System MUST normalize an address entered without a scheme to a valid `http`/`https` form before saving.
- **FR-004**: When no title is provided, System MUST derive a display title from the address.
- **FR-005**: System MUST persist bookmarks so they remain available after the app is reloaded or restarted.
- **FR-006**: System MUST display all saved bookmarks in a list ordered by most recently added first.
- **FR-007**: Users MUST be able to search bookmarks by keyword, matching against title and address.
- **FR-008**: System MUST show a clear empty/"no results" state when the list or a search returns nothing.
- **FR-009**: Users MUST be able to edit an existing bookmark's title, address, and tags, with changes persisted.
- **FR-010**: Users MUST be able to delete a bookmark, with a confirmation step before removal.
- **FR-011**: Users MUST be able to assign zero or more tags to a bookmark and filter the list by a single tag.
- **FR-012**: System MUST warn the user when saving an address that duplicates an existing bookmark.
- **FR-013**: Each bookmark MUST record the date/time it was added.
- **FR-014**: Users MUST be able to open a bookmark's address in a new browser tab from the list.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved link. Attributes: web address, display title, optional description/note, date added, date last modified, and associated tags.
- **Tag**: A short label used to group bookmarks. A bookmark may have many tags; a tag may apply to many bookmarks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save their first bookmark within 30 seconds of opening the app, with no prior setup.
- **SC-002**: Searching a collection of 500 bookmarks returns matching results in under 1 second.
- **SC-003**: 95% of users can find and open a previously saved bookmark on their first attempt.
- **SC-004**: Saved bookmarks are retained across app reloads with zero data loss under normal use.
- **SC-005**: A user can edit or delete a bookmark and see the result reflected immediately (within 1 second).

## Assumptions

- **Single-user, local scope for v1**: The app serves one user and does not require accounts, login, or multi-user sharing. Authentication is out of scope for v1.
- **Web application**: Delivered as a browser-based app reached over HTTP, consistent with the project's runtime presentation environment.
- **Persistence**: Bookmarks are stored durably by the application so they survive reloads; the specific storage mechanism is an implementation choice deferred to planning.
- **No automatic metadata fetching in v1**: The app does not fetch page titles, favicons, or previews from the remote site; titles are user-provided or derived from the address. This may be a future enhancement.
- **Manual entry**: Bookmarks are added manually within the app; browser-extension capture and bulk import/export are out of scope for v1.
- **Modern browser**: Users access the app with a current mainstream web browser.
