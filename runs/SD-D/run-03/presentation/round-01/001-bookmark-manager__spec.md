# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "An app to save and manage bookmarks"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A user comes across a web page they want to keep. They save it into the app by
providing its address, and the app records it — capturing the page's title so it
is recognisable later. The saved bookmark appears in their list immediately.

**Why this priority**: Saving is the core reason the app exists. Without it,
nothing else has value. This alone is a usable product: a place to stash links.

**Independent Test**: Add a bookmark by supplying a web address, then confirm it
appears in the list with a recognisable title and its address. Delivers the core
"keep this link" value on its own.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user saves a valid web address,
   **Then** a new bookmark appears in the list showing its title and address.
2. **Given** the user provides an address without a recognisable title source,
   **When** they save it, **Then** the bookmark is still saved and the address
   itself is shown as the title.
3. **Given** the user submits something that is not a valid web address,
   **When** they try to save it, **Then** the app rejects it with a clear message
   and nothing is added to the list.

---

### User Story 2 - Browse and open saved bookmarks (Priority: P1)

A user opens the app to revisit something they saved. They see their bookmarks in
a list, and can open any bookmark's page in their browser with a single action.

**Why this priority**: Saved links are worthless if they cannot be retrieved and
opened. Together with saving, this forms the minimum viable product.

**Independent Test**: With several bookmarks already saved, view the list and
activate one, confirming it opens the correct page.

**Acceptance Scenarios**:

1. **Given** one or more saved bookmarks, **When** the user views the app,
   **Then** all bookmarks are listed with title and address.
2. **Given** a bookmark in the list, **When** the user activates it, **Then**
   its page opens in the browser.
3. **Given** an empty list, **When** the user views the app, **Then** a friendly
   empty state explains how to add the first bookmark.

---

### User Story 3 - Organise, search, and edit bookmarks (Priority: P2)

As the collection grows, a user needs to find and tidy their bookmarks. They can
search by keyword, assign tags, filter by tag, edit a bookmark's details, and
delete bookmarks they no longer want.

**Why this priority**: Essential once a user has more than a handful of
bookmarks, but the app is already useful without it. This is what turns a flat
list into a manageable collection.

**Independent Test**: With a set of tagged bookmarks, search by a keyword and
filter by a tag to confirm only matching bookmarks show; edit one bookmark's
title and tags and confirm the change persists; delete one and confirm it is
gone.

**Acceptance Scenarios**:

1. **Given** several bookmarks, **When** the user types a keyword, **Then** the
   list narrows to bookmarks whose title, address, or tags match.
2. **Given** bookmarks with assigned tags, **When** the user selects a tag,
   **Then** only bookmarks carrying that tag are shown.
3. **Given** an existing bookmark, **When** the user edits its title or tags and
   saves, **Then** the updated details are shown and retained.
4. **Given** an existing bookmark, **When** the user deletes it and confirms,
   **Then** it is removed from the list and no longer appears in searches.

---

### Edge Cases

- **Duplicate address**: When a user saves an address that already exists, the
  app warns that it is already bookmarked rather than silently creating a
  duplicate.
- **Unreachable page on save**: If a page's title cannot be retrieved (site
  offline, blocked, or slow), the bookmark is still saved using the address as
  its title; saving never blocks on the remote page.
- **Very long titles or addresses**: The list display truncates gracefully
  without breaking layout; the full value remains available.
- **Deleting a tag in use**: Removing a tag from a bookmark does not delete other
  bookmarks; a tag with no remaining bookmarks simply disappears from the filter
  list.
- **Search with no matches**: A clear "no results" state is shown, with an easy
  way to clear the search.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to save a bookmark by providing a web
  address.
- **FR-002**: System MUST validate that the supplied address is a well-formed web
  address and reject malformed input with a clear message.
- **FR-003**: System MUST capture a title for each saved bookmark, automatically
  deriving it from the page where possible and falling back to the address when a
  title cannot be determined.
- **FR-004**: System MUST let the user optionally add a title, notes/description,
  and one or more tags when saving or editing a bookmark.
- **FR-005**: System MUST display all saved bookmarks in a list showing at least
  the title and address.
- **FR-006**: Users MUST be able to open a bookmark's page in their web browser
  from the list.
- **FR-007**: Users MUST be able to edit an existing bookmark's title, notes, and
  tags.
- **FR-008**: Users MUST be able to delete a bookmark, with a confirmation step
  to prevent accidental loss.
- **FR-009**: System MUST let users search bookmarks by keyword, matching against
  title, address, notes, and tags.
- **FR-010**: System MUST let users filter bookmarks by tag.
- **FR-011**: System MUST detect when a user attempts to save an address that is
  already bookmarked and warn them rather than create a duplicate.
- **FR-012**: System MUST persist bookmarks so they remain available across app
  restarts. [NEEDS CLARIFICATION: single-user local storage on one device, or
  multi-user accounts with sync across devices?]
- **FR-013**: System MUST record when each bookmark was saved and present
  bookmarks in a sensible default order (most recently saved first).

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved link. Key attributes: web address, title, optional
  notes/description, set of tags, date saved. Belongs to the user's collection.
- **Tag**: A short user-defined label used to group and filter bookmarks. A
  bookmark may have many tags; a tag may apply to many bookmarks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark in under 15 seconds from opening the
  app to seeing it in the list.
- **SC-002**: A user can locate a specific bookmark in a collection of 500 in
  under 10 seconds using search or tag filtering.
- **SC-003**: 95% of saved bookmarks display a meaningful title (derived from the
  page rather than just the raw address).
- **SC-004**: Opening a saved bookmark launches the correct page on the first
  attempt in 99% of cases.
- **SC-005**: No user action results in accidental permanent loss of a bookmark
  without a confirmation step.
- **SC-006**: Saved bookmarks are still present after closing and reopening the
  app 100% of the time.

## Assumptions

- The app manages web-page bookmarks (http/https addresses); other link types
  (files, email addresses) are out of scope for v1.
- A single person uses the app to manage their own personal collection; sharing
  collections between users is out of scope for v1 (pending the FR-012
  clarification on accounts vs. local storage).
- Automatic title capture is best-effort; the app never blocks saving on
  retrieving remote page metadata.
- Import from, or export to, external browser bookmark files is out of scope for
  v1.
- The app is used on a device with a web browser available to open links.
