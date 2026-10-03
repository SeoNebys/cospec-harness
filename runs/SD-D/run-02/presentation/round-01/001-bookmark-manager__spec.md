# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "An app to save and manage bookmarks"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A person finds a web page they want to return to later. They open the app, paste
or type the page's address, optionally give it a title, and save it. The
bookmark now appears in their list of saved bookmarks.

**Why this priority**: Saving links is the core reason the app exists. Without
it there is nothing to manage. This single story is a usable product on its own.

**Independent Test**: Add a bookmark with an address and confirm it appears in
the saved list and persists after the app is reloaded.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user submits a valid web
   address, **Then** a new bookmark is saved and shown in the list.
2. **Given** the user submits an address without a title, **When** the bookmark
   is saved, **Then** the app stores it with a sensible fallback label (e.g. the
   address itself).
3. **Given** the user submits an empty or clearly invalid address, **When** they
   try to save, **Then** the app rejects it and explains why, saving nothing.

---

### User Story 2 - Browse and open saved bookmarks (Priority: P1)

The person returns later to find a page they saved. They open the app, see their
list of bookmarks, and click one to open the original page in their browser.

**Why this priority**: Saved links are only valuable if they can be found and
reopened. Viewing and opening are inseparable from the core value.

**Independent Test**: With several bookmarks saved, load the list and confirm
each entry opens its original address in a new browser tab.

**Acceptance Scenarios**:

1. **Given** one or more saved bookmarks, **When** the user opens the app,
   **Then** all saved bookmarks are listed with their title and address.
2. **Given** a bookmark in the list, **When** the user activates it, **Then**
   the original page opens in a new browser tab.
3. **Given** no bookmarks have been saved yet, **When** the user opens the app,
   **Then** a friendly empty state invites them to add their first bookmark.

---

### User Story 3 - Edit and delete bookmarks (Priority: P2)

Over time some bookmarks become outdated or were saved with the wrong details.
The person edits a bookmark's title or address, or removes it entirely.

**Why this priority**: Keeping the collection tidy is part of "managing"
bookmarks, but the app is already useful for saving and reopening without it.

**Independent Test**: Edit an existing bookmark's title, confirm the change
persists; delete a bookmark and confirm it disappears and stays gone after
reload.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user changes its title or
   address and saves, **Then** the updated values are shown and persisted.
2. **Given** an existing bookmark, **When** the user deletes it, **Then** it is
   removed from the list and does not return after reload.
3. **Given** the user requests deletion, **When** the action is destructive,
   **Then** the app asks for confirmation before removing the bookmark.

---

### User Story 4 - Find and organize bookmarks (Priority: P3)

As the collection grows, the person needs to find a specific bookmark quickly.
They search by keyword and/or filter by a tag they assigned when saving.

**Why this priority**: Valuable once a user has many bookmarks, but not needed
for a small collection, so it comes after the core save/browse/manage stories.

**Independent Test**: With many bookmarks saved, search for a keyword and
confirm only matching bookmarks are shown; filter by a tag and confirm the same.

**Acceptance Scenarios**:

1. **Given** many saved bookmarks, **When** the user types a keyword, **Then**
   the list narrows to bookmarks whose title, address, or tag matches.
2. **Given** bookmarks with assigned tags, **When** the user selects a tag,
   **Then** only bookmarks carrying that tag are shown.
3. **Given** an active search or filter with no matches, **When** results are
   empty, **Then** the app shows a clear "no matches" state and a way to clear
   the search.

---

### Edge Cases

- **Duplicate address**: If the user saves an address that already exists, the
  app warns them and lets them keep or discard the duplicate rather than failing
  silently.
- **Very long titles/addresses**: The list stays readable by truncating display
  while preserving the full stored value.
- **Address without a scheme** (e.g. `example.com`): The app normalizes it to a
  usable web address rather than rejecting it.
- **Non-web schemes / unsafe input**: The app only accepts standard web
  addresses (http/https) and rejects other schemes.
- **Large collection**: The list remains responsive with hundreds of bookmarks.
- **Concurrent edits in two tabs**: The most recent saved change wins;
  no bookmark is corrupted.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to save a bookmark consisting of a web
  address and an optional title.
- **FR-002**: System MUST validate that the address is a well-formed web
  (http/https) address before saving, and reject empty or invalid input with a
  clear explanation.
- **FR-003**: System MUST normalize an address that omits a scheme to a usable
  http/https address.
- **FR-004**: System MUST assign a sensible display label when no title is
  provided (e.g. the address itself).
- **FR-005**: System MUST persist bookmarks so they remain available after the
  app is closed and reopened.
- **FR-006**: System MUST display all saved bookmarks in a list showing at least
  the title and address.
- **FR-007**: Users MUST be able to open a bookmark's original page in a new
  browser tab from the list.
- **FR-008**: System MUST present a friendly empty state when no bookmarks exist.
- **FR-009**: Users MUST be able to edit the title, address, and tags of an
  existing bookmark, with the same validation as creation.
- **FR-010**: Users MUST be able to delete a bookmark, with a confirmation step
  before removal.
- **FR-011**: Users MUST be able to assign zero or more free-text tags to a
  bookmark when creating or editing it.
- **FR-012**: Users MUST be able to search bookmarks by keyword matching against
  title, address, and tags.
- **FR-013**: Users MUST be able to filter the list to bookmarks carrying a
  selected tag.
- **FR-014**: System MUST warn the user when saving an address that duplicates an
  existing bookmark, and let them proceed or cancel.
- **FR-015**: System MUST record the date/time each bookmark was saved and
  display the list in a predictable order (most recently saved first by default).

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved reference to a web page. Attributes: web address
  (required), title/display label, zero or more tags, creation timestamp, last
  updated timestamp.
- **Tag**: A short free-text label a user attaches to bookmarks to group and
  filter them. A bookmark may have many tags; a tag may apply to many bookmarks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save their first bookmark within 30 seconds of opening
  the app for the first time, without instructions.
- **SC-002**: Saved bookmarks are still present after closing and reopening the
  app in 100% of cases (no data loss).
- **SC-003**: From the list, a user can locate and open a specific bookmark in
  under 10 seconds when they remember a keyword from its title or address.
- **SC-004**: The bookmark list remains responsive (visibly updates in under 1
  second) with at least 500 saved bookmarks.
- **SC-005**: 95% of first-time users successfully complete the core loop —
  save a bookmark, then find and open it — on their first attempt.

## Assumptions

- **Single user, personal use**: v1 is a personal bookmark manager with no
  accounts, sign-in, or sharing between people. Multi-user accounts are out of
  scope for v1. *(This is the main scope assumption — flag it if you intended a
  shared/multi-user product.)*
- **Web application**: Delivered as a browser-based app the user opens on their
  device; native mobile/desktop apps and browser extensions are out of scope
  for v1.
- **Local persistence is acceptable for v1**: Bookmarks are stored so they
  survive reload for the same user on the same device; cross-device sync is out
  of scope for v1.
- **Manual entry**: Users add bookmarks by entering an address; automatic import
  from a browser and automatic fetching of page titles/thumbnails are out of
  scope for v1 (a fallback label is used instead).
- **Standard web addresses only**: Only http/https addresses are supported.
- **English-language, single-locale UI** for v1.
