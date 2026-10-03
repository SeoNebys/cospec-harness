# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-24

**Status**: Draft

**Input**: User description: "An app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A person finds a web page they want to keep and saves it into the app by entering
its address. The app records the page so they can return to it later. The app
tries to capture the page's title automatically so the saved item is recognisable
without extra typing.

**Why this priority**: Saving a link is the core reason the app exists. Without it
there is nothing to manage. This single story, on its own, already delivers value:
a usable place to stash links.

**Independent Test**: Can be fully tested by entering a valid web address, saving
it, and confirming the new bookmark appears in the list with a recognisable title
and its address.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user enters a valid web address
   and saves it, **Then** a new bookmark appears in the list showing its title and
   address.
2. **Given** the user enters an address without a title, **When** they save it,
   **Then** the app fills in a title derived from the page (or the address itself
   if no title can be determined) so the bookmark is still recognisable.
3. **Given** the user enters text that is not a valid web address, **When** they
   try to save, **Then** the app rejects the entry with a clear message and does
   not create a bookmark.

---

### User Story 2 - Browse and open saved bookmarks (Priority: P1)

A person opens the app to see everything they have saved and clicks a bookmark to
open the original page in their browser.

**Why this priority**: Saved links have no value unless they can be found and
reopened. Together with Story 1 this forms the minimum viable product.

**Independent Test**: Can be tested by opening the app with existing bookmarks,
confirming they are all listed, and clicking one to open the target page in a new
browser tab.

**Acceptance Scenarios**:

1. **Given** several saved bookmarks, **When** the user opens the app, **Then**
   all bookmarks are listed with their titles and addresses.
2. **Given** a listed bookmark, **When** the user clicks it, **Then** the original
   page opens in a new browser tab.
3. **Given** no bookmarks have been saved yet, **When** the user opens the app,
   **Then** an empty state invites them to add their first bookmark.

---

### User Story 3 - Edit and delete bookmarks (Priority: P2)

A person corrects a bookmark's title or address, or removes a bookmark they no
longer need.

**Why this priority**: Keeps the collection accurate and uncluttered over time.
Valuable, but the app is already useful for saving and reopening links without it.

**Independent Test**: Can be tested by editing an existing bookmark's title and
confirming the change persists, then deleting a bookmark and confirming it no
longer appears.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user edits its title or address
   and saves, **Then** the list shows the updated values.
2. **Given** an existing bookmark, **When** the user deletes it and confirms,
   **Then** it is removed from the list and does not reappear after reload.
3. **Given** a delete action, **When** it is triggered, **Then** the user is asked
   to confirm before the bookmark is permanently removed.

---

### User Story 4 - Find bookmarks with search and tags (Priority: P3)

A person with many saved bookmarks narrows the list by typing a search term or by
filtering on a tag they assigned when saving.

**Why this priority**: Becomes important only once a collection grows large. Not
needed to prove the core value, so it is the lowest priority.

**Independent Test**: Can be tested by saving several bookmarks with different
titles and tags, then searching for a term and filtering by a tag and confirming
only matching bookmarks remain visible.

**Acceptance Scenarios**:

1. **Given** many saved bookmarks, **When** the user types a search term, **Then**
   only bookmarks whose title, address, or tags match are shown.
2. **Given** bookmarks with assigned tags, **When** the user selects a tag filter,
   **Then** only bookmarks carrying that tag are shown.
3. **Given** an active search or filter that matches nothing, **When** it is
   applied, **Then** a clear "no results" state is shown and the filter can be
   cleared.

---

### Edge Cases

- **Duplicate address**: When the user saves an address that already exists, the
  app warns that it is already saved and does not create a silent duplicate.
- **Very long title or address**: Long values are stored in full and displayed
  truncated so the layout stays readable.
- **Unreachable page on save**: If the page's title cannot be fetched, the
  bookmark is still saved using the address (or user-entered title) as its title.
- **Address without a scheme**: An address typed without `http://`/`https://`
  (e.g. `example.com`) is accepted and normalised to a valid web address.
- **Empty required fields**: Saving with no address is rejected with a clear
  message.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to save a bookmark by providing a web
  address, with an optional title, notes, and one or more tags.
- **FR-002**: System MUST validate that the address is a well-formed web address
  before saving, and reject invalid entries with a clear message.
- **FR-003**: System MUST normalise addresses entered without a scheme to a valid
  web address (defaulting to `https://`).
- **FR-004**: System MUST attempt to determine a page title automatically when the
  user does not supply one, falling back to the address if none can be determined.
- **FR-005**: System MUST persist bookmarks so they remain available after the app
  is closed and reopened.
- **FR-006**: System MUST display all saved bookmarks in a list showing at least
  the title and address, most recently added first.
- **FR-007**: Users MUST be able to open a bookmark's original page in a new
  browser tab.
- **FR-008**: Users MUST be able to edit the title, address, notes, and tags of an
  existing bookmark.
- **FR-009**: Users MUST be able to delete a bookmark, with a confirmation step
  before permanent removal.
- **FR-010**: System MUST warn the user when saving an address that already exists
  in the collection.
- **FR-011**: Users MUST be able to search bookmarks by a term matching title,
  address, notes, or tags.
- **FR-012**: Users MUST be able to filter bookmarks by a selected tag.
- **FR-013**: System MUST show a clear empty state when no bookmarks exist and a
  clear "no results" state when a search or filter matches nothing.
- **FR-014**: System MUST record the date each bookmark was added.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved web page. Attributes: title, web address, optional notes,
  zero or more tags, date added, date last modified.
- **Tag**: A short label used to group and filter bookmarks. A bookmark may carry
  several tags; a tag may apply to many bookmarks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark in under 20 seconds from opening the
  app.
- **SC-002**: A user can locate a specific bookmark among at least 200 saved items
  in under 10 seconds using search or tag filtering.
- **SC-003**: 100% of saved bookmarks remain present and openable after closing and
  reopening the app.
- **SC-004**: 95% of first-time users successfully save and reopen a bookmark on
  their first attempt without assistance.
- **SC-005**: Invalid addresses are rejected before saving in 100% of cases, with a
  message the user can act on.

## Assumptions

- **Single user, no accounts**: v1 is a personal single-user app with no login or
  multi-user sharing. Bookmarks are private to the local instance.
- **Web platform**: The app is delivered as a web application usable in a modern
  desktop browser; dedicated mobile apps and browser extensions are out of scope
  for v1.
- **Automatic title fetch is best-effort**: Fetching a page's title depends on the
  page being reachable; failure falls back to the address and never blocks saving.
- **Local persistence is sufficient**: Bookmarks persist for the single instance;
  cross-device sync and cloud backup are out of scope for v1.
- **Import/export** of bookmarks from browsers or files is out of scope for v1.
