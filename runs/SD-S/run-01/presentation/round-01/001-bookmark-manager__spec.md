# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "An app to save and manage bookmarks"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A person finds a web page they want to return to later and saves it into the app
by providing its address. The app records the page so it can be found again.

**Why this priority**: Saving is the core reason the app exists. Without it there
is nothing to manage. This single story is a usable product on its own.

**Independent Test**: Enter a web address, save it, and confirm the bookmark
appears in the saved list after a page refresh.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user submits a valid web
   address, **Then** a new bookmark is created and shown in the list.
2. **Given** the save form, **When** the user submits without an address, **Then**
   the app rejects the save and explains that an address is required.
3. **Given** a saved bookmark, **When** the user reloads or reopens the app,
   **Then** the bookmark is still present.

---

### User Story 2 - Browse and open saved bookmarks (Priority: P1)

A person opens the app to see everything they have saved and clicks a bookmark to
open the original page.

**Why this priority**: Saved bookmarks have no value unless they can be viewed and
revisited. Together with Story 1 this forms the minimum viable product.

**Independent Test**: With at least one saved bookmark, open the list, click a
bookmark, and confirm the original page opens.

**Acceptance Scenarios**:

1. **Given** several saved bookmarks, **When** the user opens the app, **Then**
   all bookmarks are listed with their title and address.
2. **Given** a bookmark in the list, **When** the user activates it, **Then** the
   original page opens in the browser.
3. **Given** an empty list, **When** the user opens the app, **Then** a friendly
   empty state invites them to add their first bookmark.

---

### User Story 3 - Edit and delete bookmarks (Priority: P2)

A person corrects a bookmark's title, updates its address, or removes a bookmark
they no longer need.

**Why this priority**: Keeps the collection accurate and uncluttered over time.
Valuable, but the app is still useful without it.

**Independent Test**: Edit an existing bookmark's title, save, and confirm the
change persists; delete a bookmark and confirm it disappears.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user edits its title and saves,
   **Then** the updated title is shown and persisted.
2. **Given** a saved bookmark, **When** the user deletes it, **Then** it is
   removed from the list and does not reappear after reload.
3. **Given** a delete action, **When** the user is asked to confirm, **Then** the
   bookmark is only removed after confirmation.

---

### User Story 4 - Organize and find bookmarks (Priority: P2)

A person with a growing collection assigns tags to bookmarks and searches or
filters to locate a specific one quickly.

**Why this priority**: Becomes important as the collection grows; not needed for a
first usable version but strongly expected by users managing many bookmarks.

**Independent Test**: Add tags to several bookmarks, filter by a tag, and search
by keyword; confirm only matching bookmarks are shown.

**Acceptance Scenarios**:

1. **Given** bookmarks with tags, **When** the user filters by a tag, **Then**
   only bookmarks carrying that tag are shown.
2. **Given** a collection of bookmarks, **When** the user searches by a keyword,
   **Then** bookmarks whose title, address, or tags match are shown.
3. **Given** a search with no matches, **When** results are computed, **Then** a
   clear "no results" state is shown.

---

### Edge Cases

- What happens when the user saves an address that is already bookmarked?
  (Assumption: the app warns about the duplicate but allows it.)
- What happens when the submitted text is not a valid web address?
- What happens when a page title cannot be determined automatically?
- What happens when a saved page no longer exists (dead link)?
- How does the app behave with a very large number of bookmarks?
- What happens when a search or filter returns nothing?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST let a user save a bookmark by providing a web address.
- **FR-002**: The app MUST let a user give a bookmark a human-readable title, and
  SHOULD suggest a default title derived from the page when possible.
- **FR-003**: The app MUST validate that the address is a well-formed web address
  and reject saves that are empty or malformed with a clear message.
- **FR-004**: The app MUST persist bookmarks so they remain available across app
  restarts and page reloads.
- **FR-005**: The app MUST display all saved bookmarks in a list showing at least
  the title and address.
- **FR-006**: The app MUST let a user open a bookmark's original page.
- **FR-007**: Users MUST be able to edit an existing bookmark's title and address.
- **FR-008**: Users MUST be able to delete a bookmark, with a confirmation step
  before removal.
- **FR-009**: The app MUST let a user assign zero or more tags to a bookmark.
- **FR-010**: The app MUST let a user filter bookmarks by tag.
- **FR-011**: The app MUST let a user search bookmarks by keyword across title,
  address, and tags.
- **FR-012**: The app MUST show a clear empty state when there are no bookmarks
  and a clear "no results" state when a search or filter matches nothing.
- **FR-013**: The app SHOULD warn when a user saves an address that already
  exists in the collection, while still allowing the save.
- **FR-014**: The app MUST record when each bookmark was saved so bookmarks can be
  ordered by most-recently-added by default.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved reference to a web page. Attributes: address, title,
  optional notes, tags, date saved, date last modified.
- **Tag**: A short label used to group and find bookmarks. A bookmark may carry
  many tags; a tag may apply to many bookmarks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save their first bookmark within 30 seconds of opening
  the app for the first time.
- **SC-002**: A user can locate a specific bookmark in a collection of 500 using
  search or filter in under 10 seconds.
- **SC-003**: 95% of saved bookmarks are still retrievable after closing and
  reopening the app (no data loss).
- **SC-004**: The bookmark list remains responsive (results appear within 1
  second) with at least 1,000 saved bookmarks.
- **SC-005**: 90% of first-time users successfully save, find, and open a
  bookmark without external help.

## Assumptions

- **Single user, personal use**: v1 is a personal bookmark manager for one user
  on their own device; multi-user accounts, sharing, and sign-in are out of scope.
  *(This is the main open scope question — see the review note below.)*
- **Web pages only**: Bookmarks point to standard web addresses; other resource
  types (files, phone numbers, deep links) are out of scope for v1.
- **Manual entry**: Users add bookmarks by entering/pasting an address inside the
  app. Importing from browsers or a one-click browser extension is out of scope
  for v1 (candidate for a later release).
- **Local persistence is sufficient**: Bookmarks persist on the user's device;
  cloud sync across devices is out of scope for v1.
- **Reasonable collection size**: The app targets personal collections up to a few
  thousand bookmarks, not enterprise-scale archives.
- **Duplicates allowed with a warning**: Saving an already-saved address is
  permitted but flagged.

## Open Question for Review

The single largest scope decision is **who the app is for**:

- **A. Personal, single-user, local (assumed default)** — simplest, fastest to a
  usable product, no accounts. Recommended for v1.
- **B. Multi-user with accounts and cross-device sync** — significantly larger
  scope (sign-in, private per-user data, sync/backup).

The spec above assumes **Option A**. Please confirm A, or tell me B, before we
proceed to planning.
