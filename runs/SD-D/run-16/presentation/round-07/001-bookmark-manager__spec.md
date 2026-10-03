# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-24

**Status**: Draft

**Input**: User description: "Build an app to save and manage bookmarks."

## Clarifications

### Session 2026-09-24

- Q: When saving a "preserved copy" of a page, what form should that copy take? → A: A self-contained offline copy of the full page (HTML with its assets). If the address points to a PDF, preserve the original PDF instead.
- Q: For the "preserve through the Internet Archive" option, what should the app do? → A: Submit the address to the Internet Archive to create a new snapshot, then store the returned archive link on the bookmark.
- Q: When a search has multiple space-separated terms with no explicit operator, how are they combined? → A: AND by default (every term must match); OR/NOT/parentheses/quotes remain available for explicit control.
- Q: When importing a browser bookmark file containing addresses already saved, how are duplicates handled? → A: Skip addresses already in the collection, import only new ones, and report added vs. skipped counts.
- Q: How are formatted notes authored? → A: Written in Markdown and rendered as formatted text when viewed.

### Terminology (canonical terms)

To avoid confusion between similar concepts:

- **Archived bookmark** — a bookmark the user has set aside; hidden from the normal
  list and search but available in a dedicated Archived view and restorable.
  Distinct from deletion.
- **Preserved copy (offline snapshot)** — a self-contained local copy of the page
  stored by the app so the content survives even if the original page changes or
  disappears.
- **Internet Archive snapshot** — an externally hosted snapshot created by
  submitting the address to the Internet Archive; the app stores only the link to
  it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark with its page details (Priority: P1)

A person finds a web page worth keeping and saves it by entering or pasting its
address. The app automatically collects the page's title, description, icon, and
preview image so the saved item is rich and recognizable. The user can adjust the
title and description either while saving or later.

**Why this priority**: Saving is the core purpose. On its own it delivers a usable
product: a place to stash links with meaningful details so they are not lost.

**Independent Test**: Enter a valid web address, save it, and confirm a new
bookmark appears with an automatically captured title, description, icon, and
preview image, and that the title and description can be edited.

**Acceptance Scenarios**:

1. **Given** an empty collection, **When** the user submits a valid web address,
   **Then** a new bookmark is created and its title, description, icon, and preview
   image are collected from the page and displayed.
2. **Given** the user is saving a bookmark, **When** they edit the title or
   description before confirming, **Then** the saved bookmark reflects their edits.
3. **Given** a saved bookmark, **When** the user edits its title or description
   afterwards, **Then** the changes persist across reloads.
4. **Given** the user submits without an address, **When** they try to save,
   **Then** the app rejects the entry and explains that an address is required.
5. **Given** the user submits text that is not a valid web address, **When** they
   try to save, **Then** the app rejects the entry and explains the address is
   invalid.
6. **Given** page details cannot be retrieved automatically, **When** the bookmark
   is saved, **Then** the address is used as a fallback title and the user can edit
   the details.

---

### User Story 2 - Browse, search, and open bookmarks (Priority: P1)

A person returns to retrieve something saved earlier. They see all bookmarks in an
easy-to-read list showing title, description, tags, and icon, and can search with a
flexible query to locate a specific one, then open it in their browser.

**Why this priority**: Saved bookmarks have no value if they cannot be found again.
Rich listing plus powerful search is essential to the "manage" half of the request.

**Independent Test**: With several bookmarks saved, view the list (each row showing
title, description, tags, and icon), run several search queries exercising phrases,
`#tag`, and AND/OR/NOT/parentheses, and confirm only matching bookmarks show and can
be opened.

**Acceptance Scenarios**:

1. **Given** several saved bookmarks, **When** the user opens the app, **Then**
   each bookmark is listed showing its title, description, tags, and icon in a
   readable form.
2. **Given** several bookmarks, **When** the user enters a search term, **Then**
   matching is performed against title, description, note, and address, ignoring
   capitalization, and only matching bookmarks are shown.
3. **Given** a search query, **When** the user wraps text in quotes, **Then** only
   bookmarks containing that exact phrase match.
4. **Given** a search query, **When** the user includes `#tag`, **Then** results are
   restricted to bookmarks carrying that tag.
5. **Given** a search query with multiple space-separated terms and no operator,
   **When** it runs, **Then** all terms must match (AND).
6. **Given** a search query using `OR`, `NOT`, and parentheses, **When** it runs,
   **Then** results honor the boolean logic and grouping as written.
7. **Given** a bookmark in the list, **When** the user opens it, **Then** the target
   page opens in a new browser tab.
8. **Given** a query that matches nothing, **When** results are shown, **Then** a
   clear "no matching bookmarks" message is displayed.
9. **Given** any list or search view, **When** archived bookmarks exist, **Then**
   they are excluded from these results (see User Story 6).

---

### User Story 3 - Organize with tags and tag suggestions (Priority: P2)

A person with a growing collection keeps it tidy with tags. While typing a tag they
see suggestions drawn from tags they already use, and they can filter the list to
show only bookmarks with a chosen tag.

**Why this priority**: Organization becomes valuable as the collection grows and
strongly enhances the "manage" experience, but the app is usable without it.

**Independent Test**: Add tags to a bookmark (seeing existing-tag suggestions while
typing), then filter by a tag and confirm the list narrows to bookmarks carrying it.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user adds one or more tags, **Then** the tags
   are saved and displayed with the bookmark.
2. **Given** the user is typing a tag, **When** the typed text matches existing
   tags, **Then** matching existing tags are suggested for quick selection.
3. **Given** bookmarks with different tags, **When** the user selects a tag filter,
   **Then** only bookmarks carrying that tag are shown.
4. **Given** a bookmark with tags, **When** the user removes a tag, **Then** it no
   longer appears on that bookmark, and it disappears from filters/suggestions if
   unused elsewhere.

---

### User Story 4 - Edit, deduplicate, and delete (Priority: P2)

A person keeps the collection accurate by editing bookmarks and removing ones they
no longer need. If they try to save an address they already have, the app takes them
to the existing bookmark to edit rather than creating a duplicate.

**Why this priority**: Maintenance keeps the collection trustworthy. It rounds out
"manage" but is not needed to prove the core value.

**Independent Test**: Edit a bookmark's fields and confirm they persist; attempt to
save an already-saved address and confirm you land on the existing bookmark's edit
view; delete a bookmark and confirm it is gone after reload.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user edits its title, address,
   description, note, or tags and saves, **Then** the updated values persist across
   reloads.
2. **Given** an address already saved, **When** the user tries to save it again,
   **Then** the app opens the existing bookmark for editing instead of creating a
   duplicate or only showing a warning.
3. **Given** an existing bookmark, **When** the user deletes it and confirms,
   **Then** it is permanently removed and does not reappear after reload.
4. **Given** the user requests deletion, **When** the action would permanently
   remove the bookmark, **Then** the app asks for confirmation first.

---

### User Story 5 - Read later and unread tracking (Priority: P2)

A person marks items to read later and works through them, viewing a dedicated
unread list and marking items read as they go.

**Why this priority**: A read-later workflow is a primary way the user intends to
manage bookmarks, distinct from long-term reference storage.

**Independent Test**: Mark bookmarks as unread/read, open the unread view, and
confirm it lists only unread items and that marking one read removes it from that
view.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user sets its read-later (unread) state,
   **Then** the state is saved and shown.
2. **Given** unread bookmarks exist, **When** the user opens the unread view,
   **Then** only unread bookmarks are listed.
3. **Given** an unread bookmark, **When** the user marks it read, **Then** it is no
   longer shown in the unread view.
4. **Given** a newly saved bookmark, **When** it is created, **Then** its initial
   read state follows a consistent, documented default (unread).

---

### User Story 6 - Archive and restore (Priority: P3)

A person sets aside bookmarks they no longer want in daily view but do not want to
delete. Archived bookmarks disappear from the normal list and search but remain in a
dedicated Archived view and can be restored.

**Why this priority**: Archiving separates "not now" from "gone forever," reducing
clutter without data loss. Valuable but secondary to core capture and retrieval.

**Independent Test**: Archive a bookmark and confirm it leaves the normal list and
search; open the Archived view and confirm it appears there; restore it and confirm
it returns to the normal list.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user archives it, **Then** it no longer
   appears in the normal list or in normal search/filter results.
2. **Given** archived bookmarks, **When** the user opens the Archived view, **Then**
   only archived bookmarks are listed.
3. **Given** an archived bookmark, **When** the user restores it, **Then** it
   returns to the normal list and search.
4. **Given** archiving and deletion, **When** the user performs either, **Then** they
   are independent actions with distinct outcomes (archive hides; delete removes).

---

### User Story 7 - Bulk actions on many bookmarks (Priority: P3)

A person operating on many items selects several bookmarks — or all bookmarks
matching the current search/filter — and applies one action to all of them: add or
remove tags, change read or archive status, or delete.

**Why this priority**: Bulk operations make managing a large collection efficient.
Important for scale but not required to prove core value.

**Independent Test**: Select multiple bookmarks (and separately "select all matching
current search"), apply a bulk tag change and a bulk status change, and confirm all
selected items updated; perform a bulk delete with confirmation.

**Acceptance Scenarios**:

1. **Given** a list, **When** the user selects several bookmarks, **Then** a bulk
   action applies to exactly those selected.
2. **Given** an active search or filter, **When** the user chooses "select all
   matching," **Then** the action applies to every bookmark matching the current
   query/filter, including those not currently on screen.
3. **Given** a selection, **When** the user bulk-adds or bulk-removes a tag,
   **Then** the change applies to all selected bookmarks.
4. **Given** a selection, **When** the user bulk-changes read or archive status,
   **Then** all selected bookmarks reflect the new status.
5. **Given** a selection, **When** the user bulk-deletes and confirms, **Then** all
   selected bookmarks are permanently removed.

---

### User Story 8 - Sorting and display preferences (Priority: P3)

A person tailors how the list is presented: choosing a sort order (not only newest
first) and setting display preferences such as default sort, number of items shown,
and text size.

**Why this priority**: Presentation control improves daily usability, especially at
scale, but is an enhancement over core functionality.

**Independent Test**: Change the sort order and confirm the list reorders; set
default sort, items-per-page, and text size preferences and confirm they persist and
take effect on reload.

**Acceptance Scenarios**:

1. **Given** a list, **When** the user selects a sort option (e.g., newest, oldest,
   title, recently updated), **Then** the list reorders accordingly.
2. **Given** display preferences, **When** the user sets a default sort order,
   **Then** new sessions open with that order.
3. **Given** display preferences, **When** the user sets the number of items shown,
   **Then** the list honors that count.
4. **Given** display preferences, **When** the user sets a text size, **Then** the
   list text renders at that size, and all preferences persist across reloads.

---

### User Story 9 - Saved searches (Priority: P3)

A person reuses common queries by saving them — including tags that must be present
and tags that must be excluded — and re-running them later with one action.

**Why this priority**: Saved searches speed up recurring workflows on a large
collection. A convenience layered on top of search and tags.

**Independent Test**: Create a saved search combining a text query with included and
excluded tags, run it later, and confirm it returns the same logic's results; edit
and delete a saved search.

**Acceptance Scenarios**:

1. **Given** a search with included and excluded tags, **When** the user saves it,
   **Then** it is stored with a name and can be listed.
2. **Given** a saved search, **When** the user runs it, **Then** results reflect its
   text query, included tags, and excluded tags.
3. **Given** a saved search, **When** the user edits or deletes it, **Then** the
   change persists.

---

### User Story 10 - Import and export (Priority: P3)

A person moves bookmarks in and out using the common browser bookmark file format,
so they can bring in an existing browser collection or back theirs up.

**Why this priority**: Interoperability protects the user's data and eases adoption,
but is not required for the app to be useful on its own.

**Independent Test**: Export the collection to a browser bookmark file; import a
browser bookmark file and confirm new bookmarks are added, existing addresses are
skipped, and added/skipped counts are reported.

**Acceptance Scenarios**:

1. **Given** a collection, **When** the user exports, **Then** a file in the common
   browser bookmark format is produced containing the bookmarks.
2. **Given** a browser bookmark file, **When** the user imports it, **Then**
   addresses not already saved are added.
3. **Given** an import containing addresses already saved, **When** it runs,
   **Then** those are skipped and the app reports how many were added and skipped.

---

### User Story 11 - Preserve page copies (Priority: P3)

A person guards against link rot by preserving a page: the app stores a
self-contained offline copy of the page (or the original PDF when the address is a
PDF), and can additionally submit the address to the Internet Archive and keep the
resulting snapshot link.

**Why this priority**: Preservation protects content long-term. It is the most
involved capability and depends on external factors, so it is valuable but
secondary.

**Independent Test**: Preserve a page and confirm the offline copy can be reopened
later independent of the live page; preserve a PDF address and confirm the original
PDF is stored; trigger Internet Archive preservation and confirm the returned
snapshot link is stored on the bookmark.

**Acceptance Scenarios**:

1. **Given** a bookmark to a web page, **When** the user preserves it, **Then** a
   self-contained offline copy of the full page is stored and can be viewed later.
2. **Given** a bookmark whose address is a PDF, **When** the user preserves it,
   **Then** the original PDF is stored as the preserved copy.
3. **Given** a bookmark, **When** the user chooses Internet Archive preservation,
   **Then** the address is submitted to create a new snapshot and the returned
   archive link is stored on the bookmark.
4. **Given** preservation cannot complete (page or Internet Archive unreachable),
   **When** it fails, **Then** the app reports the failure clearly and the bookmark
   itself remains intact.

---

### User Story 12 - Formatted notes (Priority: P3)

A person adds a note to a bookmark using Markdown and sees it rendered as formatted
text when viewing the bookmark.

**Why this priority**: Rich notes add context and value but are an enhancement to the
basic note field.

**Independent Test**: Add a note using Markdown (headings, bold/italic, lists,
links), view the bookmark, and confirm the note renders as formatted text.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user writes a note in Markdown, **Then** the
   raw Markdown is stored.
2. **Given** a note written in Markdown, **When** the user views the bookmark,
   **Then** the note is rendered as formatted text (headings, emphasis, lists,
   links, quotes, code).

---

### Edge Cases

- **Duplicate address on save**: Saving an existing address opens that bookmark for
  editing rather than creating a duplicate (US4).
- **Duplicate address on import**: Existing addresses are skipped and counted (US10).
- **Missing page details**: When title/description/icon/preview cannot be fetched,
  the address is used as fallback title and the user can fill in the rest.
- **Preservation failure**: A page or Internet Archive that cannot be reached
  produces a clear error without corrupting the bookmark.
- **Invalid or malformed import file**: An unreadable bookmark file is rejected with
  a clear message and no partial corruption of the collection.
- **Archived items in search**: Archived bookmarks are excluded from normal search
  and filters and appear only in the Archived view.
- **Very long titles/descriptions/addresses**: Displayed content truncates
  gracefully; full values remain accessible.
- **Large collection**: List, search, and bulk actions remain responsive at scale
  (see Success Criteria).
- **Empty and no-results states**: A first-time user sees a friendly prompt to add a
  first bookmark; searches/filters with no matches show a clear message.
- **Conflicting search syntax**: A malformed boolean/parenthesis query is handled
  gracefully (clear message or best-effort interpretation) rather than failing
  silently.

## Requirements *(mandatory)*

### Functional Requirements

#### Saving & page details

- **FR-001**: System MUST allow saving a bookmark by providing a web address.
- **FR-002**: System MUST validate the address is well-formed and reject empty or
  malformed entries with a clear message.
- **FR-003**: System MUST automatically collect the page's title, description, icon,
  and preview image when saving, falling back to the address as title when details
  are unavailable.
- **FR-004**: Users MUST be able to edit a bookmark's title and description both
  during saving and after saving.
- **FR-005**: System MUST persist all bookmarks and their data across app restarts
  and reloads with no data loss in normal use.

#### Listing, search & opening

- **FR-006**: System MUST display each bookmark in the list showing its title,
  description, tags, and icon in a readable form.
- **FR-007**: Users MUST be able to open a bookmark's target page in a new browser
  tab.
- **FR-008**: System MUST search across title, description, note, and address,
  case-insensitively.
- **FR-009**: Search MUST support quoted exact phrases, `#tag` filters, and the
  boolean operators AND, OR, NOT with parenthesized grouping.
- **FR-010**: Search MUST treat multiple space-separated terms without an explicit
  operator as AND (all must match).
- **FR-011**: System MUST show a clear empty state when no bookmarks exist and a
  clear no-results state when a search or filter matches nothing.

#### Tags

- **FR-012**: Users MUST be able to add and remove tags on a bookmark.
- **FR-013**: While entering a tag, System MUST suggest existing tags matching the
  typed text.
- **FR-014**: Users MUST be able to filter the list to show only bookmarks carrying
  a selected tag.

#### Editing, dedup & deletion

- **FR-015**: Users MUST be able to edit a bookmark's title, address, description,
  note, and tags.
- **FR-016**: When saving an address that already exists, System MUST open the
  existing bookmark for editing instead of creating a duplicate.
- **FR-017**: Users MUST be able to delete a bookmark, with a confirmation step
  before permanent removal.

#### Read-later

- **FR-018**: Users MUST be able to mark a bookmark as unread (read-later) or read.
- **FR-019**: System MUST provide a dedicated unread view listing only unread
  bookmarks.
- **FR-020**: Newly saved bookmarks MUST default to unread.

#### Archive

- **FR-021**: Users MUST be able to archive a bookmark, which hides it from the
  normal list and from normal search/filter results.
- **FR-022**: System MUST provide a dedicated Archived view listing only archived
  bookmarks, from which they can be restored.
- **FR-023**: Archiving and deletion MUST be independent actions with distinct
  outcomes.

#### Bulk actions

- **FR-024**: Users MUST be able to select multiple bookmarks and apply a single
  action to all of them.
- **FR-025**: Users MUST be able to select all bookmarks matching the current search
  or filter, including items not currently on screen, and apply an action to all.
- **FR-026**: Bulk actions MUST include: add tags, remove tags, change read status,
  change archive status, and delete (delete requiring confirmation).

#### Sorting & display preferences

- **FR-027**: Users MUST be able to sort the list by multiple options beyond newest
  first (at minimum: newest, oldest, title, recently updated).
- **FR-028**: Users MUST be able to set display preferences — default sort order,
  number of items shown, and text size — which persist across sessions.

#### Saved searches

- **FR-029**: Users MUST be able to save a search, including its text query, tags to
  include, and tags to exclude, under a name.
- **FR-030**: Users MUST be able to run, edit, and delete saved searches, with runs
  reflecting the stored query and included/excluded tags.

#### Import & export

- **FR-031**: Users MUST be able to export bookmarks to the common browser bookmark
  file format.
- **FR-032**: Users MUST be able to import from the common browser bookmark file
  format; existing addresses MUST be skipped and only new ones imported.
- **FR-033**: After import, System MUST report the number of bookmarks added and the
  number skipped.

#### Preservation

- **FR-034**: Users MUST be able to preserve a bookmark as a self-contained offline
  copy of the full page, viewable later independent of the live page.
- **FR-035**: When the address is a PDF, preservation MUST store the original PDF as
  the preserved copy.
- **FR-036**: Users MUST be able to submit a bookmark's address to the Internet
  Archive to create a new snapshot, and System MUST store the returned snapshot link
  on the bookmark.
- **FR-037**: When preservation fails (page or Internet Archive unreachable), System
  MUST report the failure clearly and leave the bookmark intact.

#### Notes formatting & ordering

- **FR-038**: Notes MUST be authored in Markdown and rendered as formatted text when
  a bookmark is viewed.
- **FR-039**: System MUST record each bookmark's creation and last-updated timestamps
  to support sorting.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved reference to a web page. Attributes: address (required),
  title, description, note (Markdown), icon, preview image, tags, read state
  (unread/read), archived state, creation timestamp, last-updated timestamp,
  preserved offline copy reference (if preserved), Internet Archive snapshot link (if
  created).
- **Tag**: A short user-defined label. Many-to-many with bookmarks; drives filtering
  and tag suggestions.
- **Saved Search**: A named, reusable query. Attributes: name, text query, included
  tags, excluded tags.
- **Preserved Copy**: The stored offline representation of a page — a self-contained
  page copy, or the original PDF when the address is a PDF.
- **Display Preferences**: The user's presentation settings: default sort order,
  number of items shown, and text size.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save their first bookmark, with page details captured, in
  under 30 seconds from opening the app, without instructions.
- **SC-002**: A user can locate a specific bookmark among at least 500 saved
  bookmarks in under 10 seconds using search, tag filter, or a saved search.
- **SC-003**: Search, filter, and sort results update within 1 second of the user
  finishing input, for collections of at least 500 bookmarks.
- **SC-004**: Saved bookmarks and their data (including tags, states, and
  preferences) are still present after closing and reopening the app, with zero data
  loss across restarts in normal use.
- **SC-005**: A user can apply a bulk action to at least 100 selected bookmarks in a
  single operation and see all of them updated.
- **SC-006**: A preserved offline copy of a page can be opened and read after the
  original page is unavailable, in 100% of successful preservations.
- **SC-007**: 95% of new users successfully complete the save-then-find flow on their
  first attempt without external help.

## Assumptions

- **Single user, no accounts**: The app serves one user and requires no login or
  multi-user accounts. (Confirmed by client.)
- **Web application**: Delivered as a browser-based web application reviewed via the
  project's runtime presentation environment.
- **Web page bookmarks only**: Bookmarks reference standard web addresses
  (http/https). Non-web resources are out of scope.
- **Internet access for enrichment/preservation**: Automatic page-detail capture,
  offline-copy preservation, and Internet Archive submission require reaching the
  target page and the Internet Archive at the time of the action; these features
  degrade gracefully (with clear messaging) when unreachable.
- **Common browser bookmark format**: Import/export uses the widely supported
  Netscape-style bookmark HTML file used by major browsers. Tags/notes beyond that
  format's capabilities may not round-trip fully.
- **Sharing and cross-device sync out of scope**: Sharing collections with others and
  syncing across devices are out of scope for this version.
- **Standard expectations**: User-friendly error messages, reasonable personal-scale
  performance, and standard web accessibility apply.
