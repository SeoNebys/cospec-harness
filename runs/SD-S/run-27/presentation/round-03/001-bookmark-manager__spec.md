# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "An app to save and manage bookmarks"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A person finds a web page they want to return to later. They add it to the app
by providing its address, optionally giving it a title and a short note, and the
bookmark is saved to their collection.

**Why this priority**: Saving links is the core reason the app exists. Without
it, nothing else has value. This story alone is a usable MVP: a place to capture
links you don't want to lose.

**Independent Test**: Add a bookmark with an address and confirm it appears in
the saved collection and persists after closing and reopening the app.

**Acceptance Scenarios**:

1. **Given** an empty collection, **When** the user saves a bookmark with a valid
   address, **Then** the bookmark appears in the collection with its address and
   title.
2. **Given** the user enters an address without a title, **When** they save it,
   **Then** the bookmark is saved and shown with a sensible fallback label (e.g.
   the address itself).
3. **Given** the user submits an entry with no address, **When** they try to save,
   **Then** the app refuses and explains that an address is required.

---

### User Story 2 - Browse and find bookmarks (Priority: P1)

A person with a growing collection wants to locate a saved bookmark quickly by
searching text or filtering by tag/category.

**Why this priority**: A collection is only useful if you can retrieve items from
it. As soon as there is more than a handful of bookmarks, browsing and search
become essential.

**Independent Test**: With several bookmarks saved, search by keyword and filter
by tag, and confirm only matching bookmarks are shown.

**Acceptance Scenarios**:

1. **Given** multiple saved bookmarks, **When** the user types a keyword, **Then**
   the list narrows to bookmarks whose title, address, note, or tag matches.
2. **Given** bookmarks with tags, **When** the user selects a tag, **Then** only
   bookmarks carrying that tag are shown.
3. **Given** a search with no matches, **When** results are empty, **Then** the app
   shows a clear "no results" state rather than a blank screen.

---

### User Story 3 - Organize, edit, and remove bookmarks (Priority: P2)

A person maintains their collection over time: correcting a title, adding or
changing tags, and deleting bookmarks they no longer need.

**Why this priority**: Keeps the collection accurate and clutter-free, but the app
is already useful for capture and retrieval without it.

**Independent Test**: Edit a saved bookmark's title and tags, confirm the changes
persist; delete a bookmark and confirm it is removed from the collection.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user edits its title, note, or tags,
   **Then** the updated values are saved and shown.
2. **Given** a saved bookmark, **When** the user deletes it, **Then** it is removed
   from the collection and no longer appears in searches.
3. **Given** a delete action, **When** the user triggers it, **Then** the app
   confirms the intent before permanently removing the bookmark.

---

### User Story 4 - Open a saved bookmark (Priority: P2)

A person clicks a saved bookmark to open the original page in their browser.

**Why this priority**: The payoff of saving a link is returning to it, but this is
a thin layer over stored data and depends on P1 stories existing first.

**Independent Test**: Click a saved bookmark and confirm the original address opens
in a new browser tab.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user activates it, **Then** the original
   page opens in a new tab/window.

---

### Edge Cases

- What happens when the user saves the same address twice? (App warns of a possible
  duplicate but does not block saving.)
- How does the app handle a malformed address (missing scheme, spaces, not a URL)?
  (App validates and asks the user to correct it.)
- How does the app behave with a very large collection (thousands of bookmarks)?
- What is shown on first launch when the collection is empty? (A welcoming empty
  state that invites the user to add their first bookmark.)
- What happens when a tag has no remaining bookmarks after deletions? (It no longer
  appears as a filter option.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST allow a user to save a bookmark consisting of a web
  address, and optionally a title, a free-text note, and one or more tags.
- **FR-002**: The app MUST validate that a bookmark has a syntactically valid web
  address before saving, and reject entries without one.
- **FR-003**: The app MUST display a fallback label (the address) when no title is
  provided.
- **FR-004**: The app MUST persist bookmarks so they remain available across app
  restarts.
- **FR-005**: The app MUST display the user's bookmarks as a browsable list showing
  at least title, address, and tags.
- **FR-006**: Users MUST be able to search bookmarks by keyword, matching against
  title, address, note, and tags.
- **FR-007**: Users MUST be able to filter bookmarks by tag.
- **FR-008**: Users MUST be able to edit an existing bookmark's title, note, and
  tags.
- **FR-009**: Users MUST be able to delete a bookmark, with a confirmation step
  before permanent removal.
- **FR-010**: Users MUST be able to open a saved bookmark's original page in a new
  browser tab/window.
- **FR-011**: The app MUST warn the user when saving an address that already exists
  in the collection, without preventing the save.
- **FR-012**: The app MUST present clear empty states for both an empty collection
  and an empty search result.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved link. Attributes: web address (required), title, note,
  tags (zero or more), date added, date last modified.
- **Tag**: A short label used to categorize bookmarks. A bookmark may have several
  tags; a tag may apply to many bookmarks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark in under 20 seconds from opening the
  add action.
- **SC-002**: A user can locate a specific bookmark in a collection of 100+ items
  in under 10 seconds using search or tag filtering.
- **SC-003**: Saved bookmarks are retained with 100% fidelity across app restarts
  (no data loss).
- **SC-004**: 95% of first-time users successfully save and retrieve a bookmark
  without external help.
- **SC-005**: Search and filter results update within 1 second for collections of
  up to 1,000 bookmarks.

## Assumptions

- The app is used by a single user managing their own personal collection; multi-user
  accounts, sharing, and permissions are out of scope for v1.
- No user authentication is required for v1 (single local user).
- The app is a web application viewed in a modern desktop browser; dedicated mobile
  apps are out of scope for v1, though the layout should remain usable on smaller
  screens.
- Bookmarks are entered manually; browser-extension import and bulk import are out
  of scope for v1.
- Automatic fetching of page titles/metadata from the address is a nice-to-have and
  is out of scope for v1 (titles are entered by the user).
- Tags are free-text labels created by the user as they type them.
