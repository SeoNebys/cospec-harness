# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: "An app to save and manage bookmarks"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark with auto-collected details (Priority: P1)

A person finds a web page they want to return to later and saves it by providing
its address. The app automatically collects the page's title, description, and
icon so the saved entry is recognizable without manual effort.

**Why this priority**: Saving links is the core reason the app exists. Automatic
detail collection makes each saved entry immediately useful and is central to the
value the user asked for.

**Independent Test**: Enter a web address, save it, reload the app, and confirm
the saved bookmark still appears with an auto-collected title, description, and
icon.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user submits a valid web
   address, **Then** a new bookmark appears showing the automatically collected
   title, description, and icon.
2. **Given** the page's details cannot be automatically collected, **When** the
   bookmark is saved, **Then** the app derives a readable display title from the
   address and saves the bookmark without a description or icon.
3. **Given** the user submits an empty or clearly invalid address, **When** they
   try to save, **Then** the app rejects it and explains what is wrong without
   losing what they typed.

---

### User Story 2 - Browse and open saved bookmarks (Priority: P1)

A person opens the app to review what they have saved and clicks a bookmark to
open the original page in their browser.

**Why this priority**: Saved links are only useful if they can be found and
opened again. Browsing and opening is the essential counterpart to saving.

**Independent Test**: With several bookmarks saved, view the full list and click
one; confirm the correct original page opens in a new browser tab.

**Acceptance Scenarios**:

1. **Given** one or more saved bookmarks, **When** the user opens the app,
   **Then** all bookmarks are listed with title, address, description, icon, and
   tags, most recently added first.
2. **Given** a bookmark in the list, **When** the user activates it, **Then** the
   original page opens in a new browser tab and the bookmark remains saved.
3. **Given** no bookmarks have been saved yet, **When** the user opens the app,
   **Then** a clear empty state invites them to add their first bookmark.

---

### User Story 3 - Organize bookmarks with tags (Priority: P1)

A person keeps a growing collection manageable by attaching one or more tags to
each bookmark, reusing tags they have already created, and filtering the list to
a single tag.

**Why this priority**: The user identified a flat list as unmanageable and asked
for tags in the first version. Tagging and tag filtering are core to keeping the
collection usable as it grows.

**Independent Test**: Add multiple tags to a bookmark (including reusing an
existing tag), reload the app to confirm the tags persist, then filter by one tag
and confirm only bookmarks with that tag are shown.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user adds one or more tags, **Then** the
   tags are shown on the bookmark and persist after reload.
2. **Given** tags already exist, **When** the user tags another bookmark, **Then**
   they can reuse an existing tag rather than recreating it, and the same tag is
   not duplicated.
3. **Given** bookmarks with various tags, **When** the user filters by a tag,
   **Then** only bookmarks carrying that tag are shown, and clearing the filter
   restores the full list.

---

### User Story 4 - Find bookmarks by search (Priority: P1)

A person locates a specific entry by typing part of its title, description,
address, or tag; matching ignores capitalization.

**Why this priority**: The user asked for search to be part of the core release.
Combined with tags, it is essential for retrieving entries in a growing
collection.

**Independent Test**: With many bookmarks saved, type a term in any case and
confirm only matching bookmarks remain visible; clear the term and confirm all
reappear.

**Acceptance Scenarios**:

1. **Given** many saved bookmarks, **When** the user types a search term, **Then**
   only bookmarks whose title, description, address, or tags contain the term are
   shown.
2. **Given** a search term, **When** its capitalization differs from the saved
   text (e.g. "NEWS" vs "news"), **Then** matching still succeeds.
3. **Given** an active search with no matches, **When** results are empty, **Then**
   the app clearly indicates nothing matched; clearing the term restores the full
   list.

---

### User Story 5 - Edit and delete bookmarks (Priority: P1)

A person keeps their collection accurate by editing a bookmark's address, title,
and description, or removing entries they no longer need.

**Why this priority**: The user asked for editing and deleting in the core
release. Correcting details and pruning stale entries is essential to keeping the
collection trustworthy.

**Independent Test**: Edit a bookmark's address, title, and description, confirm
the changes persist after reload; delete a bookmark and confirm it no longer
appears.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user edits its address, title, or
   description and saves, **Then** the updated values are shown and persist after
   reload.
2. **Given** the user edits the address to one that is empty or malformed, **When**
   they try to save, **Then** the app rejects it with a clear message and keeps
   the previous value.
3. **Given** a saved bookmark, **When** the user deletes it and confirms, **Then**
   it is removed from the list and does not reappear after reload; cancelling the
   confirmation leaves the bookmark unchanged.

---

### User Story 6 - Saving an existing address opens it for update (Priority: P2)

When a person saves an address that is already bookmarked, the app takes them to
the existing bookmark so they can update it, rather than only showing an error.

**Why this priority**: This refines the save flow into a smoother experience but
depends on the core save and edit stories existing first.

**Independent Test**: Save an address, then attempt to save the same address
again; confirm the app opens the existing bookmark ready for editing instead of
creating a duplicate or only reporting an error.

**Acceptance Scenarios**:

1. **Given** an address is already bookmarked, **When** the user saves that same
   address again, **Then** the app opens the existing bookmark for editing rather
   than creating a second entry.
2. **Given** the user is taken to the existing bookmark, **When** they change its
   details and save, **Then** the single existing entry is updated.
3. **Given** address comparison, **When** two addresses differ only by
   capitalization or a trailing slash, **Then** the app treats them as the same
   address for duplicate detection.

---

### Edge Cases

- What happens when automatic detail collection is slow or fails? The bookmark is
  still saved promptly using an address-derived title; missing details do not
  block saving.
- How does the app handle an address whose title cannot be determined? It falls
  back to showing the address itself as the title.
- What happens with a very long title, description, or address? The list keeps
  entries readable (e.g. truncation) without breaking the layout, while the full
  value remains available.
- What happens when the user removes all tags from a bookmark? The bookmark
  remains saved with no tags and still appears in the unfiltered list.
- What happens to a tag that is no longer attached to any bookmark? It is no
  longer offered as a filter or reuse option.
- How does the app behave when a saved page no longer exists? The bookmark still
  opens in the browser; the app does not guarantee the destination is live.
- What happens when the user reloads or reopens the app? All previously saved
  bookmarks, their details, and their tags are still present.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST let a user save a bookmark by providing a web address.
- **FR-002**: The app MUST validate that a submitted address is a well-formed web
  address and reject empty or malformed input with a clear message.
- **FR-003**: On saving, the app MUST attempt to automatically collect the page's
  title, description, and icon, and store them with the bookmark.
- **FR-004**: When details cannot be collected, the app MUST still save the
  bookmark, deriving a readable display title from the address and leaving
  description and icon empty.
- **FR-005**: The app MUST persist saved bookmarks, their details, and their tags
  so they remain available after the app is reloaded or reopened.
- **FR-006**: The app MUST display all saved bookmarks in a list showing each
  bookmark's title, address, description, icon, and tags, ordered most recently
  added first.
- **FR-007**: The app MUST let a user open a bookmark's original page in a new
  browser tab without removing the saved bookmark.
- **FR-008**: The app MUST show a clear empty state when no bookmarks are saved.
- **FR-009**: The app MUST let a user attach one or more tags to a bookmark and
  reuse existing tags without creating duplicates.
- **FR-010**: The app MUST let a user filter the list to show only bookmarks
  carrying a selected tag, and clear that filter to restore the full list.
- **FR-011**: The app MUST let a user search bookmarks by a term matching the
  title, description, address, or tags, with matching that ignores capitalization.
- **FR-012**: The app MUST let a user edit a saved bookmark's address, title, and
  description, validating an edited address the same way as a new one, and persist
  the changes.
- **FR-013**: The app MUST let a user delete a saved bookmark, requiring a
  confirmation before removal.
- **FR-014**: The app MUST detect when a submitted address is already bookmarked
  and, instead of only showing an error, open the existing bookmark for the user
  to update.
- **FR-015**: When detecting duplicate addresses, the app MUST treat addresses
  that differ only by capitalization or a trailing slash as the same address.
- **FR-016**: The app MUST keep list entries readable regardless of title,
  description, or address length.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved reference to a web page. Attributes: the web address, a
  display title, a description, an icon, the set of tags applied to it, and the
  time it was added (used for ordering). Each bookmark is an independent entry in
  the user's collection.
- **Tag**: A short, reusable label a user applies to bookmarks to group and filter
  them. A tag can be applied to many bookmarks, and a bookmark can carry many
  tags. The same tag name is not stored twice.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark in under 15 seconds from opening the
  app, without waiting for automatic detail collection to finish.
- **SC-002**: 100% of saved bookmarks, including their details and tags, are still
  present after the app is reloaded or reopened.
- **SC-003**: A user can locate a specific bookmark among 100 saved entries in
  under 10 seconds using search or a tag filter.
- **SC-004**: The bookmark list displays without visible delay for collections of
  at least 500 bookmarks.
- **SC-005**: 95% of first-time users successfully save and reopen a bookmark
  without external guidance.
- **SC-006**: When a user saves an address that already exists, the app takes them
  to the existing entry 100% of the time instead of creating a duplicate.

## Assumptions

- The app is a single-user, single-device experience for the first version;
  accounts, sign-in, and cross-device sync are out of scope.
- Bookmarks are stored locally for the user; no sharing or collaboration is
  included in v1.
- Only web addresses (http/https pages) are in scope; other resource types are
  out of scope for v1.
- Automatic collection of title, description, and icon is best-effort: it depends
  on the destination page being reachable and providing that information, and an
  address-derived title is an acceptable fallback when it is not.
- Tags are free-form short labels created by the user as they type; a separate tag
  management screen is out of scope for v1 beyond reuse and filtering.
- The app runs in a modern web browser.
