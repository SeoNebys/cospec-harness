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
   address, **Then** the bookmark is saved and shown at the top of the list
   immediately, and the page's real title, description, favicon, and preview
   image are fetched in the background and fill in once available.
2. **Given** the app has fetched a page's real title and description, **When**
   the bookmark is displayed, **Then** the fetched values are used, and the
   user can still edit the title and description afterward.
3. **Given** the page's metadata cannot be fetched (unreachable page, missing
   data, or timeout), **When** the bookmark is saved, **Then** it is still
   created using a title derived from the address, and the missing pieces
   (description, favicon, preview) degrade gracefully to placeholders.
4. **Given** the user submits an entry that is not a valid web address,
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

- **Duplicate address**: When the user saves an address that already matches an
  existing bookmark, the app takes them straight to editing that existing
  bookmark instead of creating a duplicate (see FR-011).
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
  address, with optional free-text notes.
- **FR-002**: System MUST validate that the provided address is a well-formed
  web address and reject entries that are not, with a clear error message.
- **FR-003**: System MUST accept an address without an explicit scheme and
  normalize it to a valid, openable link.
- **FR-004**: System MUST save a bookmark immediately on submission and then
  fetch the target page's real title, description, favicon, and preview image
  in the background, updating the bookmark in place once the metadata is
  available. Saving MUST NOT wait for the fetch to complete.
- **FR-004a**: System MUST allow the user to edit the title and description
  after they have been automatically fetched.
- **FR-004b**: When metadata cannot be fetched (page unreachable, data missing,
  or a fetch timeout is exceeded), System MUST still create the bookmark using
  a title derived from the address and gracefully omit or show placeholders for
  the missing description, favicon, and preview image, without blocking the
  save.
- **FR-005**: System MUST display all saved bookmarks in a list showing at
  least the title and address, ordered with the most recently added first.
- **FR-006**: Users MUST be able to open a bookmark's original page in a new
  browser tab.
- **FR-007**: Users MUST be able to search/filter bookmarks by keyword matching
  the title or address, updating results as they type.
- **FR-008**: System MUST show a clear empty state both on first run and when a
  search returns no matches.
- **FR-009**: Users MUST be able to edit the title, description, address, and
  notes of an existing bookmark, with the same validation as creation.
- **FR-010**: Users MUST be able to delete a bookmark, and the system MUST
  require explicit confirmation before removing it.
- **FR-011**: System MUST detect when a newly entered address matches an
  existing bookmark and, instead of creating a duplicate, take the user to edit
  that existing bookmark.
- **FR-012**: System MUST persist bookmarks so they remain available after the
  app is closed and reopened on the same device.
- **FR-013**: System MUST record the date/time each bookmark was saved.
- **FR-014**: Users MUST be able to organize bookmarks with tags/labels and
  filter the list by a selected tag.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved web page. Key attributes: address (URL), title
  (auto-fetched, user-editable), description (auto-fetched, user-editable),
  favicon (auto-fetched), preview image (auto-fetched), notes (optional,
  user-authored), tags (zero or more labels), date saved. Each bookmark is
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
- **SC-006**: When a saved page exposes standard metadata, the bookmark shows
  the page's real title and preview image without any manual entry.
- **SC-007**: Saving never hangs on a slow or unreachable page: the bookmark is
  created (with graceful placeholders) within a bounded time even when metadata
  cannot be fetched.

## Assumptions

- **Single-user, single-device scope for v1**: Bookmarks are stored for one
  user on one device. Accounts, login, and cross-device sync are out of scope
  for this version.
- **Web application**: Delivered as a browser-based app; native mobile apps are
  out of scope for v1 (the web UI should remain usable on a phone browser).
- **Automatic, background metadata fetching is in scope**: On save, the
  bookmark is created immediately and the app fetches the target page's real
  title, description, favicon, and preview image from the internet in the
  background (choice A), updating the bookmark in place when ready. This assumes
  the app has outbound internet access to reach saved pages, and that a page may
  not expose all of this metadata; missing pieces degrade gracefully (FR-004b).
  A reasonable fetch timeout applies, and because saving never waits on the
  fetch, an unresponsive page never blocks the user.
- **Personal-scale collections**: Designed for individuals managing up to a few
  thousand bookmarks, not enterprise-scale archives.
- **Modern browser**: Users access the app with a current mainstream web
  browser.
