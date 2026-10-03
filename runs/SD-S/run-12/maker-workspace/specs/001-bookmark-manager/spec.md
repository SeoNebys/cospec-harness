# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "I want to build an app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A person finds a web page they want to keep and saves it to the app by entering
its address. The app records the page so they can return to it later. This is the
core reason the app exists.

**Why this priority**: Without the ability to save a bookmark, the app delivers no
value. Every other capability builds on a saved bookmark existing.

**Independent Test**: Can be fully tested by adding a URL and confirming the new
bookmark appears in the saved list and survives reloading the app.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user enters a valid web address
   and saves it, **Then** a new bookmark for that address appears in the list.
2. **Given** the user is saving a bookmark, **When** they also provide a title,
   **Then** the bookmark is shown with that title.
3. **Given** the user saves a bookmark without a title, **When** the bookmark is
   created, **Then** it is shown using its web address (or page-derived title) as
   the display label.
4. **Given** the user enters something that is not a valid web address, **When**
   they try to save, **Then** the app rejects it with a clear message and does not
   create a bookmark.

---

### User Story 2 - Browse and open saved bookmarks (Priority: P1)

The person returns to the app to see everything they have saved and clicks a
bookmark to open the original page in their browser.

**Why this priority**: Saving has no value unless the user can view and reach
their bookmarks again. Together with Story 1 this forms the minimum viable product.

**Independent Test**: Can be tested by viewing a list of previously saved
bookmarks and confirming that activating one opens the correct web address.

**Acceptance Scenarios**:

1. **Given** one or more saved bookmarks, **When** the user opens the app, **Then**
   all saved bookmarks are listed with their title and web address.
2. **Given** a listed bookmark, **When** the user activates it, **Then** the
   corresponding web page opens in a new browser tab.
3. **Given** no bookmarks have been saved, **When** the user opens the app, **Then**
   a friendly empty state explains how to add the first bookmark.

---

### User Story 3 - Edit and delete bookmarks (Priority: P2)

The person keeps their collection tidy by correcting a bookmark's details or
removing ones they no longer need.

**Why this priority**: Managing (not just saving) is part of the request, but the
app is already useful without editing. This makes the collection maintainable over
time.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user edits its title or address and
   saves, **Then** the updated details are shown in the list.
2. **Given** a saved bookmark, **When** the user deletes it and confirms, **Then**
   it is removed from the list and does not reappear after reloading.
3. **Given** a delete request, **When** it is initiated, **Then** the user is asked
   to confirm before the bookmark is permanently removed.

---

### User Story 4 - Organize and find bookmarks (Priority: P3)

As the collection grows, the person searches by keyword and organizes bookmarks
with tags so they can find the right one quickly.

**Why this priority**: Valuable once a user has many bookmarks, but not needed for
the first useful release.

**Acceptance Scenarios**:

1. **Given** many saved bookmarks, **When** the user types a keyword, **Then** the
   list narrows to bookmarks whose title, address, or tag matches the keyword.
2. **Given** a bookmark, **When** the user assigns one or more tags, **Then** the
   bookmark can be filtered by those tags.
3. **Given** a keyword with no matches, **When** the search runs, **Then** the app
   shows a clear "no results" state.

---

### Edge Cases

- What happens when the user saves the same web address twice? The app warns that
  the bookmark already exists but does not block a deliberate duplicate.
- How does the system handle a very long web address or title? It is stored in full
  and displayed truncated with the full value available on hover/expand.
- What happens when a web address is entered without a scheme (e.g. `example.com`)?
  The app normalizes it to a valid address (assuming `https://`) before saving.
- What happens when the underlying page no longer exists? The app still stores and
  opens the address; it does not guarantee the destination is reachable.
- How does the app behave with no network connection? Saved bookmarks remain
  viewable; opening a bookmark depends on the user's own connectivity.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to save a bookmark by providing a web
  address, with an optional title and optional notes.
- **FR-002**: System MUST validate that the provided web address is well-formed and
  reject saving when it is not, showing a clear error message.
- **FR-003**: System MUST normalize addresses entered without a scheme by assuming a
  secure (`https://`) scheme before saving.
- **FR-004**: System MUST display a saved bookmark using its title when present,
  otherwise a sensible fallback label derived from its address.
- **FR-005**: Users MUST be able to view a list of all saved bookmarks, showing at
  least the title and web address of each.
- **FR-006**: Users MUST be able to open a bookmark's web address in a new browser
  tab from the list.
- **FR-007**: Users MUST be able to edit an existing bookmark's title, address, and
  notes.
- **FR-008**: Users MUST be able to delete a bookmark, with a confirmation step
  before permanent removal.
- **FR-009**: System MUST persist all bookmarks so they remain available after the
  app is closed and reopened.
- **FR-010**: System MUST allow users to assign zero or more tags to a bookmark and
  filter the list by tag.
- **FR-011**: Users MUST be able to search bookmarks by keyword matching title,
  address, notes, or tags.
- **FR-012**: System MUST present a clear empty state when no bookmarks exist and a
  clear "no results" state when a search or filter matches nothing.
- **FR-013**: System MUST warn the user when they attempt to save a web address that
  already exists, while still permitting a deliberate duplicate.
- **FR-014**: System MUST order the bookmark list by most recently added by default.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved reference to a web page. Attributes: web address (required),
  title (optional), notes (optional), tags (zero or more), date added, date last
  updated.
- **Tag**: A short user-defined label used to group and filter bookmarks. A bookmark
  may have many tags; a tag may apply to many bookmarks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save their first bookmark in under 30 seconds from opening
  the app.
- **SC-002**: 95% of saved bookmarks open the exact web address that was saved when
  activated.
- **SC-003**: Users can locate a specific bookmark within a collection of 200 using
  search or filter in under 10 seconds.
- **SC-004**: All saved bookmarks remain intact and viewable across app restarts,
  with zero data loss under normal use.
- **SC-005**: 90% of first-time users successfully save and reopen a bookmark
  without external help.

## Assumptions

- The app is used by a single person managing their own personal bookmark
  collection; multi-user accounts and sharing are out of scope for the first
  version.
- Because there is a single local user, authentication/login is out of scope for
  the first version.
- Bookmarks are stored locally for the app instance; cloud sync across devices is
  out of scope for the first version.
- The app targets a modern desktop web browser; dedicated mobile apps are out of
  scope for the first version, though the layout should remain usable on smaller
  screens.
- Automatic fetching of page titles, favicons, or previews is a nice-to-have, not a
  requirement; the fallback label derived from the address is sufficient.
- Importing or exporting bookmarks from/to other browsers is out of scope for the
  first version.
