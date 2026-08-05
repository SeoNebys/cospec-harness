# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-07-13

**Status**: Draft

**Input**: User description: "An app to save and manage bookmarks"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A user comes across a web page they want to keep. They save it into the app by
providing its address, and the app records it — automatically capturing the
page's title, its site icon, and a short description so it is recognisable at a
glance later. The saved bookmark appears in their list immediately.

**Why this priority**: Saving is the core reason the app exists. Without it,
nothing else has value. This alone is a usable product: a place to stash links.

**Independent Test**: Add a bookmark by supplying a web address, then confirm it
appears in the list with a recognisable title, site icon, short description, and
its address. Delivers the core "keep this link" value on its own.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user saves a valid web address,
   **Then** a new bookmark appears in the list showing its title, site icon,
   short description, and address.
2. **Given** the user provides an address whose title cannot be determined,
   **When** they save it, **Then** the bookmark is still saved and the address
   itself is shown as the title.
3. **Given** the user submits something that is not a valid web address,
   **When** they try to save it, **Then** the app rejects it with a clear message
   and nothing is added to the list.
4. **Given** the user saves an address that is already bookmarked, **When** they
   submit it, **Then** the app opens the existing bookmark for editing instead of
   creating a second entry (see User Story 3).

---

### User Story 2 - Browse and open saved bookmarks (Priority: P1)

A user opens the app to revisit something they saved. They see their bookmarks in
a list — each recognisable by its title, site icon, and short description — and
can open any bookmark's page in their browser with a single action.

**Why this priority**: Saved links are worthless if they cannot be retrieved and
opened. Together with saving, this forms the minimum viable product.

**Independent Test**: With several bookmarks already saved, view the list and
activate one, confirming it opens the correct page.

**Acceptance Scenarios**:

1. **Given** one or more saved (non-archived) bookmarks, **When** the user views
   the app, **Then** all such bookmarks are listed with title, site icon, short
   description, and address.
2. **Given** a bookmark in the list, **When** the user activates it, **Then**
   its page opens in the browser.
3. **Given** an empty list, **When** the user views the app, **Then** a friendly
   empty state explains how to add the first bookmark.

---

### User Story 3 - Organise, search, and edit bookmarks (Priority: P2)

As the collection grows, a user needs to find and tidy their bookmarks. They can
search by keyword (including exact phrases in quotes), assign tags (with
suggestions drawn from tags they have already used, so the same tag is not
re-created under slightly different spellings), filter by one or more tags —
including any-of and exclude-this combinations — search within a tag, edit a
bookmark's details — including notes with light formatting — choose how the list
is sorted, and delete bookmarks they no longer want.

**Why this priority**: Essential once a user has more than a handful of
bookmarks, but the app is already useful without it. This is what turns a flat
list into a manageable collection.

**Independent Test**: With a set of tagged bookmarks, search by a keyword and by
a quoted phrase, filter by a tag and search within it, switch the sort order,
edit one bookmark's title and tags and confirm the change persists, and delete
one and confirm it is gone.

**Acceptance Scenarios**:

1. **Given** several bookmarks, **When** the user types a keyword, **Then** the
   list narrows to bookmarks whose title, address, description, notes, or tags
   match, regardless of letter case.
2. **Given** several bookmarks, **When** the user searches for a phrase enclosed
   in quotation marks, **Then** only bookmarks containing that exact phrase are
   shown.
3. **Given** bookmarks with assigned tags, **When** the user selects a tag,
   **Then** only bookmarks carrying that tag are shown.
4. **Given** a tag filter is active, **When** the user also types a keyword,
   **Then** the results are only bookmarks that both carry the tag and match the
   keyword (search within a tag).
10. **Given** several tags exist, **When** the user includes more than one tag in
    the filter, **Then** bookmarks carrying **any** of the included tags are shown.
11. **Given** a tag filter is active, **When** the user marks a tag to exclude,
    **Then** bookmarks carrying that tag are removed from the results (e.g. tagged
    "work" but not "finished").
5. **Given** a list of bookmarks, **When** the user chooses a sort order, **Then**
   the list reorders accordingly — either most recently saved first (default) or
   alphabetically by title.
6. **Given** an existing bookmark, **When** the user edits its title, description,
   notes, or tags and saves, **Then** the updated details are shown and retained.
7. **Given** an existing bookmark, **When** the user deletes it and confirms,
   **Then** it is permanently removed and no longer appears in the list or in
   searches.
8. **Given** the user has previously used one or more tags, **When** they begin
   typing a tag, **Then** matching existing tags are suggested for selection so
   they can reuse an existing tag rather than create a near-duplicate.
9. **Given** the user writes a note with light formatting (such as bold text, a
   list, or a link), **When** they view the bookmark, **Then** the note is
   displayed with that formatting laid out, not as a single plain-text blob.

---

### User Story 4 - Import and export bookmarks (Priority: P2)

A user already has a pile of bookmarks in their web browser and wants to bring
them into the app, and to be able to take their whole collection back out again
later. They import from a standard browser bookmark file, and can export their
collection to a file at any time.

**Why this priority**: A primary reason for adopting the app is consolidating
bookmarks the user already has; being able to export again means their data is
never trapped. Not part of the bare MVP, but a key adoption driver the user
wants available, not deferred.

**Independent Test**: Import a standard browser bookmark export file and confirm
the bookmarks appear in the list with their titles, addresses, and any folder
labels; then export the collection and confirm the resulting file contains all
of them.

**Acceptance Scenarios**:

1. **Given** a standard browser bookmark export file, **When** the user imports
   it, **Then** each bookmark in the file is added to the collection with its
   title and address.
2. **Given** an import file whose bookmarks are organised into folders, **When**
   the user imports it, **Then** each bookmark's containing folder name(s) are
   brought across as tags so the original organisation is preserved.
3. **Given** an import file that records when each bookmark was originally added,
   **When** the user imports it, **Then** the original "date added" is kept rather
   than reset to the import date.
4. **Given** an import file that includes an address the user has already saved,
   **When** the user imports it, **Then** no duplicate entry is created for that
   address.
5. **Given** a collection of saved bookmarks, **When** the user exports, **Then**
   a file is produced that contains all of their bookmarks — carrying their tags
   and, where the format allows, their notes — and can be re-imported into the
   app or into a standard web browser.

---

### User Story 5 - Triage: read-later and archive (Priority: P2)

A user often saves things they have not read yet and wants to see just that
unread pile. They also want to clear finished or low-priority items off their
main list without throwing them away — tucking them aside and retrieving them
later if needed.

**Why this priority**: Keeps the main list focused and supports the common
"save now, read later" habit. Valuable for daily use, but the app still works
without it.

**Independent Test**: Mark some bookmarks unread and filter to show only the
unread pile; archive a bookmark, confirm it leaves the main list, then find it in
the archive and restore it to the main list.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user marks it as unread (read-later),
   **Then** it appears when the user filters to their unread pile.
2. **Given** a bookmark marked unread, **When** the user marks it as read,
   **Then** it no longer appears in the unread pile.
3. **Given** a bookmark on the main list, **When** the user archives it, **Then**
   it is removed from the main list but retained in the archive.
4. **Given** an archived bookmark, **When** the user views the archive and
   restores it, **Then** it reappears on the main list unchanged.

---

### User Story 6 - Act on many bookmarks at once (Priority: P2)

A user — most often right after importing a large batch — wants to tidy many
bookmarks together instead of one at a time. They select multiple bookmarks by
hand, or select the entire current filtered/search result set in one step, and
apply a single action to all of them: add a tag, archive, mark read/unread, or
delete.

**Why this priority**: Without bulk actions, tidying an imported pile of a
thousand bookmarks one by one is impractical, undermining the value of import.
The app still functions without it, so it sits alongside the other P2
enhancements rather than in the MVP.

**Independent Test**: Filter to a tag, choose "select everything matching,"
archive the whole set in one action, and confirm all matching bookmarks are
archived; separately, hand-select several bookmarks, apply a tag, and confirm
every selected bookmark carries it.

**Acceptance Scenarios**:

1. **Given** several bookmarks, **When** the user selects multiple and applies a
   tag, **Then** every selected bookmark receives that tag.
5. **Given** an active filter or search (e.g. a tag showing 600 matches), **When**
   the user chooses "select everything matching" and applies an action, **Then**
   the action applies to the entire matching set without the user ticking each
   one individually.
2. **Given** several selected bookmarks, **When** the user archives the
   selection, **Then** all of them are archived in one action.
3. **Given** several selected bookmarks, **When** the user marks the selection as
   read or unread, **Then** all of them change to that status together.
4. **Given** several selected bookmarks, **When** the user deletes the selection
   and confirms, **Then** all of them are permanently removed in one action.

---

### User Story 7 - Save a frequently used search (Priority: P3)

A user who repeatedly applies the same combination of keyword and tag filters
(for example, "unread cooking articles") wants to save that combination and
return to it in one step, without setting it up each time.

**Why this priority**: A convenience layered on top of search and filtering; it
adds no new data and the app is fully usable without it. Nice-to-have, and
acceptable to defer if it proves costly.

**Independent Test**: Set up a search combining a keyword, a tag, and the unread
filter; save it under a name; clear everything; then reopen the saved search and
confirm the same results return.

**Acceptance Scenarios**:

1. **Given** an active combination of keyword and/or tag and/or unread filters,
   **When** the user saves it under a name, **Then** it is stored and listed as a
   named saved search.
2. **Given** a named saved search, **When** the user opens it, **Then** the app
   applies that combination of filters and shows the matching bookmarks.

---

### Edge Cases

- **Re-saving an existing address**: The app does not create a duplicate; instead
  it opens the already-saved bookmark so the user can adjust it (fix the title,
  add a tag, etc.).
- **Unreachable page on save**: If the title, site icon, or description cannot be
  retrieved (site offline, blocked, or slow), the bookmark is still saved using
  the address as its title and whatever metadata is available; saving never
  blocks on the remote page.
- **Import containing duplicates**: Addresses already in the collection are not
  added again as duplicates during import.
- **Very long titles, descriptions, or addresses**: The list display truncates
  gracefully without breaking layout; the full value remains available.
- **Deleting a tag in use**: Removing a tag from a bookmark does not delete other
  bookmarks; a tag with no remaining bookmarks simply disappears from the filter
  list.
- **Search with no matches**: A clear "no results" state is shown, with an easy
  way to clear the search.
- **Archived items in search**: Archived bookmarks do not appear in the main list
  or default search; they are found via the archive view.
- **Nested import folders**: Bookmarks nested several folders deep are still
  imported; each folder level in the path is available as a tag.
- **Bulk delete**: A bulk delete still requires a single confirmation before the
  selected bookmarks are permanently removed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to save a bookmark by providing a web
  address.
- **FR-002**: System MUST validate that the supplied address is a well-formed web
  address and reject malformed input with a clear message.
- **FR-003**: System MUST automatically capture, on a best-effort basis, the
  page's title, its site icon, and a short description for each saved bookmark,
  falling back to the address as the title when a title cannot be determined.
- **FR-004**: System MUST let the user optionally add or override the title, add
  notes, add a description, and assign one or more tags when saving or editing a
  bookmark.
- **FR-004a**: When the user assigns a tag, the system MUST suggest tags the user
  has already used that match what is being typed, so existing tags can be reused
  instead of near-duplicates being created.
- **FR-004b**: System MUST let users apply light formatting to notes (at minimum
  bold text, lists, and links) and MUST display notes with that formatting laid
  out rather than as plain text.
- **FR-005**: System MUST display saved bookmarks in a list showing at least the
  title, site icon, short description, and address.
- **FR-006**: Users MUST be able to open a bookmark's page in their web browser
  from the list.
- **FR-007**: Users MUST be able to edit an existing bookmark's title,
  description, notes, and tags.
- **FR-008**: Users MUST be able to permanently delete a bookmark, with a
  confirmation step to prevent accidental loss.
- **FR-009**: System MUST let users search bookmarks by keyword, matching against
  title, address, description, notes, and tags; search MUST ignore letter case
  and MUST treat a quoted phrase as an exact-phrase match.
- **FR-010**: System MUST let users filter bookmarks by tag, including combining
  multiple tags: showing bookmarks that carry **any** of several included tags,
  and **excluding** bookmarks that carry a specified tag (e.g. "work" but not
  "finished"). The system MUST allow a keyword search to be combined with an
  active tag filter (search within a tag).
- **FR-011**: When a user attempts to save an address that is already bookmarked,
  the system MUST open the existing bookmark for editing instead of creating a
  duplicate entry.
- **FR-012**: System MUST persist bookmarks locally on the user's own device so
  they remain available across app restarts, for a single user with no accounts
  or login.
- **FR-013**: System MUST record when each bookmark was saved and let the user
  choose the list order, defaulting to most recently saved first and offering
  alphabetical-by-title as an alternative.
- **FR-014**: System MUST let users import bookmarks from a standard browser
  bookmark export file, adding each imported bookmark to the collection without
  creating duplicates of addresses already saved. During import the system MUST
  convert each bookmark's containing folder name(s) into tags, and MUST preserve
  the original "date added" recorded in the file rather than resetting it to the
  import date.
- **FR-015**: System MUST let users export their entire bookmark collection in
  two formats: (a) a standard browser bookmark file for portability into any web
  browser, and (b) a full backup file that loses nothing — carrying tags,
  formatted notes, read/unread status, archived state, and original dates — and
  re-imports into this app with no loss. At the point of export the system MUST
  make clear which format is being produced and what each one preserves, so the
  user does not mistake the portable (lossy) file for the complete backup.
- **FR-016**: System MUST let users archive a bookmark (removing it from the main
  list while retaining it) and later restore an archived bookmark to the main
  list; archived bookmarks are excluded from the main list and default search.
- **FR-017**: System MUST let users mark a bookmark as read or unread and filter
  the collection to show only unread ("read later") bookmarks.
- **FR-018**: System MUST let users select multiple bookmarks — either by hand or
  by selecting the entire current filtered/search result set in one step — and
  apply a single action to all of them at once — at minimum: add a tag, archive,
  mark read/unread, and delete (deletion still requiring confirmation).
- **FR-019**: System SHOULD let users save a named combination of keyword and/or
  tag and/or unread filters as a saved search and reapply it in one step. (Lower
  priority; may be deferred if implementation proves costly.)

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved link. Key attributes: web address, title, site icon,
  short description, optional user notes (with light formatting), set of tags,
  date added (preserved from import where available, otherwise the save date),
  read/unread status, archived state. Belongs to the user's single local
  collection.
- **Tag**: A short user-defined label used to group and filter bookmarks, reused
  across bookmarks via suggestions to avoid near-duplicates. A bookmark may have
  many tags; a tag may apply to many bookmarks. Import folder names become tags.
- **Saved Search**: A named, reusable combination of keyword and/or tag and/or
  unread filters that the user can reapply in one step. (Associated with the
  lower-priority FR-019.)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark in under 15 seconds from opening the
  app to seeing it in the list.
- **SC-002**: A user can locate a specific bookmark in a collection of 500 in
  under 10 seconds using search or tag filtering.
- **SC-003**: 95% of saved bookmarks display a meaningful title and site icon
  (derived from the page rather than just the raw address).
- **SC-004**: Opening a saved bookmark launches the correct page on the first
  attempt in 99% of cases.
- **SC-005**: No user action results in accidental permanent loss of a bookmark
  without a confirmation step; archived bookmarks are 100% recoverable.
- **SC-006**: Saved bookmarks are still present after closing and reopening the
  app 100% of the time.
- **SC-007**: Importing a browser bookmark file of 1,000 bookmarks completes and
  makes them all searchable, with folder names carried over as tags, original
  dates preserved, and no duplicate entries for addresses already saved.
- **SC-009**: A user can apply a single action (tag, archive, mark read/unread,
  or delete) to an entire filtered set of at least 600 matching bookmarks in one
  operation, without selecting them individually.
- **SC-008**: A user can export their collection and successfully re-import the
  resulting file with no loss of bookmarks or their tags.

## Assumptions

- The app manages web-page bookmarks (http/https addresses); other link types
  (files, email addresses) are out of scope for v1.
- A single person uses the app on their own device to manage their own personal
  collection; there are no user accounts, logins, or cross-device sync in v1, and
  sharing collections between people is out of scope.
- Automatic capture of title, site icon, and description is best-effort; the app
  never blocks saving on retrieving remote page metadata.
- Import and export use a standard, widely-supported browser bookmark file format
  so bookmarks can move between this app and common web browsers.
- The app is used on a device with a web browser available to open links.
