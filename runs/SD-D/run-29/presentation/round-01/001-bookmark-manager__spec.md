# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-27

**Status**: Draft

**Input**: User description: "An app to save and manage bookmarks"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A user finds a web page they want to keep and saves it into the app by providing
its address. The app records the page so the user can return to it later without
having to remember or re-find the address.

**Why this priority**: Saving links is the core reason the app exists. Without
it, nothing else has value. This story alone is a usable product: a place to
stash links you don't want to lose.

**Independent Test**: Can be fully tested by adding a link, reloading the app,
and confirming the saved link still appears and opens the correct page.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user submits a valid web
   address, **Then** the bookmark is saved and appears in the list.
2. **Given** a saved bookmark, **When** the user selects it, **Then** the app
   opens (or hands off to the browser) the correct target page.
3. **Given** the user submits an address without a title, **When** the bookmark
   is saved, **Then** the app derives a readable title (e.g., from the page or
   the address) so the entry is recognizable.
4. **Given** the user submits an invalid or empty address, **When** they try to
   save, **Then** the app rejects it with a clear message and saves nothing.

---

### User Story 2 - Browse and find saved bookmarks (Priority: P2)

A user with a growing collection of saved links opens the app to locate a
particular bookmark, either by scanning the list or by searching.

**Why this priority**: A collection is only useful if items can be found again.
Once saving works, retrieval is the next most valuable capability.

**Independent Test**: Can be tested by seeding several bookmarks, then searching
by keyword and confirming only matching bookmarks are shown.

**Acceptance Scenarios**:

1. **Given** multiple saved bookmarks, **When** the user opens the app, **Then**
   all bookmarks are listed with their title and address.
2. **Given** multiple saved bookmarks, **When** the user types a search term,
   **Then** only bookmarks whose title or address matches are shown.
3. **Given** a search that matches nothing, **When** results are displayed,
   **Then** the app shows a clear "no results" state rather than an empty screen.

---

### User Story 3 - Edit and delete bookmarks (Priority: P2)

A user cleans up their collection by correcting a title, fixing an address, or
removing a bookmark that is no longer relevant.

**Why this priority**: Managing (not just saving) is explicit in the request.
Editing and deleting keep the collection accurate and uncluttered over time.

**Independent Test**: Can be tested by editing a bookmark's title and confirming
the change persists, then deleting a bookmark and confirming it no longer
appears.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user edits its title or address,
   **Then** the updated values are saved and shown.
2. **Given** a saved bookmark, **When** the user deletes it, **Then** it is
   removed from the list and does not reappear after reload.
3. **Given** a delete action, **When** the user triggers it, **Then** the app
   confirms the intent (or offers undo) to prevent accidental loss.

---

### User Story 4 - Organize bookmarks with tags (Priority: P3)

A user with many bookmarks groups them with labels (tags) and filters the list
to a single label to focus on one topic.

**Why this priority**: Organization adds real value at scale but is not required
for a usable first version. It builds on saving and browsing.

**Independent Test**: Can be tested by tagging several bookmarks, filtering by a
tag, and confirming only bookmarks with that tag appear.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user adds one or more tags, **Then** the
   tags are saved and displayed with the bookmark.
2. **Given** bookmarks with different tags, **When** the user selects a tag
   filter, **Then** only bookmarks carrying that tag are shown.

---

### Edge Cases

- **Duplicate address**: When a user saves an address that already exists, the
  app warns that it is already saved rather than creating a silent duplicate.
- **Very long titles or addresses**: The app displays long values without
  breaking the layout (truncation with full value available on demand).
- **Address without a scheme** (e.g., `example.com`): The app normalizes it to a
  usable link rather than rejecting it.
- **Unreachable page**: The app still saves the bookmark; reachability is not a
  condition of saving.
- **Deleting the last bookmark**: The app returns to a friendly empty state.
- **Large collection**: The list remains responsive with hundreds of bookmarks.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to save a bookmark by providing a web
  address, with an optional title and optional notes.
- **FR-002**: System MUST validate the address on save and reject empty or
  clearly malformed addresses with a clear, actionable message.
- **FR-003**: System MUST derive a readable title when the user does not supply
  one, so every bookmark is identifiable.
- **FR-004**: System MUST persist bookmarks so they remain available across app
  restarts and page reloads.
- **FR-005**: System MUST display all saved bookmarks in a list showing at least
  the title and address.
- **FR-006**: Users MUST be able to open a saved bookmark's target page.
- **FR-007**: Users MUST be able to search bookmarks by keyword matching title
  and/or address, and see only matching results.
- **FR-008**: Users MUST be able to edit a bookmark's title, address, and notes.
- **FR-009**: Users MUST be able to delete a bookmark, with a safeguard against
  accidental deletion (confirmation or undo).
- **FR-010**: System MUST warn when saving an address that already exists in the
  collection.
- **FR-011**: Users MUST be able to add and remove tags (labels) on a bookmark.
- **FR-012**: Users MUST be able to filter the list to bookmarks carrying a
  selected tag.
- **FR-013**: System MUST record the date each bookmark was saved and present
  bookmarks in a sensible default order (most recently saved first).
- **FR-014**: System MUST present a clear empty state when there are no
  bookmarks and a clear "no results" state when a search or filter matches
  nothing.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved web page. Attributes: address (required), title,
  optional notes, one or more tags, and the date it was saved.
- **Tag**: A user-defined label used to group bookmarks. A bookmark may carry
  several tags; a tag may apply to many bookmarks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save their first bookmark in under 30 seconds from
  opening the app.
- **SC-002**: A user can locate a specific bookmark in a collection of 100+ in
  under 10 seconds using search or filter.
- **SC-003**: Saved bookmarks survive a full app restart with 100% retention (no
  lost entries).
- **SC-004**: 95% of first-time users successfully save, find, and re-open a
  bookmark without external help.
- **SC-005**: The bookmark list remains responsive (results feel instant, under
  ~1 second) with at least 500 saved bookmarks.

## Assumptions

- **Single user, no accounts (for v1)**: The app manages one person's collection
  and does not require sign-in or multi-user separation. See open question Q1.
- **Web application**: Delivered as a browser-based app (aligns with the
  project's runtime presentation environment). Native mobile/desktop apps are
  out of scope for v1.
- **Bookmarks are web addresses (URLs)**: Saving arbitrary files or non-web
  resources is out of scope for v1.
- **No automatic content capture**: The app stores the link and user-provided
  metadata; it does not archive page contents, screenshots, or offline copies in
  v1.
- **No import/export or browser-extension sync in v1**: These are candidate
  future enhancements, not part of the initial scope.
- **English-language UI** with standard, accessible web interactions.

## Open Questions

- **Q1 (scope)**: Should v1 be a single-user personal tool (no login), or
  support multiple users with individual accounts and private collections? This
  significantly affects scope (authentication, per-user data isolation). Current
  assumption: single-user, no accounts.
