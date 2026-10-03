# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-24

**Status**: Draft

**Input**: User description: "Build an app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A person finds a web page they want to keep and saves it by entering (or pasting)
its address. The app stores the page so it can be found again later. The app
captures a readable title for the page so the saved item is recognizable at a
glance rather than being just a raw address.

**Why this priority**: Saving is the core purpose of the app. Without it there is
nothing to manage. This single story, on its own, delivers a usable product: a
place to stash links so they are not lost.

**Independent Test**: Enter a valid web address, save it, and confirm the new
bookmark appears in the list with a recognizable title and its address.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user submits a valid web
   address, **Then** a new bookmark is added and shown in the list with its title
   and address.
2. **Given** the user is adding a bookmark, **When** they submit without an
   address, **Then** the app rejects the entry and explains that an address is
   required.
3. **Given** the user submits text that is not a valid web address, **When** they
   try to save, **Then** the app rejects the entry and explains the address is
   invalid.

---

### User Story 2 - Browse and find saved bookmarks (Priority: P1)

A person returns to the app to retrieve something they saved earlier. They see
all their bookmarks in a list and can search or filter to quickly locate a
specific one, then open it in their browser.

**Why this priority**: Saved bookmarks have no value if they cannot be found
again. Viewing and locating bookmarks is essential to the "manage" half of the
request and is required for the app to be worth using beyond the first save.

**Independent Test**: With several bookmarks already saved, view the full list,
type a search term, and confirm only matching bookmarks remain visible and can be
opened.

**Acceptance Scenarios**:

1. **Given** several saved bookmarks, **When** the user opens the app, **Then**
   all bookmarks are listed with their titles and addresses.
2. **Given** several saved bookmarks, **When** the user enters a search term,
   **Then** only bookmarks whose title, address, or tags match the term are
   shown.
3. **Given** a bookmark in the list, **When** the user chooses to open it,
   **Then** the target page opens in a new browser tab.
4. **Given** a search term that matches nothing, **When** results are shown,
   **Then** the app displays a clear "no matching bookmarks" message.

---

### User Story 3 - Organize bookmarks with tags (Priority: P2)

A person with a growing collection wants to keep it tidy. They add one or more
tags (such as "work" or "recipes") to a bookmark and later filter the list to
show only bookmarks with a chosen tag.

**Why this priority**: Organization becomes valuable as the collection grows. It
strongly enhances the "manage" experience but the app is still usable without it,
so it ranks below saving and finding.

**Independent Test**: Add tags to a bookmark, then select a tag and confirm the
list narrows to only bookmarks carrying that tag.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user adds one or more tags to it, **Then**
   the tags are saved and displayed with the bookmark.
2. **Given** bookmarks with different tags, **When** the user selects a tag
   filter, **Then** only bookmarks carrying that tag are shown.
3. **Given** a bookmark with tags, **When** the user removes a tag, **Then** the
   tag no longer appears on that bookmark or in the tag filter (if unused
   elsewhere).

---

### User Story 4 - Edit and delete bookmarks (Priority: P2)

A person keeps their collection accurate by correcting a bookmark's title,
address, or tags, and by removing bookmarks they no longer need.

**Why this priority**: Maintenance prevents the collection from becoming stale or
cluttered. It rounds out "manage" but is not needed to prove the core value, so
it sits alongside organizing.

**Independent Test**: Change an existing bookmark's title and save it, confirm the
update persists; delete a bookmark and confirm it disappears from the list.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user edits its title, address, or
   tags and saves, **Then** the updated values are shown and persist across
   reloads.
2. **Given** an existing bookmark, **When** the user deletes it, **Then** it is
   removed from the list and no longer appears after reload.
3. **Given** the user requests deletion, **When** the action would permanently
   remove the bookmark, **Then** the app asks for confirmation before deleting.

---

### Edge Cases

- **Duplicate address**: When the user saves an address that already exists, the
  app warns that the bookmark already exists rather than silently creating a
  duplicate.
- **Missing or slow title retrieval**: When a page title cannot be fetched
  automatically, the app falls back to using the address as the title and lets
  the user edit it.
- **Very long titles or addresses**: The list display truncates gracefully
  without breaking layout, and the full value remains accessible.
- **Large collection**: The list remains usable and responsive with a large
  number of bookmarks (see Success Criteria).
- **Unreachable target page**: Opening a bookmark whose page no longer exists is
  the browser's responsibility; the bookmark itself remains saved.
- **Empty state**: A first-time user with no bookmarks sees a friendly prompt
  explaining how to add their first bookmark.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to save a bookmark by providing a web
  address.
- **FR-002**: System MUST validate that the provided address is a well-formed web
  address and reject entries that are empty or malformed, with a clear message.
- **FR-003**: System MUST capture a title for each bookmark, attempting to derive
  it from the target page and falling back to the address when no title is
  available.
- **FR-004**: System MUST allow the user to provide or override the title and add
  an optional note/description when saving or editing.
- **FR-005**: System MUST persist bookmarks so they remain available across app
  restarts and page reloads.
- **FR-006**: System MUST display all saved bookmarks in a list showing at least
  the title, address, and tags.
- **FR-007**: Users MUST be able to search bookmarks by text matching against
  title, address, and tags, and see only matching results.
- **FR-008**: Users MUST be able to open a bookmark's target page in a new
  browser tab.
- **FR-009**: Users MUST be able to add and remove tags on a bookmark.
- **FR-010**: Users MUST be able to filter the list to show only bookmarks
  carrying a selected tag.
- **FR-011**: Users MUST be able to edit an existing bookmark's title, address,
  note, and tags.
- **FR-012**: Users MUST be able to delete a bookmark, with a confirmation step
  before permanent removal.
- **FR-013**: System MUST warn the user when saving an address that duplicates an
  existing bookmark instead of silently creating a duplicate.
- **FR-014**: System MUST record when each bookmark was created and allow the list
  to be ordered by most recently added.
- **FR-015**: System MUST present a clear empty state when no bookmarks exist and
  a clear "no results" state when a search or filter matches nothing.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved reference to a web page. Key attributes: web address
  (required), title, optional note/description, set of tags, creation timestamp,
  last-updated timestamp.
- **Tag**: A short user-defined label used to categorize bookmarks. A bookmark
  may carry many tags, and a tag may apply to many bookmarks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save their first bookmark in under 30 seconds from
  opening the app, without instructions.
- **SC-002**: A user can locate a specific bookmark among at least 500 saved
  bookmarks in under 10 seconds using search or tag filtering.
- **SC-003**: Search and filter results update within 1 second of the user
  finishing their input, for collections of at least 500 bookmarks.
- **SC-004**: Saved bookmarks are still present after closing and reopening the
  app, with zero data loss across restarts in normal use.
- **SC-005**: 95% of new users successfully complete the save-then-find flow on
  their first attempt without external help.

## Assumptions

- **Single user, no accounts (v1)**: The app serves one user and does not require
  login or multi-user accounts in the first version. This is the pending
  clarification below; the spec currently assumes single-user.
- **Web application**: The app is delivered as a browser-based web application
  reviewed via the project's runtime presentation environment.
- **Web page bookmarks only**: Bookmarks reference standard web addresses
  (http/https); saving files, notes without links, or non-web resources is out of
  scope for v1.
- **Automatic import/browser sync out of scope**: Importing existing browser
  bookmarks or syncing with a browser is out of scope for v1.
- **Sharing out of scope**: Sharing bookmarks or collections with other people is
  out of scope for v1.
- **Standard expectations**: User-friendly error messages, reasonable performance
  for a personal-scale collection, and standard web accessibility apply.
