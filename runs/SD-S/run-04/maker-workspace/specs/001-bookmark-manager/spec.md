# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "An app to save and manage bookmarks"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark with automatic details (Priority: P1)

A user wants to save a web link so they can find it again later. They paste the
link's address and the app automatically pulls in the page's title and a short
preview (a description snippet and, where available, a thumbnail image) so the
user does not have to type them. The user may optionally add a note or adjust the
fetched title before storing it in their collection.

**Why this priority**: Saving links is the core purpose of the app, and pulling in
the title and preview automatically is what makes capture effortless — it is the
key differentiator the client asked for. This is the smallest slice that delivers
usefulness on its own.

**Independent Test**: Can be fully tested by pasting a link, confirming the app
populates the title and preview on its own, and confirming the bookmark then
appears in the saved collection — delivering the value of "capture a link for
later with zero typing."

**Acceptance Scenarios**:

1. **Given** an empty collection, **When** the user pastes a valid, reachable link, **Then** the app fetches and displays the page's title and preview, and on save the bookmark appears in the collection with that fetched title.
2. **Given** the app has fetched a title, **When** the user edits the title before saving, **Then** the bookmark is stored with the user's edited title rather than the fetched one.
3. **Given** a valid link whose page cannot be reached or offers no title, **When** the fetch fails or returns nothing, **Then** the app still lets the user save the bookmark, falling back to a label such as the link's address and allowing the user to type a title manually.
4. **Given** the user enters something that is not a valid link, **When** they attempt to save, **Then** the app rejects it with a clear message and nothing is added.

---

### User Story 2 - Browse and find saved bookmarks (Priority: P2)

A user with a growing collection wants to locate a specific saved link quickly,
either by scanning the list or by searching for a word in its title, address, or
note.

**Why this priority**: Saving links is only useful if they can be retrieved. Once
a collection grows past a handful of items, browsing and search become essential
to the app's value.

**Independent Test**: Can be tested by populating a collection, then searching for
a known term and confirming only matching bookmarks are shown.

**Acceptance Scenarios**:

1. **Given** a collection of saved links, **When** the user opens the app, **Then** the saved links are listed, most recently added first.
2. **Given** a collection of saved links, **When** the user searches for a word that appears in one link's title, **Then** only bookmarks matching that word are shown.
3. **Given** a search that matches nothing, **When** the search completes, **Then** the app shows a clear "no results" message rather than an empty screen with no explanation.

---

### User Story 3 - Organize bookmarks with tags (Priority: P3)

A user wants to group related links so they can view all bookmarks belonging to a
topic together (for example "recipes" or "work").

**Why this priority**: Organization improves usefulness at scale but is not
required to capture or retrieve links. It builds on the first two stories.

**Independent Test**: Can be tested by assigning a tag to several bookmarks, then
filtering by that tag and confirming only those bookmarks are shown.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user adds one or more tags to it, **Then** those tags are stored with the bookmark and displayed alongside it.
2. **Given** bookmarks with various tags, **When** the user filters by a specific tag, **Then** only bookmarks carrying that tag are shown.
3. **Given** a bookmark with tags, **When** the user removes a tag, **Then** the bookmark no longer appears when filtering by that tag.

---

### User Story 4 - Edit and delete bookmarks (Priority: P3)

A user wants to correct or update a saved link's details, or remove links they no
longer need, to keep their collection accurate and uncluttered.

**Why this priority**: Maintenance keeps the collection trustworthy over time, but
the app is usable for capture and retrieval before this exists.

**Independent Test**: Can be tested by editing a saved bookmark's title and
confirming the change persists, and by deleting a bookmark and confirming it no
longer appears.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user edits its title or note and saves, **Then** the updated details are shown and persist across app restarts.
2. **Given** a saved bookmark, **When** the user deletes it and confirms, **Then** the bookmark is removed from the collection.
3. **Given** a delete action, **When** the user is asked to confirm, **Then** the bookmark is only removed after explicit confirmation, protecting against accidental loss.

---

### Edge Cases

- **Duplicate links**: If the user saves a link that already exists in the collection, the app warns that it is already saved rather than silently creating a duplicate.
- **Very long titles or notes**: The app stores and displays long text gracefully (truncating in list views with a way to see the full text) rather than breaking the layout.
- **Malformed or unreachable link**: The app validates the format of the address on save; it does not require the link to be currently reachable to save it. If the link is unreachable, automatic title/preview fetching fails gracefully and the user can still save with a manual title and the address as the fallback label.
- **Slow-to-load page**: If fetching the title/preview is slow, the app does not trap the user waiting — they can save immediately, with metadata backfilled when it arrives or left to the fallback.
- **Page with no usable metadata**: If a reachable page offers no title or preview, the app falls back to the address label and lets the user type a title.
- **Empty collection**: A new user with no bookmarks sees a helpful empty state explaining how to add their first bookmark.
- **Deleting a tag in use**: Removing a tag from a bookmark affects only that bookmark; the same tag on other bookmarks is unaffected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to save a bookmark consisting of a web address (required), a title (auto-fetched by default, user-editable), a preview (auto-fetched where available), and a note (optional).
- **FR-002**: System MUST validate that the web address is well-formed before saving and reject malformed addresses with a clear message.
- **FR-003**: System MUST display a fallback label (such as the web address) when a bookmark has no title, so every bookmark is identifiable.
- **FR-014**: System MUST, when the user provides a valid web address, automatically attempt to fetch the page's title and a short preview (description snippet and, where available, a thumbnail image) and present them to the user before saving, without the user having to type them.
- **FR-015**: Users MUST be able to review and edit the auto-fetched title before saving, and their edit MUST take precedence over the fetched value.
- **FR-016**: System MUST handle a failed or empty metadata fetch gracefully — it MUST still allow the bookmark to be saved (falling back to the web address as the label and allowing manual title entry) and MUST NOT block or lose the user's action.
- **FR-017**: System MUST NOT make the user wait indefinitely for metadata; if fetching takes too long, the user MUST still be able to save the bookmark, with metadata filled in when it arrives or left to the fallback if it does not.
- **FR-004**: System MUST persist saved bookmarks so they remain available after the app is closed and reopened.
- **FR-005**: System MUST display saved bookmarks in a list ordered by most recently added first.
- **FR-006**: Users MUST be able to search bookmarks by a term matching the title, web address, or note, and see only matching results.
- **FR-007**: System MUST show a clear "no results" state when a search matches no bookmarks and a helpful empty state when the collection has no bookmarks.
- **FR-008**: Users MUST be able to assign one or more tags to a bookmark and remove tags from a bookmark.
- **FR-009**: Users MUST be able to filter the collection to show only bookmarks carrying a selected tag.
- **FR-010**: Users MUST be able to edit an existing bookmark's title, note, and tags, with changes persisting.
- **FR-011**: Users MUST be able to delete a bookmark, and the system MUST require explicit confirmation before removal.
- **FR-012**: System MUST detect when a user attempts to save a web address already present in the collection and warn them instead of silently creating a duplicate.
- **FR-013**: System MUST record the date and time each bookmark was added, for ordering and display.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved web link. Key attributes: web address (required), title (auto-fetched by default, user-editable), preview (auto-fetched where available — a short description snippet and optional thumbnail image), note (optional), date added, and associated tags. Belongs to the user's single collection.
- **Tag**: A short label used to group bookmarks by topic. A tag may apply to many bookmarks, and a bookmark may carry many tags.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark in under 30 seconds from opening the app.
- **SC-002**: A user can locate a specific bookmark in a collection of 500 items in under 10 seconds using search or tag filtering.
- **SC-003**: Search results appear to the user within 1 second of entering a search term for collections up to 1,000 bookmarks.
- **SC-004**: 95% of first-time users successfully save and then re-find a bookmark without external help.
- **SC-005**: No saved bookmark is lost across app restarts (100% persistence of successfully saved bookmarks).
- **SC-006**: For a reachable page with standard metadata, the app populates the title (and preview when available) automatically for at least 90% of saved bookmarks, so the user rarely needs to type a title.
- **SC-007**: A user can save a bookmark within 5 seconds even when the page's metadata is slow or fails to load — saving is never blocked by fetching.

## Assumptions

- **Single user, personal collection**: The app manages one person's bookmarks. Multi-user accounts, sharing, and collaboration are out of scope for v1.
- **Manual entry**: Bookmarks are added by the user entering a web address. Automatic import from a browser and browser-extension "save this page" capture are out of scope for v1 (candidate future work).
- **Automatic metadata fetching is the default**: When the user provides a valid address, the app fetches the page's title and a short preview (description snippet and, where available, a thumbnail) automatically so the user need not type them. The user can override the fetched title, and saving never depends on the fetch succeeding.
- **Preview scope**: The preview is a lightweight description snippet plus an optional thumbnail image drawn from the page's own metadata; full page archiving or screenshots are out of scope for v1.
- **Link validity**: The app checks address format only; it does not verify that a link is currently reachable. Metadata is fetched once at save time and is not re-fetched automatically if the page changes later (candidate future enhancement).
- **Scale**: The collection is expected to hold on the order of thousands of bookmarks for a single user, not millions.
- **Platform**: Target platform (web, desktop, or mobile) is a technical/implementation decision to be settled at the planning gate; the spec is platform-agnostic.
