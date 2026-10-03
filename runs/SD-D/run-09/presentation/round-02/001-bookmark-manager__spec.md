# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-18

**Status**: Draft (revised)

**Input**: User description: "I want to build an app to save and manage bookmarks."
Revised after client review to confirm single-user scope, add browser
import/export, automatic page metadata, read-later/archive, advanced search,
bulk actions, snapshots, saved filters, and display preferences.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark with automatic details (Priority: P1)

A person finds a web page worth keeping and saves it by entering its address.
The app automatically collects the page's title, description, favicon, and a
preview image so the entry is rich without manual effort, while still letting the
person edit the title and description before or after saving.

**Why this priority**: Saving is the core reason the product exists, and
automatic detail collection is what makes each saved item recognizable and worth
returning to. It is the smallest slice that delivers a usable product.

**Independent Test**: Add a URL, confirm the app fills in title, description,
favicon, and preview image, edit the title, save, and confirm the bookmark
appears in the list with the edited title and the collected details.

**Acceptance Scenarios**:

1. **Given** a valid web address, **When** the person submits it, **Then** the
   app collects the page title, description, favicon, and preview image and shows
   them for review before saving.
2. **Given** collected details are shown, **When** the person edits the title or
   description, **Then** the edited values are what gets saved.
3. **Given** a saved bookmark, **When** the person edits its title or description
   later, **Then** the changes persist and are reflected in the list.
4. **Given** an entry that is not a valid web address, **When** the person tries
   to save, **Then** the app rejects it with a clear message and creates nothing.
5. **Given** a page that cannot be read (offline or blocking access), **When**
   the person saves it, **Then** the bookmark is still created with the address
   and a best-effort title, and missing details are left blank for later editing.

---

### User Story 2 - Re-saving an existing address opens it for editing (Priority: P1)

When a person saves an address that is already bookmarked, the app takes them
straight to the existing bookmark to edit it, rather than creating a duplicate or
merely warning them.

**Why this priority**: Prevents duplicate clutter and matches the person's real
intent ("I want to work with this page"), so it belongs with core saving.

**Independent Test**: Save an address, then attempt to save the same address
again; confirm the app opens the existing bookmark's edit view instead of
creating a second entry.

**Acceptance Scenarios**:

1. **Given** an address that is already bookmarked, **When** the person submits
   it again, **Then** the app opens the existing bookmark in edit mode instead of
   creating a duplicate.
2. **Given** the same address differing only by trivial variations (trailing
   slash, scheme, or letter case in the host), **When** it is submitted, **Then**
   the app treats it as the same bookmark and opens the existing one.

---

### User Story 3 - Browse, search, and open bookmarks (Priority: P2)

A person returns to find something saved earlier. They scan the list — which
shows title, description, favicon, and tags — search with keywords and operators,
and click through to open the original page.

**Why this priority**: Retrieval turns a pile of saved links into a useful tool.
It depends on bookmarks existing (P1) but is essential for repeat use.

**Independent Test**: With several bookmarks saved, run searches using a plain
keyword, a `#tag`, a quoted phrase, and an AND/OR/NOT expression, confirming the
list narrows correctly each time, then open a result and confirm the correct
page loads.

**Acceptance Scenarios**:

1. **Given** multiple saved bookmarks, **When** the person opens the app,
   **Then** each is listed showing title, description, favicon, and tags.
2. **Given** a search term, **When** it is entered, **Then** matching is
   case-insensitive and considers titles, descriptions, notes, and addresses.
3. **Given** a `#tag` token in the search, **When** applied, **Then** only
   bookmarks carrying that tag are shown.
4. **Given** a quoted phrase, **When** searched, **Then** only bookmarks
   containing that exact phrase are shown.
5. **Given** an expression using AND, OR, NOT and parentheses, **When** searched,
   **Then** results honor the boolean logic and grouping.
6. **Given** a bookmark in the list, **When** the person activates it, **Then**
   the original page opens in a new browser tab.
7. **Given** a search with no matches, **When** results are shown, **Then** an
   explanatory empty-state message is displayed.

---

### User Story 4 - Organize and edit bookmarks (Priority: P2)

A person curates their collection: editing the address, title, description, and a
Markdown note, and managing tags with type-ahead suggestions drawn from tags they
already use. They can delete bookmarks they no longer want.

**Why this priority**: Curation keeps the collection accurate and useful as it
grows. It depends on saving and retrieval but is central to "manage."

**Independent Test**: Open a bookmark, change its address and title, add a note
using Markdown, add a tag using an existing-tag suggestion, save, and confirm all
values persist; view the note and confirm the Markdown renders; then delete a
bookmark and confirm it is gone.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the person edits the address, title,
   description, note, or tags and saves, **Then** all updated values persist
   across reloads.
2. **Given** the person is typing a tag, **When** characters are entered, **Then**
   matching existing tags are suggested for quick selection.
3. **Given** a note written in Markdown, **When** the note is viewed, **Then** it
   renders as formatted text (headings, lists, links, emphasis, code).
4. **Given** an existing bookmark, **When** the person deletes it, **Then** they
   are asked to confirm, and on confirmation it is permanently removed and no
   longer appears in any view or search.

---

### User Story 5 - Read-later and archive workflows (Priority: P2)

A person marks newly saved pages as unread ("read later"), works through them,
and archives items they are done with. Archived items are kept but moved out of
the everyday list and search, and archiving can always be undone without deleting
anything.

**Why this priority**: Distinguishing "to read," "active," and "put away" is a
primary way people manage a growing collection; it is essential to "manage" but
builds on core saving and browsing.

**Independent Test**: Save a bookmark (defaults to unread), mark it read, archive
it, confirm it disappears from the normal list and search, open the Archived
view and confirm it is there, then un-archive it and confirm it returns to the
normal list.

**Acceptance Scenarios**:

1. **Given** a newly saved bookmark, **When** it is created, **Then** it is
   marked unread by default and appears in the Unread / Read-Later view.
2. **Given** an unread bookmark, **When** the person marks it read, **Then** it
   leaves the Unread view but remains in the main list.
3. **Given** any bookmark, **When** the person archives it, **Then** it is
   removed from the normal list and excluded from normal search results.
4. **Given** an archived bookmark, **When** the person opens the Archived view,
   **Then** it is shown there, and it can be searched within that view.
5. **Given** an archived bookmark, **When** the person un-archives it, **Then**
   it returns to the normal list unchanged.
6. **Given** archiving and deletion, **When** either is used, **Then** they are
   distinct actions: archiving is reversible and preserves the item, deletion is
   permanent.

---

### User Story 6 - Sort and act on many bookmarks at once (Priority: P3)

A person sorts the list by different criteria and selects several bookmarks — or
everything matching the current view — to tag, mark read/unread, archive, or
delete them all together.

**Why this priority**: Bulk actions and sorting make large collections
manageable. Valuable but not required for the first usable release.

**Independent Test**: Sort the list by title and by date, select several
bookmarks and also "select all matching," then apply a bulk tag and a bulk
archive, confirming every selected item is updated.

**Acceptance Scenarios**:

1. **Given** a populated list, **When** the person chooses a sort option, **Then**
   the list reorders by that criterion (e.g. date added, title, last updated).
2. **Given** the list, **When** the person selects individual bookmarks, **Then**
   a bulk-action control shows the count and available actions.
3. **Given** an active search or filter, **When** the person chooses "select all
   matching," **Then** every bookmark in the current view is selected.
4. **Given** a selection, **When** the person applies a bulk action (add/remove
   tag, mark read/unread, archive, or delete), **Then** it is applied to all
   selected bookmarks, with confirmation required before bulk deletion.

---

### User Story 7 - Import and export browser bookmarks (Priority: P3)

A person moves their existing bookmarks in from a standard browser bookmarks HTML
file, preserving titles, folder-derived tags, and original dates, and can export
their collection back out in the same standard format.

**Why this priority**: Import removes the cold-start barrier and export protects
the person from lock-in. Important but not required for the first usable slice.

**Independent Test**: Import a standard browser bookmarks HTML file and confirm
titles, tags, and dates are preserved; then export and confirm the produced file
is a valid browser bookmarks HTML file containing the same entries.

**Acceptance Scenarios**:

1. **Given** a standard browser bookmarks HTML file, **When** the person imports
   it, **Then** each entry becomes a bookmark preserving its title, address, and
   original add-date, with folders mapped to tags.
2. **Given** an import that includes addresses already present, **When** it runs,
   **Then** existing bookmarks are not duplicated and the person is told how many
   were added versus skipped.
3. **Given** a collection, **When** the person exports, **Then** a standard
   browser bookmarks HTML file is produced that another browser can re-import,
   preserving titles, tags (as folders), and dates.

---

### User Story 8 - Local snapshots and web archival (Priority: P3)

For each saved page the app keeps a local snapshot of the content so it stays
readable even if the original changes or disappears; pages that are PDFs are
stored as PDFs. The person can also choose to preserve a page through the
Internet Archive and keep a link to that copy.

**Why this priority**: Durability against link rot is a strong differentiator but
depends on the core save flow and is acceptable to deliver after the essentials.

**Independent Test**: Save a normal web page and confirm a local snapshot is
captured and can be opened; save a PDF address and confirm it is stored and opens
as a PDF; trigger Internet Archive preservation for a bookmark and confirm a link
to the archived copy is stored on the bookmark.

**Acceptance Scenarios**:

1. **Given** a saved web page, **When** it is bookmarked, **Then** a local
   snapshot of the page content is captured and can be opened later.
2. **Given** a bookmarked address that points to a PDF, **When** the snapshot is
   taken, **Then** it is stored and opens as a PDF.
3. **Given** a bookmark, **When** the person requests Internet Archive
   preservation, **Then** the app submits the page and stores a link to the
   resulting archived copy.
4. **Given** a snapshot cannot be captured (page blocks it or is unreachable),
   **When** saving, **Then** the bookmark is still created and the person is told
   the snapshot is unavailable.

---

### User Story 9 - Saved filters (Priority: P3)

A person saves a named filter that combines a search with included and excluded
tags, then re-applies it in one click to return to a familiar view.

**Why this priority**: Saved filters speed up recurring retrieval patterns.
Convenience that builds on search and tagging.

**Independent Test**: Create a filter combining a keyword search with one
included tag and one excluded tag, save it with a name, navigate away, then
re-apply it and confirm the list matches the defined criteria.

**Acceptance Scenarios**:

1. **Given** a search plus chosen included and excluded tags, **When** the person
   saves it as a named filter, **Then** it is stored and listed for reuse.
2. **Given** a saved filter, **When** the person applies it, **Then** the list
   shows exactly the bookmarks matching its search and tag inclusion/exclusion.
3. **Given** a saved filter, **When** the person edits or deletes it, **Then** the
   change persists and does not affect any bookmarks.

---

### User Story 10 - Display preferences (Priority: P3)

A person adjusts basic display preferences — default sort order, number of items
shown per page, and font size — and the app remembers them.

**Why this priority**: Personalization improves comfort for regular use but is
not essential to the core value.

**Independent Test**: Change the default sort, items-per-page, and font size,
reload the app, and confirm the chosen preferences are still in effect.

**Acceptance Scenarios**:

1. **Given** the preferences screen, **When** the person sets a default sort
   order, **Then** the list uses it on next load.
2. **Given** the preferences screen, **When** the person sets items shown per
   page, **Then** the list paginates accordingly.
3. **Given** the preferences screen, **When** the person sets a font size, **Then**
   the interface text scales and the choice persists across reloads.

---

### Edge Cases

- **Duplicate address**: Re-saving an existing address opens the existing
  bookmark for editing rather than creating a duplicate (see Story 2); trivial
  address variations are treated as the same page.
- **Unreadable or offline page**: Saving still succeeds from the address alone;
  metadata and snapshot fall back to blank/unavailable and can be added later.
- **PDF and non-HTML targets**: Stored appropriately (PDFs as PDFs); metadata may
  be limited but the bookmark and snapshot still work.
- **Malformed search expression**: An unbalanced quote or parenthesis produces a
  clear message rather than wrong results.
- **Large import**: A big bookmarks file imports without loss; progress and an
  added-vs-skipped summary are shown.
- **Archived items**: Excluded from the normal list and normal search, and never
  silently deleted; only visible in the Archived view.
- **Very long titles, descriptions, or addresses**: Display truncates gracefully
  while preserving the full stored value.
- **Empty states**: First-time (no bookmarks), empty Unread view, empty Archived
  view, and no-results search each show a helpful message.
- **Address without scheme**: Accepted and normalized so it opens correctly and
  de-duplicates consistently.

## Requirements *(mandatory)*

### Functional Requirements

#### Saving & metadata

- **FR-001**: System MUST allow creating a bookmark from a web address, with
  optional person-supplied title, description, note, and tags.
- **FR-002**: System MUST automatically collect the page's title, description,
  favicon, and preview image when a bookmark is added.
- **FR-003**: System MUST let the person edit the title and description both
  before saving and at any time afterward.
- **FR-004**: System MUST validate the address and reject entries that are not
  valid web addresses, with a clear error message.
- **FR-005**: System MUST normalize addresses (e.g. add a missing scheme, ignore
  trailing-slash and host letter-case differences) for opening and de-duplication.
- **FR-006**: When the person saves an address that already exists, System MUST
  open the existing bookmark in edit mode instead of creating a duplicate.
- **FR-007**: System MUST still create a bookmark when page details cannot be
  collected, filling what it can and leaving the rest blank/best-effort.

#### Editing & organization

- **FR-008**: Users MUST be able to edit a bookmark's address, title,
  description, note, and tags, with all changes persisted.
- **FR-009**: System MUST suggest existing tags as the person types a tag.
- **FR-010**: System MUST store notes as Markdown and render them as formatted
  text when a note is viewed.
- **FR-011**: Users MUST be able to permanently delete a bookmark, with a
  confirmation step; deletion removes it from all views and searches.
- **FR-012**: System MUST support tagging bookmarks and filtering the list by one
  or more tags.

#### Browsing, search & sorting

- **FR-013**: System MUST display bookmarks in a list showing title, description,
  favicon, and tags.
- **FR-014**: System MUST provide search across titles, descriptions, notes, and
  addresses, matching case-insensitively.
- **FR-015**: Search MUST support `#tag` tokens, exact quoted phrases, and boolean
  AND/OR/NOT with parentheses for grouping.
- **FR-016**: System MUST report malformed search expressions clearly instead of
  returning misleading results.
- **FR-017**: Users MUST be able to open a bookmark's original page in a new
  browser tab.
- **FR-018**: System MUST offer sort options beyond newest-first (at minimum:
  date added, title, and last updated), applied to the current view.
- **FR-019**: System MUST show helpful empty states for no bookmarks, empty
  Unread view, empty Archived view, and no-match searches.
- **FR-020**: System MUST record and display the date each bookmark was added.

#### Read-later, archive & bulk actions

- **FR-021**: System MUST track a read/unread status per bookmark, defaulting new
  bookmarks to unread, and provide an Unread / Read-Later view.
- **FR-022**: Users MUST be able to archive and un-archive bookmarks; archiving
  MUST be reversible and MUST NOT delete the item.
- **FR-023**: System MUST exclude archived bookmarks from the normal list and
  normal search, and provide a separate Archived view that can be searched.
- **FR-024**: Users MUST be able to select multiple bookmarks, and to select all
  bookmarks matching the current view/search.
- **FR-025**: Users MUST be able to apply bulk actions to a selection — add/remove
  tags, mark read/unread, archive, and delete — with confirmation before bulk
  deletion.

#### Import & export

- **FR-026**: System MUST import a standard browser bookmarks HTML file,
  preserving each entry's title, address, and original add-date, and mapping
  folders to tags.
- **FR-027**: Import MUST NOT create duplicates of already-present addresses and
  MUST report how many entries were added versus skipped.
- **FR-028**: System MUST export the collection to a standard browser bookmarks
  HTML file that another browser can re-import, preserving titles, tags (as
  folders), and dates.

#### Snapshots & archival

- **FR-029**: System MUST capture a local snapshot of each saved page's content
  that the person can open later, storing PDF targets as PDFs.
- **FR-030**: System MUST let the person preserve a page through the Internet
  Archive and store a link to the resulting archived copy on the bookmark.
- **FR-031**: When a snapshot cannot be captured, System MUST still create the
  bookmark and indicate the snapshot is unavailable.

#### Saved filters & preferences

- **FR-032**: Users MUST be able to save a named filter combining a search with
  included and excluded tags, and re-apply, edit, or delete it.
- **FR-033**: System MUST persist display preferences for default sort order,
  number of items shown per page, and font size, and apply them across reloads.

#### Persistence

- **FR-034**: System MUST persist all bookmarks, tags, notes, statuses, snapshots,
  saved filters, and preferences so they remain available after the app is closed
  and reopened.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved reference to a web page. Attributes: normalized address,
  title, description, note (Markdown), tags, favicon, preview image, date added,
  last updated, read/unread status, archived status, snapshot reference, and an
  optional Internet Archive link.
- **Tag**: A short label used to group bookmarks; many-to-many with bookmarks.
  May originate from an imported folder.
- **Snapshot**: A stored local copy of a bookmarked page's content, of a type
  appropriate to the target (page capture or PDF), openable independently of the
  live page.
- **Saved Filter**: A named, reusable view defined by a search expression plus
  sets of included and excluded tags.
- **Display Preferences**: The person's settings for default sort order, items
  shown per page, and font size.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person can save a new bookmark — with title, description,
  favicon, and preview collected automatically — in under 15 seconds from opening
  the add form to seeing it in the list.
- **SC-002**: A person can locate a specific bookmark among at least 1,000
  entries in under 10 seconds using search, `#tag`, or a saved filter.
- **SC-003**: Search and sort results update within 1 second for a collection of
  up to 1,000 bookmarks, including boolean and quoted-phrase queries.
- **SC-004**: Importing a standard browser bookmarks HTML file preserves 100% of
  titles, addresses, dates, and folder-derived tags, with zero duplicates created
  for addresses already present.
- **SC-005**: Exporting then re-importing the produced file into a standard
  browser reproduces the same titles, tags, and dates without loss.
- **SC-006**: For successfully reachable pages, a local snapshot is available for
  at least 95% of saved bookmarks and remains openable after the original page
  changes.
- **SC-007**: Archiving and un-archiving never lose data: an un-archived bookmark
  is identical to its pre-archive state, and archived items never appear in the
  normal list or search.
- **SC-008**: A person can apply a single bulk action (tag, read/unread, archive,
  or delete) to at least 100 selected bookmarks in one operation.
- **SC-009**: 95% of first-time users successfully save, then re-open, a bookmark
  without external instructions.
- **SC-010**: All bookmarks, notes, statuses, saved filters, and preferences
  persist across app restarts with zero data loss in normal use.

## Assumptions

- **Single-user, personal use**: The app serves one person's private collection
  with no login, accounts, sharing, or collaboration. (Confirmed with client.)
- **Web application**: Delivered as a browser-accessed web app, consistent with
  the project's runtime presentation environment; not a native mobile app.
- **Manual entry plus file import**: Bookmarks are added by entering an address or
  by importing a standard browser bookmarks HTML file. One-click browser capture
  (a browser button/extension) is deferred to a later release. (Confirmed with
  client.)
- **Standard bookmarks format**: "Standard browser bookmarks HTML file" refers to
  the widely used Netscape bookmark file format that mainstream browsers import
  and export.
- **Best-effort metadata and snapshots**: The app collects titles, descriptions,
  favicons, previews, and snapshots where the page permits; blocked, offline, or
  restricted pages fall back gracefully without preventing the save.
- **Internet Archive availability**: Web-archive preservation depends on the
  external Internet Archive service being reachable; when it is not, the rest of
  saving is unaffected and the person is informed.
- **Reasonable scale**: The design targets an individual collection on the order
  of thousands of bookmarks with their snapshots, not millions.
- **Modern browser**: A current desktop or mobile web browser with JavaScript
  enabled.
