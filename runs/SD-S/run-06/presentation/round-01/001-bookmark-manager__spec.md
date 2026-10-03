# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: "An app to save and manage bookmarks"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A person finds a web page they want to return to later and saves it to the app
by providing its address, so it is stored and available whenever they come back.

**Why this priority**: Saving links is the core reason the app exists. Without
it, nothing else has value. This single capability already delivers a usable
product: a place to stash links.

**Independent Test**: Enter a web address, save it, reload the app, and confirm
the saved bookmark still appears in the list.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user submits a valid web
   address, **Then** a new bookmark appears in the list with its address and a
   readable title.
2. **Given** the user submits an address without a title, **When** the bookmark
   is saved, **Then** the app derives a display title from the address so the
   entry is still recognizable.
3. **Given** the user submits an empty or clearly invalid address, **When** they
   try to save, **Then** the app rejects it and explains what is wrong without
   losing what they typed.

---

### User Story 2 - Browse and open saved bookmarks (Priority: P1)

A person opens the app to review what they have saved and clicks a bookmark to
open the original page in their browser.

**Why this priority**: Saved links are only useful if they can be found and
opened again. Browsing and opening is the essential counterpart to saving and,
together with P1 saving, forms the minimum viable product.

**Independent Test**: With several bookmarks saved, view the full list and click
one; confirm the correct original page opens in a new browser tab.

**Acceptance Scenarios**:

1. **Given** one or more saved bookmarks, **When** the user opens the app,
   **Then** all bookmarks are listed with title and address, most recently added
   first.
2. **Given** a bookmark in the list, **When** the user activates it, **Then** the
   original page opens in a new browser tab and the bookmark remains saved.
3. **Given** no bookmarks have been saved yet, **When** the user opens the app,
   **Then** a clear empty state invites them to add their first bookmark.

---

### User Story 3 - Edit and delete bookmarks (Priority: P2)

A person keeps their collection tidy by renaming a bookmark's title or removing
entries they no longer need.

**Why this priority**: Management keeps the collection useful over time, but the
app is already valuable for saving and retrieving before this exists, so it
ranks below the core P1 stories.

**Independent Test**: Rename a bookmark and confirm the new title persists after
reload; delete a bookmark and confirm it no longer appears.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user edits its title and saves,
   **Then** the updated title is shown and persists after reload.
2. **Given** a saved bookmark, **When** the user deletes it and confirms, **Then**
   it is removed from the list and does not reappear after reload.
3. **Given** the user starts a delete, **When** they cancel the confirmation,
   **Then** the bookmark remains unchanged.

---

### User Story 4 - Find bookmarks quickly (Priority: P3)

A person with many saved bookmarks narrows the list by typing part of a title or
address to locate a specific entry.

**Why this priority**: Search becomes valuable as the collection grows, but a
small collection is manageable by scrolling, so this is a later enhancement.

**Independent Test**: With many bookmarks saved, type a term and confirm only
matching bookmarks remain visible; clear the term and confirm all reappear.

**Acceptance Scenarios**:

1. **Given** many saved bookmarks, **When** the user types a search term,
   **Then** only bookmarks whose title or address contains the term are shown.
2. **Given** an active search with no matches, **When** results are empty,
   **Then** the app clearly indicates nothing matched.
3. **Given** an active search, **When** the user clears the term, **Then** the
   full list is shown again.

---

### Edge Cases

- What happens when the user saves the same address twice? The app keeps the
  collection clean by flagging or preventing exact duplicate addresses.
- How does the app handle an address whose title cannot be determined? It falls
  back to showing the address itself as the title.
- What happens with a very long title or address? The list keeps entries
  readable (e.g. truncation) without breaking the layout, while the full value
  remains available.
- How does the app behave when a saved page no longer exists? The bookmark still
  opens in the browser; the app does not guarantee the destination is live.
- What happens when the user reloads or reopens the app? All previously saved
  bookmarks are still present.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST let a user save a bookmark by providing a web address,
  optionally with a title.
- **FR-002**: The app MUST validate that a submitted address is a well-formed web
  address and reject empty or malformed input with a clear message.
- **FR-003**: When no title is provided, the app MUST derive a readable display
  title from the address.
- **FR-004**: The app MUST persist saved bookmarks so they remain available after
  the app is reloaded or reopened.
- **FR-005**: The app MUST display all saved bookmarks in a list showing each
  bookmark's title and address, ordered most recently added first.
- **FR-006**: The app MUST let a user open a bookmark's original page in a new
  browser tab without removing the saved bookmark.
- **FR-007**: The app MUST show a clear empty state when no bookmarks are saved.
- **FR-008**: The app MUST let a user edit a saved bookmark's title, and persist
  the change.
- **FR-009**: The app MUST let a user delete a saved bookmark, requiring a
  confirmation before removal.
- **FR-010**: The app MUST let a user filter the list by a search term matching
  the title or address.
- **FR-011**: The app MUST detect exact-duplicate addresses and prevent or flag
  saving the same address twice.
- **FR-012**: The app MUST keep list entries readable regardless of title or
  address length.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved reference to a web page. Attributes: the web address,
  a display title, and the time it was added (used for ordering). Each bookmark
  is an independent entry in the user's collection.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark in under 15 seconds from opening the
  app.
- **SC-002**: 100% of saved bookmarks are still present after the app is reloaded
  or reopened.
- **SC-003**: A user can locate a specific bookmark among 100 saved entries in
  under 10 seconds using search.
- **SC-004**: The bookmark list displays without visible delay for collections of
  at least 500 bookmarks.
- **SC-005**: 95% of first-time users successfully save and reopen a bookmark
  without external guidance.

## Assumptions

- The app is a single-user, single-device experience for the first version;
  accounts, sign-in, and cross-device sync are out of scope.
- Bookmarks are stored locally for the user; no sharing or collaboration is
  included in v1.
- Only web addresses (http/https pages) are in scope; other resource types are
  out of scope for v1.
- Organization features such as folders and tags are out of scope for v1; the
  flat list plus search is sufficient for the initial release.
- Automatically fetching a live title or preview from the destination page is a
  best-effort convenience, not a guaranteed capability; a derived title from the
  address is an acceptable fallback.
- The app runs in a modern web browser.
