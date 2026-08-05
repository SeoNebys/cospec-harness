# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "An app to save and manage bookmarks"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A person finds a web page worth keeping and saves its address into the app so they can return to it later without having to remember or re-find it.

**Why this priority**: Saving links is the core reason the app exists. Without it, nothing else has value. This story alone delivers a usable product: a place to stash links.

**Independent Test**: Enter a web address (and optionally a title), save it, and confirm the bookmark appears in the saved list and reopens the correct page when selected.

**Acceptance Scenarios**:

1. **Given** the app is open, **When** the user enters a valid web address and saves it, **Then** the bookmark is stored and shown in the list with a title.
2. **Given** the user enters an address without a title, **When** they save it, **Then** the app derives a readable title from the page (falling back to the address itself if none is available).
3. **Given** the user enters something that is not a valid web address, **When** they try to save it, **Then** the app rejects the entry and explains what is wrong.

---

### User Story 2 - Browse and open saved bookmarks (Priority: P1)

A person opens the app to review what they have saved and clicks a bookmark to open the original page.

**Why this priority**: A saved link is only useful if it can be found and reopened. Browsing/opening is the other half of the minimum viable product.

**Independent Test**: With several bookmarks already saved, open the app, view the list, and select a bookmark to confirm the original page opens.

**Acceptance Scenarios**:

1. **Given** bookmarks exist, **When** the user opens the app, **Then** all saved bookmarks are listed with their titles and addresses.
2. **Given** the list is shown, **When** the user selects a bookmark, **Then** the original page opens.
3. **Given** no bookmarks exist yet, **When** the user opens the app, **Then** an empty state invites them to save their first bookmark.

---

### User Story 3 - Organize and find bookmarks (Priority: P2)

As the collection grows, a person needs to keep it orderly and locate a specific bookmark quickly by searching or filtering rather than scrolling.

**Why this priority**: Organization and search become essential once the collection grows beyond a screenful, but the app is still useful without them at small scale.

**Independent Test**: With many bookmarks saved, apply a text search and/or a tag filter and confirm only matching bookmarks are shown.

**Acceptance Scenarios**:

1. **Given** many bookmarks exist, **When** the user types a search term, **Then** only bookmarks whose title, address, or tags match are shown.
2. **Given** a bookmark is being saved or edited, **When** the user adds one or more tags, **Then** those tags are stored and can later be used to filter.
3. **Given** tags exist, **When** the user selects a tag, **Then** only bookmarks carrying that tag are shown.

---

### User Story 4 - Edit and delete bookmarks (Priority: P2)

A person corrects a title, updates tags, or removes a bookmark that is no longer relevant.

**Why this priority**: Keeping the collection accurate and free of clutter matters over time, but is secondary to saving, browsing, and finding.

**Independent Test**: Select an existing bookmark, change its title and tags, save, and confirm the changes persist; then delete a bookmark and confirm it disappears.

**Acceptance Scenarios**:

1. **Given** a bookmark exists, **When** the user edits its title, address, or tags and saves, **Then** the updated values are stored and shown.
2. **Given** a bookmark exists, **When** the user deletes it, **Then** it is removed from the list after a confirmation step.
3. **Given** a bookmark was just deleted, **When** the user chooses to undo, **Then** the bookmark is restored.

---

### Edge Cases

- **Duplicate address**: When the user saves an address that already exists, the app warns them and offers to open or update the existing bookmark rather than creating a silent duplicate.
- **Unreachable page**: When a saved page can no longer be reached, opening it still attempts the original address; metadata (title/preview) simply is not refreshed.
- **Very long titles or addresses**: Long values are stored in full but displayed in a truncated, readable form.
- **Large collections**: The list remains responsive and searchable as the number of bookmarks grows into the thousands.
- **No metadata available**: When a title cannot be derived from a page, the address is used as the display title.
- **Malformed or unsupported input**: Non-web input (e.g., blank entries, unsupported address schemes) is rejected with a clear message.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to save a bookmark consisting of at minimum a web address.
- **FR-002**: System MUST validate that a submitted address is a well-formed web address and reject invalid entries with an explanatory message.
- **FR-003**: System MUST derive a human-readable title for a bookmark when one is not provided, falling back to the address if no title can be determined.
- **FR-004**: System MUST allow a user to provide or override the title of a bookmark.
- **FR-005**: System MUST persist saved bookmarks so they remain available across sessions.
- **FR-006**: System MUST display saved bookmarks in a list showing at least the title and address.
- **FR-007**: Users MUST be able to open the original page from a saved bookmark.
- **FR-008**: System MUST present a clear empty state when no bookmarks exist.
- **FR-009**: Users MUST be able to assign zero or more tags to a bookmark.
- **FR-010**: Users MUST be able to search bookmarks by text matching against title, address, and tags.
- **FR-011**: Users MUST be able to filter bookmarks by tag.
- **FR-012**: Users MUST be able to edit an existing bookmark's title, address, and tags.
- **FR-013**: Users MUST be able to delete a bookmark, with a confirmation step before removal.
- **FR-014**: System SHOULD allow a user to undo a recent deletion.
- **FR-015**: System MUST detect when a submitted address already exists and warn the user rather than creating a silent duplicate.
- **FR-016**: System MUST record the date each bookmark was saved and support ordering the list by most recently saved.
- **FR-017**: System MUST keep the list responsive and usable as the collection grows into the thousands of bookmarks.

*Requirements needing clarification:*

- **FR-018**: System MUST scope bookmark data to [NEEDS CLARIFICATION: is this a single-user personal app where all bookmarks belong to one owner on one device, or a multi-user app with individual accounts, sign-in, and per-user private collections? This affects authentication, data privacy, and whether sharing is possible].
- **FR-019**: System MUST be usable on [NEEDS CLARIFICATION: which primary environment — a web app in the browser, a browser extension that saves the current tab, a mobile app, or a desktop app? This shapes how bookmarks are captured and where data lives].

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved reference to a web page. Attributes: web address, title, optional description/notes, set of tags, date saved, date last updated. Relationships: may carry many tags.
- **Tag**: A short user-defined label used to categorize and filter bookmarks. Relationships: applies to many bookmarks.
- **Owner** *(conditional on FR-018)*: The person a collection of bookmarks belongs to. Present only if the app is multi-user.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark in under 15 seconds from opening the save action to seeing it in the list.
- **SC-002**: A user can locate a specific bookmark in a collection of 500+ in under 10 seconds using search or filtering.
- **SC-003**: 95% of first-time users successfully save and reopen a bookmark without external help.
- **SC-004**: Saved bookmarks remain available across sessions with zero data loss under normal use.
- **SC-005**: The bookmark list remains responsive (results appear near-instantly to the user) with at least 2,000 bookmarks stored.
- **SC-006**: Accidental deletions can be recovered by the user in at least 90% of cases (via confirmation and undo).

## Assumptions

- Bookmarks are references to web pages (http/https addresses); saving arbitrary files or non-web resources is out of scope for v1.
- The app automatically attempts to derive a title from the target page when the user does not supply one, and falls back to the address when it cannot.
- Tags are the organizing mechanism for v1; nested folders/hierarchies are out of scope unless requested later.
- Import from and export to existing browser bookmarks is out of scope for v1 (candidate for a later iteration).
- Standard, user-friendly error handling and messaging apply throughout.
- Data retention follows the user's actions: bookmarks persist until the user deletes them.
