# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-24

**Status**: Draft

**Input**: User description: "I want to build an app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A person finds a web page they want to return to later and saves it to the app by
providing its address, so it is kept in one place instead of being lost in browser
history or open tabs.

**Why this priority**: Saving is the core reason the app exists. Without it there is
nothing to manage. This single capability already delivers value on its own.

**Independent Test**: Can be fully tested by adding a bookmark with a web address and
confirming it appears in the saved list and persists after the app is reloaded.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user submits a valid web address, **Then** a new bookmark is created and shown in the list.
2. **Given** the user submits an address without a title, **When** the bookmark is saved, **Then** the system derives a readable title (for example from the address) so the entry is not blank.
3. **Given** the user submits an entry that is not a valid web address, **When** they try to save, **Then** the system rejects it and explains what is wrong without losing what they typed.

---

### User Story 2 - Browse, search, and open bookmarks (Priority: P1)

A person opens the app to find a page they saved earlier, scans or searches their
collection, and opens the chosen bookmark in their browser.

**Why this priority**: A saved bookmark has no value unless it can be found and reopened.
Together with Story 1 this forms the minimum viable product.

**Independent Test**: Can be tested by seeding several bookmarks, searching by a keyword,
and confirming the matching bookmark is shown and opens the correct address.

**Acceptance Scenarios**:

1. **Given** several saved bookmarks, **When** the user opens the app, **Then** all bookmarks are listed with their title and address.
2. **Given** several saved bookmarks, **When** the user types a keyword into search, **Then** only bookmarks whose title, address, or tags match the keyword are shown.
3. **Given** a bookmark in the list, **When** the user activates it, **Then** its web address opens in a new browser tab.
4. **Given** a search that matches nothing, **When** results are shown, **Then** the user sees a clear "no results" message rather than an empty screen.

---

### User Story 3 - Edit and delete bookmarks (Priority: P2)

A person keeps their collection tidy by correcting a title, fixing an address, or
removing bookmarks they no longer need.

**Why this priority**: Managing (not just saving) is explicitly requested. It matters for
long-term usefulness but the app is already usable without it.

**Independent Test**: Can be tested by editing an existing bookmark's title and confirming
the change persists, then deleting a bookmark and confirming it is removed.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user edits its title or address and saves, **Then** the updated values are shown and persist after reload.
2. **Given** an existing bookmark, **When** the user deletes it, **Then** it is removed from the list and does not reappear after reload.
3. **Given** a delete action, **When** the user triggers it, **Then** the system asks for confirmation before permanently removing the bookmark.

---

### User Story 4 - Organize with tags (Priority: P3)

A person with a growing collection labels bookmarks with tags (such as "work" or
"recipes") and filters the list by a tag to focus on one topic.

**Why this priority**: Organization improves usefulness at scale but is not required for a
functional first release.

**Independent Test**: Can be tested by assigning a tag to two bookmarks, filtering by that
tag, and confirming only those two are shown.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user adds one or more tags, **Then** the tags are saved and displayed with the bookmark.
2. **Given** bookmarks with different tags, **When** the user filters by a tag, **Then** only bookmarks carrying that tag are shown.

---

### Edge Cases

- **Duplicate address**: When the user saves an address that already exists, the system warns that it is already bookmarked rather than silently creating a duplicate.
- **Very long titles or addresses**: The list stays readable by truncating overly long text while keeping the full value available.
- **Missing scheme**: When the user enters an address without a scheme (e.g. `example.com`), the system accepts it and normalizes it to a usable web address.
- **Empty collection**: A first-time user with no bookmarks sees a helpful empty state that explains how to add their first bookmark.
- **Unreachable page**: The app stores and opens whatever address was saved; it does not guarantee the destination is still live.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to save a bookmark consisting of a web address and an optional title.
- **FR-002**: System MUST validate that the submitted address is a well-formed web address and reject invalid entries with a clear message.
- **FR-003**: System MUST derive a readable title from the address when the user does not provide one.
- **FR-004**: System MUST persist saved bookmarks so they remain available after the app is closed and reopened.
- **FR-005**: System MUST display all saved bookmarks in a list showing at least the title and address.
- **FR-006**: Users MUST be able to search bookmarks by keyword, matching against title, address, and tags.
- **FR-007**: Users MUST be able to open a bookmark's address in a new browser tab.
- **FR-008**: Users MUST be able to edit the title, address, and tags of an existing bookmark.
- **FR-009**: Users MUST be able to delete a bookmark, with a confirmation step before permanent removal.
- **FR-010**: Users MUST be able to assign zero or more tags to a bookmark and filter the list by a tag.
- **FR-011**: System MUST warn the user when saving an address that duplicates an existing bookmark.
- **FR-012**: System MUST show a clear empty state when no bookmarks exist and a clear "no results" state when a search or filter matches nothing.
- **FR-013**: System MUST record the date each bookmark was saved and present bookmarks in a consistent, predictable order (most recently saved first by default).

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved web reference. Key attributes: web address, title, optional description/note, date saved, date last modified, and its set of tags.
- **Tag**: A short user-defined label used to group bookmarks. A bookmark may have many tags, and a tag may apply to many bookmarks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark in under 15 seconds from opening the app.
- **SC-002**: A user can locate a specific bookmark among at least 100 saved entries in under 10 seconds using search or filter.
- **SC-003**: 95% of first-time users successfully save and reopen a bookmark without external help.
- **SC-004**: Saved bookmarks are retained across 100% of app restarts with no data loss.
- **SC-005**: Search and filter results appear to the user without a noticeable wait (perceived as instant) for collections up to 1,000 bookmarks.

## Assumptions

- **Single user, personal use**: The app serves one user's personal collection in the review environment; multi-user accounts and sign-in are out of scope for v1 (see open question Q1).
- **Web application**: Delivered as a browser-based app reviewed at the provided runtime address; native mobile/desktop apps are out of scope for v1.
- **Local persistence**: Bookmarks are stored by the application's own persistence layer; syncing across multiple devices or browsers is out of scope for v1.
- **Manual entry**: Bookmarks are added by entering an address; browser-extension capture, bulk import/export, and automatic metadata fetching from the live page are out of scope for v1.
- **English-language UI**: A single-language interface is sufficient for v1.
