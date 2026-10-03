# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: "Build an app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A person finds a web page worth keeping and saves its address to the app so they
can return to it later. They provide the link and optionally a title; the app
stores it and shows it in their list of saved bookmarks.

**Why this priority**: Saving links is the core reason the app exists. Without
it, nothing else is meaningful. This alone is a usable MVP.

**Independent Test**: Add a bookmark by entering a web address, then confirm it
appears in the saved list and reopens the correct page when selected.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user submits a valid web
   address, **Then** the bookmark is saved and appears at the top of the list.
2. **Given** a bookmark form, **When** the user submits without a title, **Then**
   the app stores the bookmark using the address (or fetched page title) as its
   display name.
3. **Given** a bookmark form, **When** the user submits an invalid or empty
   address, **Then** the app rejects it with a clear message and saves nothing.

---

### User Story 2 - Browse, search, and reopen bookmarks (Priority: P1)

The user opens the app to find a previously saved link. They scan the list,
search by keyword, and click a bookmark to open the original page.

**Why this priority**: A saved bookmark has no value unless it can be found and
reopened. This completes the minimum useful loop with Story 1.

**Independent Test**: With several bookmarks saved, search for a keyword and
confirm only matching bookmarks show, then open one and reach the correct page.

**Acceptance Scenarios**:

1. **Given** multiple saved bookmarks, **When** the user opens the app, **Then**
   all bookmarks are listed with their title and address.
2. **Given** a search term, **When** the user searches, **Then** only bookmarks
   whose title or address matches are shown.
3. **Given** a bookmark in the list, **When** the user selects it, **Then** the
   original web page opens in a new browser tab.

---

### User Story 3 - Edit and delete bookmarks (Priority: P2)

The user tidies their collection by correcting a title, fixing a link, or
removing bookmarks they no longer need.

**Why this priority**: Keeps the collection accurate and uncluttered over time,
but the app is already useful without it.

**Independent Test**: Edit a saved bookmark's title and confirm the change
persists; delete a bookmark and confirm it no longer appears.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user edits its title or address and
   saves, **Then** the updated values are shown and persisted.
2. **Given** a saved bookmark, **When** the user deletes it and confirms, **Then**
   it is removed from the list permanently.

---

### User Story 4 - Organize with tags (Priority: P3)

The user assigns one or more labels (tags) to bookmarks and filters the list by
a tag to view a related group.

**Why this priority**: Improves organization for larger collections; a
nice-to-have beyond the core save/find/manage loop.

**Independent Test**: Tag two bookmarks with the same label, filter by that
label, and confirm only those two appear.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user adds a tag, **Then** the tag is shown
   on the bookmark and becomes available as a filter.
2. **Given** bookmarks with tags, **When** the user filters by a tag, **Then**
   only bookmarks carrying that tag are shown.

---

### Edge Cases

- What happens when the user saves a web address that is already bookmarked?
  (Default: the app warns of the duplicate and does not create a second copy.)
- What happens when a saved page no longer exists or the address is unreachable?
  (The bookmark remains saved; reachability is not guaranteed by the app.)
- How does the app handle a very long title or address? (Display is truncated;
  the full value is preserved.)
- What happens when the user searches with no matches? (An empty-result message
  is shown, not an error.)
- What happens when the list is empty on first use? (A friendly empty state
  invites the user to add their first bookmark.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST let a user save a bookmark consisting of a web address
  and an optional title.
- **FR-002**: The app MUST validate that the submitted address is a well-formed
  web address before saving, and reject invalid input with a clear message.
- **FR-003**: When no title is provided, the app MUST derive a display name from
  the page title or the address itself.
- **FR-004**: The app MUST persist saved bookmarks so they remain available
  across app restarts and separate visits.
- **FR-005**: The app MUST display all saved bookmarks in a list showing at least
  the title and address, most recently added first.
- **FR-006**: Users MUST be able to open a bookmarked page from the list.
- **FR-007**: Users MUST be able to search bookmarks by keyword matching the
  title or address.
- **FR-008**: Users MUST be able to edit the title and address of an existing
  bookmark.
- **FR-009**: Users MUST be able to delete a bookmark, with a confirmation step
  before permanent removal.
- **FR-010**: The app MUST warn the user when saving an address that already
  exists in their collection and avoid creating a duplicate.
- **FR-011**: Users MUST be able to assign zero or more tags to a bookmark and
  filter the list by a selected tag.
- **FR-012**: The app MUST show a clear empty state when no bookmarks exist and a
  clear no-results state when a search or filter matches nothing.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved web reference. Key attributes: web address, display
  title, optional description/note, creation timestamp, associated tags.
- **Tag**: A short user-defined label used to group and filter bookmarks. Key
  attributes: name; related to many bookmarks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark in under 15 seconds from opening the
  app.
- **SC-002**: A user can locate a specific saved bookmark among at least 100
  saved items in under 10 seconds using search or filtering.
- **SC-003**: 95% of first-time users successfully save and reopen a bookmark
  without external help.
- **SC-004**: Saved bookmarks are retained with 100% fidelity across app
  restarts (no lost or altered entries).
- **SC-005**: Search results reflect the current collection and appear to the
  user instantly (no perceptible wait) for collections up to 1,000 bookmarks.

## Assumptions

- This is a single-user application for v1; multi-user accounts, sharing, and
  authentication are out of scope.
- Bookmarks are stored locally to the app's own persistence; no external
  bookmark-sync services or browser-extension import are in scope for v1.
- The app is accessed through a web browser on a desktop-sized screen; dedicated
  mobile layouts are a later enhancement.
- Fetching a page's title automatically is a best-effort convenience; if it
  cannot be retrieved, the address is used as the display name.
- "Web address" means standard http/https links; other schemes are out of scope.
