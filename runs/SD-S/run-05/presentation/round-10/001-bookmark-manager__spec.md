# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-07-14

**Status**: Draft

**Input**: User description: "An app to save and manage bookmarks"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A person finds a web page they want to return to later. They save it to the app
by providing its address, and the app captures it along with a readable title so
it can be found again.

**Why this priority**: Saving is the core reason the app exists. Without it,
there is nothing to manage. This single story is a usable product on its own.

**Independent Test**: Enter a web address, save it, and confirm the bookmark
appears in the list with a recognizable title and its address.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user saves a valid web address, **Then** a new bookmark appears in the list showing its title and address.
2. **Given** the user is saving a bookmark, **When** they do not supply a title, **Then** the app derives a readable title from the page or its address.
3. **Given** the user enters something that is not a valid web address, **When** they try to save it, **Then** the app rejects the entry and explains what a valid address looks like.

---

### User Story 2 - Browse and find bookmarks (Priority: P1)

A person who has saved many bookmarks wants to locate a specific one quickly by
scanning a list and searching by keyword.

**Why this priority**: A collection that cannot be searched becomes useless as it
grows. Retrieval is as essential as saving for the app to deliver value.

**Independent Test**: With several saved bookmarks, type a keyword and confirm
the list narrows to matching bookmarks; open one and confirm it navigates to the
saved address.

**Acceptance Scenarios**:

1. **Given** several saved bookmarks, **When** the user opens the app, **Then** all bookmarks are listed with their titles, addresses, and save dates.
2. **Given** several saved bookmarks, **When** the user searches for a keyword, **Then** only bookmarks whose title, address, or tags match the keyword are shown.
3. **Given** a bookmark in the list, **When** the user opens it, **Then** the app navigates to the saved web address.
4. **Given** a search that matches nothing, **When** the results are shown, **Then** the app displays a clear "no matches" message rather than an empty screen.

---

### User Story 3 - Organize bookmarks with tags (Priority: P2)

A person with a growing collection wants to group related bookmarks so they can
view everything on a topic together.

**Why this priority**: Organization becomes valuable once a collection grows, but
the app is still useful without it, so it ranks below saving and finding.

**Independent Test**: Assign one or more tags to a bookmark, then filter the list
by a tag and confirm only bookmarks carrying that tag are shown.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user adds one or more tags to it, **Then** those tags are shown with the bookmark and become available as filters.
2. **Given** bookmarks with different tags, **When** the user filters by a tag, **Then** only bookmarks carrying that tag are listed.
3. **Given** a tag applied to several bookmarks, **When** the user renames or removes the tag, **Then** the change is reflected on every affected bookmark.

---

### User Story 4 - Edit and delete bookmarks (Priority: P2)

A person wants to correct a bookmark's details or remove bookmarks they no longer
need so the collection stays accurate and uncluttered.

**Why this priority**: Maintenance keeps the collection trustworthy over time, but
it depends on saving and browsing already existing.

**Independent Test**: Change a saved bookmark's title and tags and confirm the
changes persist; delete a bookmark and confirm it no longer appears.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user edits its title, address, or tags, **Then** the updated details are saved and shown.
2. **Given** a saved bookmark, **When** the user deletes it, **Then** it is removed from the list after a confirmation step.
3. **Given** a bookmark was just deleted, **When** the user chooses to undo, **Then** the bookmark is restored.

---

### Edge Cases

- **Duplicate address**: When the user saves an address that already exists, the app warns that a bookmark for it already exists and offers to open the existing one instead of creating a duplicate.
- **Unreachable page**: When a page's title cannot be retrieved (page is offline or blocks access), the app still saves the bookmark using the address as the title.
- **Very long title or address**: The list displays a truncated form while preserving the full value on the bookmark's detail view.
- **Large collection**: Browsing and searching remain responsive as the collection grows into the thousands.
- **Empty state**: A first-time user with no bookmarks sees guidance on how to save their first one rather than a blank screen.
- **Special characters / non-Latin text** in titles and tags are preserved and searchable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to save a bookmark by supplying a web address, optionally with a title and tags.
- **FR-002**: System MUST validate that a supplied address is a well-formed web address and reject entries that are not, with an explanatory message.
- **FR-003**: System MUST derive a readable title automatically when the user does not supply one.
- **FR-004**: System MUST record the date and time each bookmark was saved.
- **FR-005**: System MUST persist bookmarks so they remain available across sessions and app restarts.
- **FR-006**: Users MUST be able to view all saved bookmarks in a list showing at least title, address, tags, and save date.
- **FR-007**: Users MUST be able to search bookmarks by keyword, matching against title, address, and tags.
- **FR-008**: Users MUST be able to open a bookmark to navigate to its saved address.
- **FR-009**: Users MUST be able to assign, rename, and remove tags on bookmarks.
- **FR-010**: Users MUST be able to filter the list to bookmarks carrying a selected tag.
- **FR-011**: Users MUST be able to edit a saved bookmark's title, address, and tags.
- **FR-012**: Users MUST be able to delete a bookmark, with a confirmation step before removal.
- **FR-013**: System MUST let the user undo a deletion immediately after it occurs.
- **FR-014**: System MUST detect when a user saves an address that already exists and offer to open the existing bookmark instead of creating a duplicate.
- **FR-015**: System MUST show helpful empty-state and no-results guidance instead of blank screens.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved reference to a web page. Attributes: web address, title, optional description/notes, set of tags, save date/time, last-modified date/time.
- **Tag**: A short label used to group bookmarks. Attributes: name. A tag may apply to many bookmarks, and a bookmark may carry many tags.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark in under 15 seconds from opening the app.
- **SC-002**: A user can locate a specific bookmark in a collection of at least 500 in under 10 seconds using search or tag filtering.
- **SC-003**: Search and filter results appear within 1 second for collections of up to 5,000 bookmarks.
- **SC-004**: 95% of first-time users successfully save and re-find a bookmark without external instructions.
- **SC-005**: Saved bookmarks are retained with zero loss across app restarts and normal sessions.
- **SC-006**: No duplicate bookmark for the same address is created without the user being warned first.

## Assumptions

- **Single user, single device (v1)**: The app serves one user's personal collection. Multi-user accounts, sign-in, and syncing across devices are out of scope for v1 (see Q1 at the review gate).
- **Manual entry of addresses**: Users add bookmarks by entering or pasting an address. A browser extension or "share to app" capture flow is out of scope for v1 (see Q2).
- **No importing** of existing browser bookmarks in v1; the collection starts empty.
- **Automatic title retrieval** depends on the target page being reachable; when it is not, the address is used as the title.
- **Data retention**: Bookmarks are kept until the user deletes them; there is no automatic expiry.
- **Standard app performance expectations** apply; no unusual scale or offline-first guarantees beyond those in Success Criteria.
