# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-18

**Status**: Draft (revised)

**Input**: User description: "An app to save and manage bookmarks" (revised with
client corrections on 2026-09-18)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a link with automatic details (Priority: P1)

A person finds a web page they want to keep and saves it by providing its
address. The app automatically collects the page's title, description, favicon,
and a preview image so the saved entry is rich without manual effort. The person
can afterwards edit the title and description.

**Why this priority**: Saving is the core reason the app exists, and automatic
enrichment is central to how the client wants saving to work. Without it there is
nothing to manage.

**Independent Test**: Add a bookmark with a valid web address and confirm the
entry appears with an auto-collected title, description, favicon, and preview
image, and that the title and description can be edited and the changes persist.

**Acceptance Scenarios**:

1. **Given** an empty list, **When** the user saves a valid web address, **Then**
   a bookmark is created and the app fetches and stores the page's title,
   description, favicon, and preview image.
2. **Given** a saved bookmark, **When** the user edits any of its address, title,
   description, tags, or note, **Then** the edited values are stored and shown,
   overriding the auto-collected values.
3. **Given** the user edits a bookmark's address to a new valid address, **When**
   they save, **Then** the address is updated (and the same invalid-address and
   duplicate rules that apply on save apply to the edited address).
4. **Given** a page from which some details cannot be collected, **When** the
   bookmark is saved, **Then** the bookmark is still created with the details that
   were available and a readable fallback title derived from the address.
5. **Given** the user submits an invalid web address, **When** they try to save,
   **Then** the app rejects it with a clear message and saves nothing.

---

### User Story 2 - Save an address that already exists (Priority: P1)

A person saves an address they have bookmarked before. Instead of being offered a
duplicate, the app takes them straight to the existing bookmark so they can edit
it.

**Why this priority**: The client explicitly requires that duplicates are never
created. This changes core save behaviour and must be part of the first release.

**Independent Test**: Save an address, then attempt to save the same address
again, and confirm no second bookmark is created and the user is brought to the
existing bookmark in an editable state.

**Acceptance Scenarios**:

1. **Given** an address already saved, **When** the user saves that same address,
   **Then** no new bookmark is created and the user is taken to the existing
   bookmark, ready to edit.
2. **Given** two addresses that differ only in trivial ways (e.g. trailing slash,
   letter case of the host), **When** compared for duplication, **Then** they are
   treated as the same address.

---

### User Story 3 - Browse, sort, and open bookmarks (Priority: P1)

A person returns to the app to retrieve saved links. They see their bookmarks,
choose how the list is sorted, and open any bookmark's original page in a new
browser tab.

**Why this priority**: A saved bookmark has no value if it cannot be retrieved
and opened. With Stories 1 and 2 this forms the minimum viable product.

**Independent Test**: Seed several bookmarks, change the sort order, confirm the
list reorders accordingly, and confirm each bookmark opens its original page in a
new tab.

**Acceptance Scenarios**:

1. **Given** several saved bookmarks, **When** the user opens the app, **Then**
   the active (non-archived) bookmarks are listed with title, description, address,
   favicon, tags, and (where available) preview image.
2. **Given** the list is shown, **When** the user selects a sort option (e.g. by
   date added, by title), **Then** the list reorders accordingly.
3. **Given** a bookmark in the list, **When** the user activates it, **Then** the
   original page opens in a new browser tab.
4. **Given** no active bookmarks exist, **When** the list is shown, **Then** a
   clear empty state is displayed.

---

### User Story 4 - Search with keywords and operators (Priority: P1)

A person locates specific bookmarks using a search box that looks across the
title, description, note, and address. They can refine with tag terms, exact
phrases, and boolean logic.

**Why this priority**: Powerful retrieval is a primary client expectation and the
main way large collections stay usable.

**Independent Test**: Seed bookmarks with known content and tags, then run each
supported query form (plain keyword, `#tag`, quoted phrase, AND/OR/NOT,
parentheses) and confirm the returned set matches the expected bookmarks.

**Acceptance Scenarios**:

1. **Given** bookmarks with varied content, **When** the user types a keyword,
   **Then** results include every active bookmark whose title, description, note,
   or address contains that keyword, regardless of letter case.
2. **Given** a search term beginning with `#` (e.g. `#work`), **When** it is run,
   **Then** results are restricted to bookmarks carrying that tag.
3. **Given** a term wrapped in quotes (e.g. `"machine learning"`), **When** it is
   run, **Then** only bookmarks containing that exact phrase are returned.
4. **Given** a query with a plain keyword and a `#tag` next to each other with no
   explicit operator (e.g. `report #work`), **When** it is run, **Then** both
   conditions must match (implicit AND): only bookmarks that match the keyword AND
   carry the tag are returned.
5. **Given** the user wants an either/or match, **When** they place `OR` between
   the terms (e.g. `report OR #work`), **Then** bookmarks matching either
   condition are returned.
6. **Given** a query combining terms with `AND`, `OR`, `NOT`, and parentheses
   (e.g. `(#work OR #research) AND report NOT "draft"`), **When** it is run,
   **Then** results honour the boolean logic and grouping.
7. **Given** the operator words appear in any letter case (e.g. `and`, `Or`,
   `nOt`), **When** the query is run, **Then** they are treated as the operators
   AND, OR, and NOT regardless of capitalization.
8. **Given** an operator word appears inside quotes (e.g. `"and then"` or
   `"not found"`), **When** the query is run, **Then** the quoted word is searched
   as ordinary text, not interpreted as an operator.
9. **Given** a query that matches nothing, **When** it is run, **Then** a clear
   "no results" state is shown.
10. **Given** a malformed query (e.g. unbalanced parentheses), **When** it is run,
   **Then** the app reports the problem instead of returning misleading results.

---

### User Story 5 - Read-later workflow (Priority: P2)

A person deliberately marks selected links as "read later" (unread), reviews them
in a dedicated unread view, and switches them between read and unread afterward.

**Why this priority**: A distinct read-later flow is an explicit client need, but
the app is usable for pure bookmarking before it is added.

**Independent Test**: Save a bookmark (which is not unread by default), deliberately
mark it "read later", confirm it appears in the unread view, mark it read, and
confirm it leaves the unread view while remaining in the main list.

**Acceptance Scenarios**:

1. **Given** a newly saved bookmark, **When** it is created, **Then** it is NOT
   automatically unread; it has no "read later" flag until the user sets one.
2. **Given** any bookmark, **When** the user marks it "read later", **Then** it
   becomes unread and appears in the unread view.
3. **Given** an unread bookmark, **When** the user marks it read, **Then** its
   state changes to read and it no longer appears in the unread view.
4. **Given** a mix of read and unread bookmarks, **When** the user opens the
   unread view, **Then** only unread bookmarks are shown.
5. **Given** a read bookmark, **When** the user marks it unread ("read later")
   again, **Then** it returns to the unread view.

---

### User Story 6 - Organize with tags and tag suggestions (Priority: P2)

A person groups bookmarks by attaching tags and is offered matching existing tags
as they type, so tagging stays consistent.

**Why this priority**: Organization matters as a collection grows; suggestions
prevent tag sprawl. Valuable but not required for the first usable release.

**Independent Test**: Add tags to bookmarks, then start typing a tag and confirm
existing matching tags are suggested; apply a suggestion and confirm it is
attached.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user adds or removes tags, **Then** the tag
   set is saved and displayed.
2. **Given** existing tags in the collection, **When** the user starts typing a
   tag, **Then** matching existing tags are suggested for selection.
3. **Given** a suggested tag, **When** the user selects it, **Then** it is applied
   without creating a near-duplicate tag.

---

### User Story 7 - Personal notes with Markdown (Priority: P2)

A person adds a personal note to a bookmark, written in Markdown, and sees it
rendered with formatting.

**Why this priority**: Notes add lasting personal value to saved links but are
not needed to save and retrieve them.

**Independent Test**: Add a Markdown note to a bookmark, save, and confirm the
note persists and is displayed with its formatting (e.g. headings, lists, links,
emphasis) rendered.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user writes a note using Markdown and saves,
   **Then** the note is stored and shown with its formatting rendered.
2. **Given** a note, **When** the user edits or clears it, **Then** the change
   persists.
3. **Given** note content, **When** it is rendered, **Then** it is displayed
   safely without allowing the note to break or hijack the interface.

---

### User Story 8 - Bulk and view-wide actions (Priority: P2)

A person selects multiple bookmarks and applies an action to all of them — adding
or removing tags, marking read/unread, archiving, or deleting. The same actions
can be applied to every bookmark in the current filtered view at once.

**Why this priority**: Bulk actions make managing a large collection practical;
individual actions suffice until volume grows.

**Independent Test**: Select several bookmarks, apply a bulk action (e.g. add a
tag), and confirm it affects exactly the selected items; then apply an action to
"all results in the current view" and confirm it affects the whole filtered set.

**Acceptance Scenarios**:

1. **Given** several bookmarks, **When** the user selects multiple and chooses an
   action (add tags, remove tags, mark read/unread, archive, delete), **Then** the
   action applies to exactly the selected bookmarks.
1a. **Given** selected bookmarks, **When** the user performs a bulk tag change,
   **Then** they can explicitly choose to add one or more tags or to remove one or
   more tags across the selection.
2. **Given** an active search or filter, **When** the user chooses to act on all
   results in the current view, **Then** the action applies to every bookmark in
   that filtered set, including any not individually selected.
3. **Given** a bulk delete, **When** it is requested, **Then** the user must
   confirm before any bookmark is removed.

---

### User Story 9 - Archive separately from delete (Priority: P2)

A person archives links they are done with but want to keep. Archived links leave
the normal list and search, live in their own archive view, and can be restored.
Deletion remains a separate, permanent action.

**Why this priority**: Non-destructive archiving is an explicit client
requirement distinct from deletion.

**Independent Test**: Archive a bookmark and confirm it disappears from the normal
list and search but appears in the archive view; restore it and confirm it
returns to the normal list; delete a bookmark and confirm it is gone entirely.

**Acceptance Scenarios**:

1. **Given** an active bookmark, **When** the user archives it, **Then** it no
   longer appears in the normal list or in search results.
2. **Given** archived bookmarks, **When** the user opens the archive view,
   **Then** the archived bookmarks are shown there.
3. **Given** an archived bookmark, **When** the user restores it, **Then** it
   returns to the normal list and becomes searchable again.
4. **Given** a bookmark, **When** the user deletes it, **Then** it is removed
   permanently and is not placed in the archive.

---

### User Story 10 - Saved reusable views (Priority: P3)

A person saves a combination of a search query with included and excluded tags as
a named, reusable view they can return to.

**Why this priority**: Saved views are a convenience layered on top of search and
tags; valuable but later.

**Independent Test**: Create a saved view combining a search term with an included
tag and an excluded tag, reopen it later, and confirm it reproduces the same
filtered result set.

**Acceptance Scenarios**:

1. **Given** a search query plus included and/or excluded tags, **When** the user
   saves it as a named view, **Then** the view is stored and listed for reuse.
2. **Given** a saved view, **When** the user opens it, **Then** the app applies
   its search and tag inclusions/exclusions and shows the matching bookmarks.
3. **Given** a saved view, **When** the user renames or deletes it, **Then** the
   change persists.

---

### User Story 11 - Import and export browser bookmarks (Priority: P3)

A person imports their existing browser bookmarks into the app and can export
their collection back out, preserving titles, tags, and original dates.

**Why this priority**: Import/export aids adoption and portability but is not
required for daily use once bookmarks exist in the app.

**Independent Test**: Import a standard browser bookmark file and confirm titles,
tags/folders, and original dates are preserved; export the collection and confirm
the exported file carries the same titles, tags, and dates.

**Acceptance Scenarios**:

1. **Given** a standard browser bookmark export file, **When** the user imports
   it, **Then** bookmarks are created preserving their titles, tags (from folder
   or tag structure), and original creation dates.
2. **Given** an import that contains addresses already saved, **When** it runs,
   **Then** existing bookmarks are not duplicated.
3. **Given** the user's collection, **When** the user exports it, **Then** a
   standard bookmark file is produced preserving titles, tags, and original
   dates.

---

### User Story 12 - Local snapshots and Internet Archive (Priority: P3)

A person preserves each saved page as a local snapshot so its content survives if
the original changes or disappears; PDF pages are preserved as PDFs. The person
can also choose to have the page saved through the Internet Archive.

**Why this priority**: Preservation protects against link rot and is important to
the client, but the app delivers value before archiving is in place.

**Independent Test**: Save a page and confirm a local snapshot is captured and
viewable; save a PDF address and confirm it is stored as a PDF; trigger the
Internet Archive option and confirm a reference to the archived copy is recorded.

**Acceptance Scenarios**:

1. **Given** a saved web page, **When** the bookmark is created, **Then** a local
   snapshot of the page is captured and can be viewed later from the bookmark.
2. **Given** a saved address that points to a PDF, **When** it is preserved,
   **Then** it is stored as a PDF.
3. **Given** a bookmark, **When** the user chooses the Internet Archive option,
   **Then** the app requests preservation through the Internet Archive and records
   a reference to the archived copy.
4. **Given** a page whose snapshot cannot be captured, **When** saving proceeds,
   **Then** the bookmark is still created and the failure to snapshot is surfaced
   to the user rather than silently lost.

---

### User Story 13 - Display preferences (Priority: P3)

A person adjusts basic display preferences — default sort order, number of items
shown per page, and font size — and the app remembers them.

**Why this priority**: Presentation preferences improve comfort but are not
essential to core functionality.

**Independent Test**: Change each preference (default sort, items shown, font
size), reload the app, and confirm the preferences are still applied.

**Acceptance Scenarios**:

1. **Given** the preferences screen, **When** the user changes the default sort
   order, **Then** the list uses that order by default on future visits.
2. **Given** the preferences screen, **When** the user changes the number of items
   shown, **Then** the list honours that count.
3. **Given** the preferences screen, **When** the user changes the font size,
   **Then** the interface text scales accordingly and the setting persists.

---

### Edge Cases

- **Metadata unavailable**: When a page's title, description, favicon, or preview
  cannot be collected, the bookmark is still created with whatever is available
  and a fallback title derived from the address.
- **Duplicate on save**: Saving an existing address never creates a duplicate; the
  user is taken to the existing bookmark.
- **Duplicate on import**: Import must not create duplicates of addresses already
  saved.
- **Malformed search query**: Unbalanced quotes or parentheses are reported rather
  than producing misleading results.
- **Very long titles/addresses/notes**: Stored in full, displayed truncated so the
  layout is preserved.
- **Special characters and untrusted content**: Titles, descriptions, notes
  (Markdown), tags, and fetched metadata are stored and rendered safely without
  breaking or hijacking the interface.
- **Snapshot/Archive failure**: Failure to capture a local snapshot or reach the
  Internet Archive does not block saving; the failure is surfaced.
- **Large collections**: List, search, sort, and bulk actions remain usable with
  several thousand bookmarks.
- **Archived items excluded**: Archived bookmarks are excluded from the normal
  list and from search results unless the archive view is used.
- **Unreachable page**: The address is saved even if the page is currently
  offline; live reachability is not required to save.

## Requirements *(mandatory)*

### Functional Requirements

**Saving & enrichment**

- **FR-001**: Users MUST be able to save a bookmark by providing a web address.
- **FR-002**: System MUST validate that the address is well-formed before saving
  and reject invalid input with a clear message.
- **FR-003**: On save, System MUST automatically collect and store the page's
  title, description, favicon, and preview image when available.
- **FR-004**: System MUST allow users to edit a bookmark's address, title,
  description, tags, and note; edited title/description override the auto-collected
  values. Editing the address MUST apply the same validity and duplicate rules as
  saving.
- **FR-005**: When details cannot be collected, System MUST still create the
  bookmark using available details and a fallback title derived from the address.

**Duplicates**

- **FR-006**: When a user saves an address that already exists, System MUST NOT
  create a duplicate and MUST take the user to the existing bookmark in an
  editable state.
- **FR-007**: System MUST treat addresses that differ only trivially (e.g.
  trailing slash, host letter case) as the same address for duplicate detection.

**Notes**

- **FR-008**: Users MUST be able to add, edit, and clear a personal note on a
  bookmark, authored in Markdown and displayed with formatting rendered.
- **FR-009**: System MUST render note content and all user- and web-derived text
  safely, preventing it from breaking or hijacking the interface.

**Browsing, sorting, opening**

- **FR-010**: Users MUST be able to view a list of active (non-archived)
  bookmarks showing title, description, address, favicon, tags, and (where
  available) preview image.
- **FR-011**: Users MUST be able to sort the list (e.g. by date added and by
  title).
- **FR-012**: Users MUST be able to open a bookmark's original page in a new
  browser tab.
- **FR-013**: System MUST show a clear empty state when there are no active
  bookmarks and a clear "no results" state when a search or filter matches
  nothing.

**Search**

- **FR-014**: System MUST provide keyword search across title, description, note,
  and address, matching case-insensitively.
- **FR-015**: Search MUST support tag terms in the form `#tag` that restrict
  results to bookmarks carrying that tag.
- **FR-016**: Search MUST support exact-phrase matching for quoted terms.
- **FR-017**: Search MUST support boolean combination with `AND`, `OR`, `NOT`, and
  parentheses for grouping.
- **FR-017a**: When adjacent search terms (including a keyword and a `#tag`) have
  no explicit operator between them, System MUST combine them with an implicit AND;
  an explicit `OR` MUST be required to make them alternatives.
- **FR-017b**: System MUST recognize the operators `AND`, `OR`, and `NOT` in any
  letter case (case-insensitively).
- **FR-017c**: When an operator word appears inside quotes, System MUST treat it as
  ordinary search text rather than as an operator.
- **FR-018**: System MUST report malformed queries clearly instead of returning
  misleading results.
- **FR-019**: Search results MUST exclude archived bookmarks.

**Tags**

- **FR-020**: Users MUST be able to attach and remove tags on a bookmark.
- **FR-021**: While the user types a tag, System MUST suggest matching existing
  tags to promote consistency and avoid near-duplicates.
- **FR-022**: Users MUST be able to filter the list by including and/or excluding
  tags, and to clear the filter.

**Read-later**

- **FR-023**: System MUST NOT mark new bookmarks as unread automatically; a
  bookmark carries a "read later" (unread) flag only when the user deliberately
  sets it.
- **FR-024**: Users MUST be able to deliberately mark a bookmark "read later"
  (unread) and to switch any bookmark between read and unread afterward.
- **FR-025**: System MUST provide a dedicated unread view showing only unread
  bookmarks.

**Bulk & view-wide actions**

- **FR-026**: Users MUST be able to select multiple bookmarks and apply a single
  action to all selected: add tags, remove tags, mark read/unread, archive, or
  delete.
- **FR-026a**: A bulk tag change MUST let the user explicitly choose to add one or
  more tags or to remove one or more tags across the selection.
- **FR-027**: Users MUST be able to apply those same actions to all bookmarks in
  the current filtered view at once.
- **FR-028**: System MUST require confirmation before bulk deletion.

**Archiving vs deletion**

- **FR-029**: Users MUST be able to archive a bookmark, which removes it from the
  normal list and search while retaining it.
- **FR-030**: System MUST provide an archive view listing archived bookmarks.
- **FR-031**: Users MUST be able to restore an archived bookmark to the normal
  list.
- **FR-032**: Users MUST be able to delete a bookmark permanently, distinct from
  archiving, with confirmation.

**Saved views**

- **FR-033**: Users MUST be able to save a named view combining a search query
  with included and excluded tags.
- **FR-034**: Users MUST be able to open a saved view to reproduce its filtered
  results, and to rename and delete saved views.

**Import & export**

- **FR-035**: Users MUST be able to import a standard browser bookmark file,
  preserving titles, tags (from folder/tag structure), and original creation
  dates.
- **FR-036**: Import MUST NOT create duplicates of addresses already saved.
- **FR-037**: Users MUST be able to export the collection to a standard bookmark
  file preserving titles, tags, and original dates.

**Preservation**

- **FR-038**: On save, System MUST capture a local snapshot of the page that can
  be viewed later from the bookmark.
- **FR-039**: When a saved address points to a PDF, System MUST preserve it as a
  PDF.
- **FR-040**: Users MUST be able to request preservation of a page through the
  Internet Archive, and System MUST record a reference to the archived copy.
- **FR-041**: Failure to capture a snapshot or reach the Internet Archive MUST NOT
  block saving; the failure MUST be surfaced to the user.

**Preferences & persistence**

- **FR-042**: Users MUST be able to set display preferences — default sort order,
  number of items shown, and font size — and System MUST persist and apply them
  across sessions.
- **FR-043**: System MUST persist all bookmarks, tags, notes, states (read/unread,
  archived), saved views, snapshots, and preferences so they survive app restarts.
- **FR-044**: System MUST record each bookmark's creation and last-updated times
  and preserve original dates supplied on import.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved reference to a web page. Attributes: address; title and
  description (auto-collected, user-editable); favicon; preview image; personal
  note (Markdown); read/unread state; archived state; tags; creation and
  last-updated timestamps (creation may be an imported original date); references
  to its local snapshot and any Internet Archive copy.
- **Tag**: A short label grouping bookmarks (many-to-many with Bookmark), used for
  filtering, `#tag` search, and suggestions.
- **Saved View**: A named, reusable combination of a search query with included
  and excluded tags.
- **Snapshot**: A locally preserved copy of a page's content at save time (a PDF
  when the source is a PDF), viewable from its bookmark.
- **Preferences**: The user's display settings — default sort order, items shown
  per page, and font size.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark, with details auto-collected, in
  under 20 seconds of their own effort (excluding background enrichment).
- **SC-002**: Auto-collection populates title, description, favicon, and preview
  for at least 90% of typical public web pages that expose them.
- **SC-003**: A user can locate a specific bookmark among at least 500 entries in
  under 10 seconds using search, operators, or tag filtering.
- **SC-004**: Search and filter results appear within 1 second of input for
  collections of up to 5,000 bookmarks.
- **SC-005**: Saving the same address twice results in zero duplicates in 100% of
  attempts and brings the user to the existing bookmark.
- **SC-006**: Importing a standard browser bookmark file preserves titles, tags,
  and original dates for 100% of well-formed entries and creates no duplicates.
- **SC-007**: Bookmarks, notes, states, saved views, snapshots, and preferences
  persist across app restart in 100% of cases.
- **SC-008**: A local snapshot is successfully captured for at least 90% of saved
  public pages; failures are surfaced, not silent.
- **SC-009**: 95% of first-time users can save, find, and open a bookmark without
  external instructions.

## Assumptions

- **Single user, no accounts (v1)**: The app serves one user's personal
  collection with no sign-in, multi-user separation, or sharing.
- **Web application**: Delivered as a browser-based application reachable at the
  review URLs defined by the project's runtime conventions.
- **Server-side enrichment and snapshots**: Automatic metadata collection and
  local page snapshotting are performed by the application (server side) at save
  time; some pages may block collection, which is handled as an edge case.
- **Internet Archive is an external dependency**: Saving through the Internet
  Archive relies on that third-party service; when it is unavailable the option
  fails gracefully and saving still succeeds.
- **Standard bookmark file format**: Import/export uses the widely supported
  browser bookmark (HTML) format; folder structure maps to tags on import.
- **Markdown notes**: Notes accept standard Markdown; rendering is sanitized.
- **Snapshot storage**: Local snapshots consume storage that grows with the
  collection; storage is assumed sufficient for a personal collection.
- **Modern browser**: Users access the app with a current mainstream web browser.
