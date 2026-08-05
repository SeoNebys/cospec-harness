# Feature Specification: Manage Bookmarks

**Feature Branch**: `001-manage-bookmarks`

**Created**: 2026-07-14

**Status**: Draft (revised after client review)

**Input**: User description: "An app to save and manage bookmarks"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark with details filled in automatically (Priority: P1)

A person pastes a web address into the app. The app goes and fetches the page's name, a short description, and the site's icon on its own, so the saved bookmark is recognizable at a glance instead of being a raw address. The person can adjust the fetched title and description — either before saving or later — but never has to write them from scratch.

**Why this priority**: Saving is the core reason the app exists, and auto-filled details are what make saving feel finished rather than leaving a wall of raw links. This is the heart of the MVP.

**Independent Test**: Paste a valid web address, save it, and confirm the bookmark appears with an auto-fetched title, description, and site icon, and that it persists after closing and reopening the app.

**Acceptance Scenarios**:

1. **Given** an empty collection, **When** the user pastes a valid web address and saves, **Then** the app fetches and stores the page's title, a short description, and the site icon, and the bookmark appears showing all of them.
2. **Given** the auto-fetched title or description is wrong, **When** the user edits it before saving, **Then** the edited text is saved instead of the fetched text.
3. **Given** a saved bookmark, **When** the user later edits its title or description, **Then** the updated text is shown and persisted.
4. **Given** the app cannot fetch page details (e.g. the page is unreachable or has none), **When** the user saves, **Then** the bookmark is still saved with a sensible fallback label (the address or site name) and the user can fill in the details manually.
5. **Given** the user enters text that is not a valid web address, **When** they try to save, **Then** the app rejects the entry and explains what a valid address looks like.

---

### User Story 2 - Browse and open saved bookmarks (Priority: P1)

A person opens the app to see everything they have saved — each entry showing its title, description, and site icon — and clicks a bookmark to open the page in their browser.

**Why this priority**: A saved bookmark is only useful if it can be found and reopened. Browsing and opening, together with saving, form the minimum viable product.

**Independent Test**: With several bookmarks already saved, view the collection and activate one; confirm the correct page opens in the browser.

**Acceptance Scenarios**:

1. **Given** several saved bookmarks, **When** the user opens the app, **Then** all active bookmarks are listed with their titles, descriptions, and site icons.
2. **Given** the list of bookmarks, **When** the user activates one, **Then** the corresponding page opens in the default browser.
3. **Given** an empty collection, **When** the user opens the app, **Then** a clear empty state invites them to add their first bookmark.

---

### User Story 3 - Annotate, edit, set aside, and delete bookmarks (Priority: P2)

A person adds their own private note to a bookmark explaining why they saved it, corrects a title or address, sets a bookmark aside out of the main list without losing it, and permanently deletes ones they truly no longer want.

**Why this priority**: Management is explicitly part of the request and keeps the collection accurate and uncluttered, but it builds on top of the core save/browse capability.

**Independent Test**: Add a note to a bookmark and confirm it persists; edit a title and confirm the change sticks; archive a bookmark and confirm it leaves the main list but can be restored; delete a bookmark and confirm it is gone for good after reopening.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user writes a personal note on it and saves, **Then** the note is stored and shown when viewing that bookmark.
2. **Given** an existing bookmark, **When** the user edits its title or address and saves, **Then** the updated values are shown and persisted.
3. **Given** an existing bookmark, **When** the user archives ("sets aside") it, **Then** it is removed from the main list but kept, and appears in a separate archived view from which it can be restored to the main list.
4. **Given** an existing bookmark, **When** the user deletes it and confirms, **Then** it is permanently removed and does not reappear after reopening; the app guards against accidental one-tap deletion.

---

### User Story 4 - Find and organize bookmarks (Priority: P2)

A person with a growing collection searches by keyword and applies tags to group related bookmarks, so they can locate the right link quickly. Search looks inside everything — title, description, personal notes, tags, and address — and ignores capitalization.

**Why this priority**: The client expects to accumulate a large number of links, so finding them matters from the start rather than being a later enhancement. It is included in v1 and prioritized just below the core save/browse loop.

**Independent Test**: Save several bookmarks, tag some and add notes to others, then search by a keyword that appears only in a note or description and confirm the bookmark is found; click a tag and confirm only bookmarks carrying that tag are shown.

**Acceptance Scenarios**:

1. **Given** many saved bookmarks, **When** the user types a keyword, **Then** only bookmarks whose title, description, personal note, tags, or address contain that keyword are shown, regardless of letter case.
2. **Given** bookmarks with tags, **When** the user clicks a tag, **Then** only bookmarks carrying that tag are shown.
3. **Given** a search or filter with no matches, **When** results are computed, **Then** a clear "no results" state is shown with an easy way to clear the search.

---

### User Story 5 - Triage as "read later" and arrange the list (Priority: P3)

A person marks bookmarks they intend to read later, filters the list down to just those still unread, and chooses how the list is ordered (for example newest first or alphabetically by title).

**Why this priority**: These conveniences meaningfully improve day-to-day use but are not required to prove the core value, so they are layered on last within v1.

**Independent Test**: Mark some bookmarks "read later", filter to show only unread ones and confirm only those appear; change the sort order and confirm the list reorders accordingly.

**Acceptance Scenarios**:

1. **Given** saved bookmarks, **When** the user marks one as "read later", **Then** it is flagged unread and appears when filtering to unread items.
2. **Given** a bookmark marked unread, **When** the user marks it read, **Then** it no longer appears in the unread filter.
3. **Given** the collection, **When** the user chooses a sort order (e.g. newest first, oldest first, or by title), **Then** the list reorders accordingly and remembers the choice for the next visit.

---

### Edge Cases

- **Invalid or malformed address**: Entry is rejected with guidance rather than saved silently.
- **Duplicate address**: When the user saves an address that already exists, the app does **not** create a second copy and does **not** offer "save anyway". Instead it quietly takes the user to the existing bookmark so they can update it. There is never more than one bookmark per address.
- **Page details cannot be fetched**: Saving still succeeds with a fallback label; the user may fill in title/description manually.
- **Slow metadata fetch**: Fetching page details must not block or freeze the app; the bookmark can be saved while details arrive or fall back gracefully.
- **Very long titles, descriptions, or addresses**: Displayed in a truncated but recoverable form so the layout is not broken.
- **Large collection**: The list, search, and filters remain responsive with thousands of bookmarks.
- **Empty collection / empty archive / no unread items**: A helpful empty state is shown instead of a blank screen.
- **Missing title**: A fallback label is derived so no bookmark is ever unlabeled.
- **Archived vs. deleted**: Archiving is reversible (restore); deleting is permanent. The two are clearly distinct actions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to save a bookmark from a web address.
- **FR-002**: System MUST validate that the address is a well-formed web address before saving and reject invalid entries with an explanatory message.
- **FR-003**: On saving, System MUST automatically fetch and store the page's title, a short description, and the site's icon (favicon) for the address.
- **FR-004**: System MUST allow users to edit the auto-fetched title and description both before saving and at any time afterward, storing the user's text in place of the fetched text.
- **FR-005**: When page details cannot be fetched, System MUST still save the bookmark with a sensible fallback label and allow the user to enter the details manually.
- **FR-006**: Metadata fetching MUST NOT block or freeze the app; the interface stays responsive while details are retrieved.
- **FR-007**: System MUST persist all bookmarks and their details so they remain available after the app is closed and reopened.
- **FR-008**: Users MUST be able to view all active (non-archived) bookmarks in a single collection showing each bookmark's title, description, and site icon.
- **FR-009**: Users MUST be able to open a saved bookmark's page in the default browser from within the app.
- **FR-010**: Users MUST be able to edit the title and address of an existing bookmark, with changes persisted.
- **FR-011**: Users MUST be able to attach a personal, private note to a bookmark and read it back later.
- **FR-012**: Users MUST be able to permanently delete a bookmark, with a confirmation step to prevent accidental removal.
- **FR-013**: Users MUST be able to archive ("set aside") a bookmark so it leaves the main list without being deleted, view archived bookmarks separately, and restore an archived bookmark to the main list.
- **FR-014**: When a user saves an address that already exists in the collection, System MUST NOT create a duplicate and MUST instead take the user to the existing bookmark for editing. Exactly one bookmark may exist per address.
- **FR-015**: Users MUST be able to search bookmarks by keyword, matching against title, description, personal note, tags, and address, ignoring letter case.
- **FR-016**: Users MUST be able to assign one or more tags to a bookmark and filter the collection to a chosen tag by clicking it.
- **FR-017**: Users MUST be able to mark a bookmark as "read later" (unread) and later mark it read, and filter the collection to show only unread bookmarks.
- **FR-018**: Users MUST be able to choose the sort order of the collection (at minimum: newest first, oldest first, and by title), and the choice MUST be remembered for the next visit.
- **FR-019**: System MUST present a clear empty state when the collection, the archived view, a search result, or the unread filter contains no bookmarks.
- **FR-020**: System MUST record when each bookmark was saved and last modified so the collection can be ordered by recency.
- **FR-021**: System MUST keep the collection view, search, and filters responsive as the number of bookmarks grows.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved reference to a web page. Attributes: web address (unique across the collection), title (auto-fetched, user-editable, with fallback), short description (auto-fetched, user-editable), site icon (favicon), personal note (user-written), tags, read/unread state, archived/active state, date saved, and date last modified.
- **Tag**: A short user-defined keyword used to group bookmarks. A bookmark may have many tags; a tag may apply to many bookmarks; clicking a tag filters the collection to it.
- **Collection**: The complete set of the single user's bookmarks. Bookmarks within it are either active (shown in the main list) or archived (shown in the separate archived view). Browsing, search, filtering, and sorting operate over this set.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark (with details auto-filled) in under 15 seconds from opening the app, without typing a title.
- **SC-002**: For at least 90% of common public web pages, the auto-fetched title, description, and icon are populated without the user editing them.
- **SC-003**: A user can locate a specific bookmark in a collection of 500+ items in under 10 seconds using search, tags, or the unread filter.
- **SC-004**: Search finds a bookmark by a keyword that appears only in its note or description, regardless of capitalization, on the first attempt.
- **SC-005**: 95% of users successfully save and reopen a bookmark on their first attempt without external help.
- **SC-006**: Saved bookmarks and their details persist across 100% of app restarts with no data loss.
- **SC-007**: The collection view, search, and filters remain responsive (results appear near-instantly) with at least 1,000 saved bookmarks.
- **SC-008**: No bookmark is ever displayed without an identifiable label, and no two active or archived bookmarks share the same address.

## Assumptions

- **Single user, single device, no accounts, no sync** *(confirmed by client)*: The app serves one person managing their own private collection on their own device. There is no sign-in, no multi-user support, and no cross-device synchronization.
- **Bookmarks are web pages**: The app bookmarks web pages (http/https addresses); bookmarking non-web resources (files, local notes) is out of scope for v1.
- **Opening a bookmark** hands the address to the user's default browser rather than rendering the page in-app.
- **Auto-fetched metadata is best-effort**: Title, description, and icon are retrieved from the target page's own published information; when unavailable, the app falls back gracefully. Deep enrichment such as full-page previews or screenshots is out of scope for v1.
- **Reasonable defaults** apply for error handling (friendly messages), title fallback (address or site name), and data retention (bookmarks kept until the user deletes them).
- **Import/export** of bookmarks from/to browsers is out of scope for v1 (may be a future enhancement).
