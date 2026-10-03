# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-24

**Status**: Draft

**Input**: User description: "An app to save and manage bookmarks"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A person finds a web page worth keeping and saves it to the app by entering
(or pasting) its address. The app records the page and shows it in their list
of saved bookmarks so they can return to it later.

**Why this priority**: Saving is the core reason the app exists. Without it
there is nothing to manage. This single capability, plus the ability to see
what was saved, is a usable product on its own.

**Independent Test**: Can be fully tested by adding a bookmark with a valid
address and confirming it appears in the saved list with a recognizable title
and clickable link — delivering the value of "capture now, revisit later".

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user submits a valid web
   address, **Then** a new bookmark is saved and appears at the top of the list.
2. **Given** the user is adding a bookmark, **When** they provide a title (or
   leave it blank), **Then** the bookmark is stored with the given title, or a
   sensible default derived from the address when no title is provided.
3. **Given** the user submits an entry that is not a valid web address,
   **When** they try to save it, **Then** the app rejects it with a clear
   message and does not create a bookmark.

---

### User Story 2 - Browse, search, and open bookmarks (Priority: P2)

A person with a growing collection wants to find a specific saved page and
open it. They scan their list, type a keyword to narrow it down, and click a
bookmark to open the original page.

**Why this priority**: Saving is only useful if items can be found and reached
again. Retrieval makes the collection valuable as it grows, but it depends on
saving (P1) existing first.

**Independent Test**: Can be tested by pre-loading several bookmarks, typing a
keyword, confirming the list narrows to matching items, and confirming a click
opens the correct original page.

**Acceptance Scenarios**:

1. **Given** several saved bookmarks, **When** the user views the app, **Then**
   all bookmarks are listed with their title and address.
2. **Given** several saved bookmarks, **When** the user types a keyword into
   search, **Then** the list shows only bookmarks whose title or address
   matches the keyword.
3. **Given** a search with no matches, **When** results are shown, **Then** the
   app displays a clear "no results" state rather than an empty ambiguous view.
4. **Given** a bookmark in the list, **When** the user activates it, **Then**
   the original page opens in a new browser tab.

---

### User Story 3 - Edit and delete bookmarks (Priority: P3)

A person maintains their collection over time: correcting a title, fixing an
address, or removing bookmarks they no longer need.

**Why this priority**: Housekeeping keeps the collection accurate and
trustworthy, but the app is already usable for capture and retrieval without
it, so it comes after P1 and P2.

**Independent Test**: Can be tested by editing an existing bookmark's title and
confirming the change persists, and by deleting a bookmark and confirming it no
longer appears.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user edits its title or
   address and saves, **Then** the updated values are shown and persist across
   a page reload.
2. **Given** an existing bookmark, **When** the user deletes it and confirms,
   **Then** it is removed from the list and does not reappear on reload.
3. **Given** a delete action, **When** the user is asked to confirm, **Then**
   the bookmark is only removed after explicit confirmation.

---

### Edge Cases

- **Duplicate address**: When the user saves an address that already exists,
  the app warns that it is already saved rather than silently creating a
  duplicate (see FR-011).
- **Very long title or address**: Long values are stored fully and displayed
  truncated so the layout stays readable.
- **Address without a scheme**: An address entered as `example.com` (no
  `http://`/`https://`) is accepted and normalized to a usable link.
- **Empty list / first run**: A new user with no bookmarks sees a friendly
  empty state that explains how to add their first bookmark.
- **Reload / return visit**: Saved bookmarks are still present after closing
  and reopening the app on the same device.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to save a bookmark by providing a web
  address, with an optional title and optional free-text notes.
- **FR-002**: System MUST validate that the provided address is a well-formed
  web address and reject entries that are not, with a clear error message.
- **FR-003**: System MUST accept an address without an explicit scheme and
  normalize it to a valid, openable link.
- **FR-004**: System MUST derive a default title from the address when the user
  does not supply one.
- **FR-005**: System MUST display all saved bookmarks in a list showing at
  least the title and address, ordered with the most recently added first.
- **FR-006**: Users MUST be able to open a bookmark's original page in a new
  browser tab.
- **FR-007**: Users MUST be able to search/filter bookmarks by keyword matching
  the title or address, updating results as they type.
- **FR-008**: System MUST show a clear empty state both on first run and when a
  search returns no matches.
- **FR-009**: Users MUST be able to edit the title, address, and notes of an
  existing bookmark, with the same validation as creation.
- **FR-010**: Users MUST be able to delete a bookmark, and the system MUST
  require explicit confirmation before removing it.
- **FR-011**: System MUST detect when a newly entered address matches an
  existing bookmark and warn the user instead of silently duplicating it.
- **FR-012**: System MUST persist bookmarks so they remain available after the
  app is closed and reopened on the same device.
- **FR-013**: System MUST record the date/time each bookmark was saved.
- **FR-014**: Users MUST be able to organize bookmarks with tags/labels and
  filter the list by a selected tag.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved web page. Key attributes: address (URL), title, notes
  (optional), tags (zero or more labels), date saved. Each bookmark is
  independently viewable, editable, and deletable.
- **Tag**: A short label used to group bookmarks. A bookmark may have several
  tags; a tag may apply to many bookmarks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark in under 20 seconds from opening
  the add form to seeing it in the list.
- **SC-002**: A user can locate a specific bookmark in a collection of 100+ via
  search in under 10 seconds.
- **SC-003**: 95% of first-time users successfully save their first bookmark
  without external help.
- **SC-004**: 100% of saved bookmarks remain present and openable after closing
  and reopening the app on the same device.
- **SC-005**: Invalid addresses are rejected before saving in 100% of attempts,
  with a message the user can act on.

## Assumptions

- **Single-user, single-device scope for v1**: Bookmarks are stored for one
  user on one device. Accounts, login, and cross-device sync are out of scope
  for this version.
- **Web application**: Delivered as a browser-based app; native mobile apps are
  out of scope for v1 (the web UI should remain usable on a phone browser).
- **No automatic metadata fetching required**: The app does not need to fetch a
  page's real title, favicon, or preview from the internet for v1; titles come
  from user input or are derived from the address. (This can be revisited as a
  future enhancement.)
- **Personal-scale collections**: Designed for individuals managing up to a few
  thousand bookmarks, not enterprise-scale archives.
- **Modern browser**: Users access the app with a current mainstream web
  browser.
