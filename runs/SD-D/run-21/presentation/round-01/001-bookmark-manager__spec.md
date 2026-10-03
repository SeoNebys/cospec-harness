# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-25

**Status**: Draft

**Input**: User description: "I want to build an app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A person finds a web page worth keeping and saves it to the app by entering
its address. The app records the page so it can be found again later.

**Why this priority**: Saving a link is the core reason the product exists.
Without it, nothing else has value. This alone is a usable MVP.

**Independent Test**: Enter a URL, save it, and confirm the new bookmark
appears in the list with a recognizable title.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user enters a valid URL and
   saves it, **Then** a new bookmark appears in the list showing the page title
   and address.
2. **Given** the save form, **When** the user submits without a URL, **Then**
   the app rejects the entry and explains that an address is required.
3. **Given** the save form, **When** the user enters text that is not a valid
   web address, **Then** the app rejects the entry and explains the address is
   invalid.

---

### User Story 2 - Browse and find saved bookmarks (Priority: P1)

A person returns to the app to retrieve something they saved earlier. They
see all their bookmarks and can search or filter to locate a specific one.

**Why this priority**: Saved links are worthless if they cannot be found
again. Browsing and search make the collection usable at any size.

**Independent Test**: With several bookmarks saved, view the full list, type a
search term, and confirm only matching bookmarks remain visible.

**Acceptance Scenarios**:

1. **Given** several saved bookmarks, **When** the user opens the app, **Then**
   all bookmarks are listed, most recently saved first.
2. **Given** several saved bookmarks, **When** the user types a search term,
   **Then** only bookmarks whose title, address, or tags match the term are
   shown.
3. **Given** a search that matches nothing, **When** the results are empty,
   **Then** the app shows a clear "no matches" message rather than a blank
   screen.
4. **Given** a bookmark in the list, **When** the user selects it, **Then** the
   app opens the original page in a new browser tab.

---

### User Story 3 - Organize bookmarks with tags (Priority: P2)

A person with a growing collection labels bookmarks with tags (for example
"work", "recipes", "read later") and later filters the list by a tag to see
only related bookmarks.

**Why this priority**: Organization keeps the collection useful as it grows,
but the app is still valuable without it, so it ranks below core save/find.

**Independent Test**: Add one or more tags to a bookmark, then filter by a tag
and confirm only bookmarks carrying that tag appear.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user adds one or more tags, **Then** the
   tags are saved and shown with the bookmark.
2. **Given** bookmarks with different tags, **When** the user selects a tag
   filter, **Then** only bookmarks carrying that tag are shown.
3. **Given** an active tag filter, **When** the user clears it, **Then** the
   full list of bookmarks returns.

---

### User Story 4 - Edit and delete bookmarks (Priority: P2)

A person corrects a bookmark's title or tags, or removes a bookmark they no
longer need.

**Why this priority**: Maintenance keeps the collection accurate and
uncluttered. Important, but secondary to creating and finding bookmarks.

**Independent Test**: Change a saved bookmark's title, confirm the update
persists, then delete a bookmark and confirm it disappears from the list.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user edits its title or tags and
   saves, **Then** the updated values are shown and persist after reload.
2. **Given** a saved bookmark, **When** the user deletes it and confirms,
   **Then** the bookmark is removed from the list and does not return after
   reload.
3. **Given** a delete action, **When** it is triggered, **Then** the app asks
   for confirmation before removing the bookmark.

---

### Edge Cases

- **Duplicate URL**: When the user saves an address that already exists, the
  app warns that the bookmark already exists rather than silently creating a
  duplicate.
- **Missing title**: When a page's title cannot be determined, the app falls
  back to showing the address as the title.
- **Very long title or address**: The list truncates long text for display
  while preserving the full value.
- **Large collection**: The list remains responsive and readable with many
  hundreds of bookmarks.
- **Unreachable page**: Saving does not fail solely because the target page is
  temporarily unreachable; the address is still recorded.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to save a bookmark by providing a web
  address (URL).
- **FR-002**: System MUST validate that a submitted address is a well-formed
  web address and reject empty or malformed entries with a clear message.
- **FR-003**: System MUST store, for each bookmark, its address, a title, an
  optional description/note, a set of tags, and the date it was saved.
- **FR-004**: System MUST derive a title for a saved page automatically when
  possible, and fall back to the address when no title is available.
- **FR-005**: Users MUST be able to view all saved bookmarks, ordered with the
  most recently saved first.
- **FR-006**: Users MUST be able to search bookmarks by text matching the
  title, address, or tags, and see only matching results.
- **FR-007**: Users MUST be able to open a bookmarked page in a new browser
  tab from the list.
- **FR-008**: Users MUST be able to add, change, and remove tags on a bookmark.
- **FR-009**: Users MUST be able to filter the list to show only bookmarks
  carrying a selected tag, and to clear that filter.
- **FR-010**: Users MUST be able to edit a bookmark's title, description, and
  tags, with changes persisted.
- **FR-011**: Users MUST be able to delete a bookmark, with a confirmation step
  before removal.
- **FR-012**: System MUST persist all bookmarks so they remain available across
  sessions and app restarts.
- **FR-013**: System MUST warn the user when saving an address that duplicates
  an existing bookmark.
- **FR-014**: System MUST show a clear empty state when there are no bookmarks
  and a clear "no matches" state when a search or filter returns nothing.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved reference to a web page. Attributes: web address,
  title, optional description/note, associated tags, date saved. Each bookmark
  is uniquely identified.
- **Tag**: A short text label used to categorize bookmarks. A bookmark may
  carry many tags; a tag may apply to many bookmarks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save their first bookmark in under 30 seconds from
  opening the app.
- **SC-002**: A user can locate a specific bookmark among at least 200 saved
  bookmarks in under 10 seconds using search or tag filtering.
- **SC-003**: Search and filter results update within 1 second of the user's
  input.
- **SC-004**: 100% of saved bookmarks remain available after the app is closed
  and reopened.
- **SC-005**: 90% of first-time users successfully save and re-find a bookmark
  without external help.

## Assumptions

- **Single user, local scope for v1**: The app serves one user's personal
  collection. Multi-user accounts, authentication, and sharing are out of scope
  for the first version.
- **Web application**: Delivered as a web app accessed through a browser,
  consistent with the project's runtime presentation environment.
- **Persistence**: Bookmarks are stored durably by the application so they
  survive restarts; the specific storage mechanism is an implementation detail
  decided at the planning stage.
- **Automatic title retrieval is best-effort**: If a page's title cannot be
  fetched (e.g., the page is unreachable), the app still saves the bookmark
  using the address as the title; the user can edit it afterward.
- **Manual entry**: Bookmarks are added by entering a URL. Importing from
  browser bookmark files or a browser extension is out of scope for v1.
- **Modern browser**: Users access the app on a current desktop or mobile web
  browser with JavaScript enabled.
