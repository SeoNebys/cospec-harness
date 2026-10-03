# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-25

**Status**: Draft

**Input**: User description: "An app to save and manage bookmarks"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark with auto-collected details (Priority: P1)

A user finds a web page they want to keep and saves it by entering its address.
The app automatically collects the page's details — title, description, and
favicon — so the user does not have to type them, then lets the user review and
edit those details before or after saving.

**Why this priority**: Saving is the core reason the app exists. Without it, no
other feature has anything to act on. This slice alone delivers value: a user
can capture links they care about in one place with meaningful labels captured
for them automatically.

**Independent Test**: Can be fully tested by adding a bookmark with an address,
confirming the fetched title/description/favicon appear, that they can be
edited, and that the bookmark persists after reloading.

**Acceptance Scenarios**:

1. **Given** an empty list, **When** the user submits a valid web address,
   **Then** the app fetches the page's title, description, and favicon and saves
   the bookmark showing those details.
2. **Given** a saved bookmark with auto-collected details, **When** the user
   edits the title or description, **Then** the edited values are kept instead of
   the fetched ones and persist after reload.
3. **Given** the app cannot reach the page or find its details, **When** the user
   saves, **Then** the bookmark is still saved using the address (or its host) as
   the title, and the user can add details manually.
4. **Given** the user submits an entry with no address, **When** they try to
   save, **Then** the app rejects it with a clear message and saves nothing.

---

### User Story 2 - Browse and open saved bookmarks (Priority: P1)

A user opens the app to see everything they have saved and clicks a bookmark to
open the original page in their browser.

**Why this priority**: Saved links are only useful if they can be found and
reopened. Together with Story 1 this forms the minimum viable product.

**Independent Test**: Can be tested by viewing a list of previously saved
bookmarks and confirming each opens its target address in a new browser tab.

**Acceptance Scenarios**:

1. **Given** several saved bookmarks, **When** the user opens the app, **Then**
   all bookmarks are listed with their titles, addresses, favicons, and tags.
2. **Given** a listed bookmark, **When** the user activates it, **Then** the
   target page opens in a new browser tab.
3. **Given** no bookmarks exist, **When** the user opens the app, **Then** a
   friendly empty state invites them to add their first bookmark.

---

### User Story 3 - Organize bookmarks with tags (Priority: P2)

A user assigns one or more tags to a bookmark to organize their collection, and
filters the list to show only bookmarks carrying a chosen tag. When tagging, the
user can pick from tags they have used before or create a new one.

**Why this priority**: Tags are the user's primary way to organize and later
narrow down a growing collection. Important for management, but the app is
already usable for capturing and reopening links without them.

**Independent Test**: Can be tested by adding a tag to a bookmark, confirming it
is offered as an existing tag on another bookmark, and filtering the list by that
tag to show only matching bookmarks.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user adds one or more tags and saves,
   **Then** those tags are shown on the bookmark and persist after reload.
2. **Given** tags already used on other bookmarks, **When** the user tags a
   bookmark, **Then** existing tags are offered for selection and a new tag can
   also be created.
3. **Given** bookmarks with various tags, **When** the user filters by a tag,
   **Then** only bookmarks carrying that tag are shown.
4. **Given** a tag filter is active, **When** the user clears the filter, **Then**
   all bookmarks are shown again.

---

### User Story 4 - Edit and delete bookmarks (Priority: P2)

A user corrects a title or address on an existing bookmark, or removes a
bookmark they no longer need.

**Why this priority**: Keeping the collection accurate and uncluttered is
important for "managing" bookmarks, but the app is already useful without it.

**Independent Test**: Can be tested by changing a saved bookmark's title and
confirming the change persists, and by deleting a bookmark and confirming it
no longer appears.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user edits its title, description,
   address, or tags and saves, **Then** the updated values are shown and persist
   after reload.
2. **Given** a saved bookmark, **When** the user deletes it and confirms,
   **Then** it is removed from the list permanently.
3. **Given** a delete action, **When** it is triggered, **Then** the user is
   asked to confirm before the bookmark is removed.

---

### User Story 5 - Find bookmarks (Priority: P3)

A user with many saved bookmarks searches or filters to quickly locate a
specific one.

**Why this priority**: Valuable as a collection grows, but not needed for a
small collection or an initial release.

**Independent Test**: Can be tested by entering a search term and confirming
only matching bookmarks remain visible.

**Acceptance Scenarios**:

1. **Given** many bookmarks, **When** the user types a search term, **Then**
   only bookmarks whose title, description, address, or tags match are shown.
2. **Given** a search with no matches, **When** results are shown, **Then** a
   clear "no results" message is displayed.
3. **Given** an active tag filter, **When** the user also types a search term,
   **Then** results are narrowed by both the tag and the search term.

---

### Edge Cases

- What happens when the user submits an address without a scheme (e.g.
  `example.com`)? The app assumes `https://` and saves a usable link.
- What happens when the user submits a malformed address? The app rejects it
  with a clear validation message.
- What happens when the user saves an address that already exists? The app does
  not create a duplicate; it takes the user to the existing bookmark instead.
- How does the system handle a very long title or address? It stores it and
  displays it without breaking the layout (truncated with full value available).
- What happens when the underlying page no longer exists? The bookmark still
  opens; the app does not guarantee link liveness.
- What happens when page details cannot be fetched (page unreachable, slow, or
  missing metadata)? Saving still succeeds; missing fields fall back to the
  address/host and can be filled in manually.
- What happens when a favicon cannot be retrieved? A neutral placeholder icon is
  shown and the bookmark is otherwise unaffected.
- What counts as the "same" tag? Tag matching is case-insensitive and ignores
  surrounding whitespace so the same tag is not stored twice under different
  casing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to save a bookmark by providing a web
  address.
- **FR-002**: System MUST validate that a submitted address is a well-formed web
  link before saving, and reject invalid entries with a clear message.
- **FR-003**: System MUST assume an `https://` scheme when the user omits one.
- **FR-004**: On save, System MUST attempt to automatically collect the target
  page's details — at minimum its title, description, and favicon — and populate
  the bookmark with them.
- **FR-005**: System MUST allow the user to review and edit the collected title
  and description (and provide/replace the favicon where applicable) both at save
  time and later; user edits MUST take precedence over auto-collected values.
- **FR-006**: When a title cannot be collected and none is provided, System MUST
  display the address (or its host) as the bookmark's label.
- **FR-007**: When page details cannot be collected, System MUST still save the
  bookmark and allow the user to add the missing details manually.
- **FR-008**: System MUST display all saved bookmarks in a list showing title,
  address, favicon, and tags.
- **FR-009**: Users MUST be able to open a bookmark's target address in a new
  browser tab.
- **FR-010**: Users MUST be able to edit the title, description, address, and
  tags of an existing bookmark.
- **FR-011**: Users MUST be able to delete a bookmark, with a confirmation step
  before removal.
- **FR-012**: System MUST persist bookmarks and their tags so they remain
  available after the app is closed and reopened.
- **FR-013**: System MUST record when each bookmark was created and order the
  list with the most recently added first by default.
- **FR-014**: Users MUST be able to assign one or more tags to a bookmark, choose
  from previously used tags, and create new tags.
- **FR-015**: System MUST treat tags case-insensitively and trim surrounding
  whitespace so the same tag is not duplicated under different casing.
- **FR-016**: Users MUST be able to filter the list to show only bookmarks
  carrying a chosen tag, and to clear that filter.
- **FR-017**: Users MUST be able to search bookmarks by title, description,
  address, or tag, combinable with an active tag filter.
- **FR-018**: System MUST show a friendly empty state when no bookmarks exist and
  a "no results" state when a search or filter matches nothing.
- **FR-019**: When the user saves an address that matches an existing bookmark,
  System MUST NOT create a duplicate and MUST take the user to the existing
  bookmark instead.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved link. Key attributes: web address (required, unique),
  title, description, favicon, creation timestamp, last-updated timestamp, and a
  set of associated tags. Title/description/favicon may be auto-collected or
  user-edited.
- **Tag**: A short, user-defined label used to organize bookmarks. Identified
  case-insensitively by its trimmed name. A bookmark may carry many tags; a tag
  may apply to many bookmarks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark in under 15 seconds from opening
  the app.
- **SC-002**: 95% of first-time users successfully save and reopen a bookmark
  without external guidance.
- **SC-003**: Saved bookmarks persist across app restarts with zero data loss in
  normal use.
- **SC-004**: A user can locate a specific bookmark in a collection of 200 in
  under 5 seconds using search or a tag filter.
- **SC-005**: The bookmark list is visible within 2 seconds of opening the app.
- **SC-006**: For reachable pages, auto-collected details are presented to the
  user within 5 seconds of saving in at least 90% of cases; when collection
  fails or is slow, saving is never blocked.

## Assumptions

- Single-user, single-device use for the initial release; multi-user accounts,
  authentication, and cross-device sync are out of scope for v1.
- Bookmarks are for web (http/https) addresses only.
- The app is a web application accessed through a modern browser.
- The app automatically collects page details (title, description, favicon) when
  a bookmark is saved; collection is best-effort and never blocks saving.
- Tags are in scope for v1; folders/nested categories are out of scope.
- Import/export of bookmarks and browser integration (extensions) are out of
  scope for v1.
- Only the current standard/rendered page metadata is collected; the app does not
  execute site-specific logins or bypass paywalls to read details.
