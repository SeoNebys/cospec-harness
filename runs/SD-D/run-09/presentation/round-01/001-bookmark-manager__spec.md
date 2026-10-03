# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "I want to build an app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A person finds a web page worth keeping and saves it into the app by entering
its address, so it is stored and retrievable later instead of being lost among
open tabs or browser history.

**Why this priority**: Saving is the core reason the product exists. Without it,
nothing else in the app has any value. It is the smallest slice that delivers a
usable product on its own.

**Independent Test**: Can be fully tested by adding a URL, then confirming the
new bookmark appears in the saved list with a recognizable title and its
address. Delivers value because the person now has a durable, retrievable record
of the page.

**Acceptance Scenarios**:

1. **Given** an empty or populated bookmark list, **When** the person submits a
   valid web address, **Then** a new bookmark is created and shown in the list
   with its address and a title.
2. **Given** the person submits an address with no title provided, **When** the
   bookmark is saved, **Then** the app derives a readable title (e.g. from the
   page or the address) so the entry is recognizable.
3. **Given** the person submits an entry that is not a valid web address,
   **When** they try to save, **Then** the app rejects it with a clear message
   and does not create a bookmark.

---

### User Story 2 - Browse, search, and open bookmarks (Priority: P2)

A person returns to the app to find something they saved earlier. They scan the
list, search by keyword, and click through to open the original page.

**Why this priority**: Retrieval is what turns a pile of saved links into a
useful tool. It is second because it depends on bookmarks existing (P1) but is
essential for the product to be worth using repeatedly.

**Independent Test**: With several bookmarks already saved, type a keyword and
confirm the list narrows to matching entries, then click a bookmark and confirm
it opens the correct original address.

**Acceptance Scenarios**:

1. **Given** multiple saved bookmarks, **When** the person opens the app,
   **Then** all bookmarks are listed with title and address, newest first.
2. **Given** multiple saved bookmarks, **When** the person types a search term,
   **Then** only bookmarks whose title, address, or tags match are shown.
3. **Given** a bookmark in the list, **When** the person activates it, **Then**
   the original page opens in a new browser tab.
4. **Given** a search term with no matches, **When** the results are shown,
   **Then** an explanatory empty-state message is displayed.

---

### User Story 3 - Organize and edit bookmarks (Priority: P3)

A person curates their collection over time: editing a title, adding tags to
group related links, and deleting bookmarks they no longer need.

**Why this priority**: Organization keeps the collection useful as it grows. It
is valuable but not required for the first usable release, so it ranks below
saving and retrieval.

**Independent Test**: Select an existing bookmark, change its title and add a
tag, save, and confirm the changes persist; then delete a bookmark and confirm
it is removed from the list.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the person edits its title, notes,
   or tags and saves, **Then** the updated values are shown and persist across
   reloads.
2. **Given** an existing bookmark, **When** the person deletes it, **Then** it
   is removed from the list and no longer appears in searches.
3. **Given** bookmarks with tags, **When** the person filters by a tag, **Then**
   only bookmarks carrying that tag are shown.
4. **Given** a delete action, **When** it is triggered, **Then** the person is
   asked to confirm before the bookmark is permanently removed.

---

### Edge Cases

- **Duplicate address**: When the same address is saved twice, the app warns
  that it already exists rather than silently creating a duplicate.
- **Very long titles or addresses**: The list truncates display gracefully
  without breaking layout, while preserving the full stored value.
- **Unreachable or invalid page**: Saving still succeeds based on the address;
  the app does not require the page to be live, but title derivation falls back
  to the address when the page cannot be read.
- **Empty state**: A first-time person with no bookmarks sees a friendly prompt
  explaining how to add their first one.
- **Address without scheme**: An address typed without `http(s)://` is accepted
  and normalized so it opens correctly.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a person to create a bookmark by providing a web
  address, with an optional title, notes, and tags.
- **FR-002**: System MUST validate submitted addresses and reject entries that
  are not valid web addresses, with a clear error message.
- **FR-003**: System MUST derive a readable title when none is provided, falling
  back to the address itself if no better title is available.
- **FR-004**: System MUST persist bookmarks so they remain available after the
  app is closed and reopened.
- **FR-005**: System MUST display saved bookmarks in a list showing at least the
  title and address, ordered with the most recently added first.
- **FR-006**: Users MUST be able to search bookmarks by keyword, matching against
  title, address, and tags.
- **FR-007**: Users MUST be able to open a bookmark's original page in a new
  browser tab.
- **FR-008**: Users MUST be able to edit an existing bookmark's title, notes, and
  tags, with changes persisted.
- **FR-009**: Users MUST be able to delete a bookmark, with a confirmation step
  before permanent removal.
- **FR-010**: System MUST support tagging bookmarks and filtering the list by a
  selected tag.
- **FR-011**: System MUST warn when a person attempts to save an address that is
  already bookmarked.
- **FR-012**: System MUST show a friendly empty state when no bookmarks exist and
  when a search or filter returns no matches.
- **FR-013**: System MUST record the date each bookmark was added and display it
  in the list.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved reference to a web page. Attributes: address (URL),
  title, optional notes, one or more optional tags, and the date it was added.
- **Tag**: A short label used to group related bookmarks. A bookmark may carry
  several tags; a tag may apply to many bookmarks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person can save a new bookmark in under 15 seconds from opening
  the add form to seeing it in the list.
- **SC-002**: A person can locate a specific previously saved bookmark among at
  least 100 entries in under 10 seconds using search or tag filtering.
- **SC-003**: 95% of first-time users successfully save and then re-open a
  bookmark without external instructions.
- **SC-004**: Saved bookmarks and edits persist across app restarts with zero
  data loss in normal use.
- **SC-005**: Search and filter results update within 1 second for a collection
  of up to 1,000 bookmarks.

## Assumptions

- **Single-user, personal use for v1**: The app serves one person's private
  collection and does not include multi-user accounts, sharing, or collaboration
  in this release. See open question Q1.
- **Web application**: Delivered as a browser-accessed web app (consistent with
  the project's runtime presentation environment), not a native mobile app or a
  browser extension, for v1.
- **Manual entry**: Bookmarks are added by entering an address in the app;
  automatic capture via a browser button/extension or bulk import from an
  existing browser is out of scope for v1.
- **Title derivation is best-effort**: The app attempts to obtain a page title
  but does not guarantee it for pages that block reading or are offline; it falls
  back to the address.
- **Modern browser**: The person uses a current desktop or mobile web browser
  with JavaScript enabled.
- **Reasonable scale**: The design targets an individual collection on the order
  of thousands of bookmarks, not millions.

## Open Questions

These decisions affect scope and are worth confirming before planning. Sensible
defaults are assumed above so the spec is complete either way.

- **Q1 (scope / access)**: Is v1 a single private collection with no login
  (assumed), or should it support individual user accounts so multiple people
  keep separate collections? This changes whether authentication and per-user
  data isolation are in scope.
- **Q2 (import/capture)**: Is manual entry sufficient for v1 (assumed), or is
  importing existing browser bookmarks / one-click capture a required part of the
  first release?
