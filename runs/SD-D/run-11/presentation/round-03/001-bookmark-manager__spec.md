# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-18

**Status**: Draft (revised after client review 2)

**Input**: User description: "I want to build an app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark with automatic metadata (Priority: P1)

A person finds a web page they want to keep and saves it by providing its
address. The app automatically collects the page's title, description, icon, and
preview image so the saved entry is rich and recognisable. The user can adjust
the title and description before saving and again at any time afterwards.

**Why this priority**: Saving with useful metadata is the core reason the app
exists and is a viable MVP on its own.

**Independent Test**: Enter a valid address, confirm the app fills in title,
description, icon, and preview image; change the title before saving; confirm
the bookmark appears in the list and persists after reload.

**Acceptance Scenarios**:

1. **Given** an empty list, **When** the user submits a valid address, **Then**
   the app fetches and displays the page's title, description, icon, and preview
   image for review before saving.
2. **Given** the metadata has been fetched, **When** the user edits the title or
   description and saves, **Then** the bookmark is stored with the edited values.
3. **Given** a saved bookmark, **When** the user later edits its title or
   description, **Then** the updated values are shown and persist after reload.
4. **Given** the target page provides no description, icon, or preview image,
   **When** the bookmark is saved, **Then** the app stores what it could collect
   and shows sensible fallbacks for the missing pieces without failing.
5. **Given** the user submits an invalid or empty address, **When** they try to
   save, **Then** the app rejects it with a clear message and saves nothing.

---

### User Story 2 - Re-saving an existing address opens it for editing (Priority: P1)

When the user saves an address that is already bookmarked, the app does not
create a duplicate. Instead it takes the user straight to the existing bookmark
so they can review or edit it.

**Why this priority**: Duplicate prevention protects the integrity of the whole
collection and is closely tied to the core save flow.

**Independent Test**: Save an address, then submit the same address again;
confirm no second entry is created and the existing bookmark is opened for
editing.

**Acceptance Scenarios**:

1. **Given** an address is already bookmarked, **When** the user submits the same
   address, **Then** no new bookmark is created and the existing one is opened
   for editing.
2. **Given** two addresses differ only in trivial ways (e.g. a trailing slash or
   letter case in the host), **When** the second is submitted, **Then** the app
   treats them as the same bookmark and opens the existing one.

---

### User Story 3 - Browse, sort, and open bookmarks (Priority: P1)

The user opens the app and sees their saved bookmarks in a list showing the
title, description, tags, and page icon. Selecting a bookmark opens the original
page. The list can be sorted, for example by date added or by title.

**Why this priority**: A saved bookmark has no value if it cannot be seen and
reopened; this is part of the minimum usable product.

**Independent Test**: With several bookmarks saved, confirm each row shows title,
description, tags, and icon; change the sort order and confirm the list reorders;
select a bookmark and confirm the original page opens.

**Acceptance Scenarios**:

1. **Given** several saved bookmarks, **When** the user opens the app, **Then**
   each bookmark is listed with its title, description, tags, and page icon.
2. **Given** the bookmark list, **When** the user selects a bookmark, **Then**
   the original page is opened.
3. **Given** the bookmark list, **When** the user chooses a sort option (e.g.
   date added or title), **Then** the list reorders accordingly and remembers the
   choice per the user's display preferences.
4. **Given** no bookmarks exist yet, **When** the user opens the app, **Then** a
   friendly empty state invites them to add their first bookmark.

---

### User Story 4 - Powerful search (Priority: P2)

The user finds bookmarks with a case-insensitive search across titles,
descriptions, notes, and addresses. The search supports tag terms like
`#travel`, exact phrases in quotation marks, and boolean combinations using AND,
OR, NOT, and parentheses.

**Why this priority**: Retrieval makes a growing collection usable; it depends on
saving existing first.

**Independent Test**: With varied bookmarks saved, run queries exercising
case-insensitivity, `#tag`, quoted phrases, and AND/OR/NOT/parentheses; confirm
only the correct bookmarks match.

**Acceptance Scenarios**:

1. **Given** bookmarks with mixed-case text, **When** the user searches a term in
   any case, **Then** matching is case-insensitive across title, description,
   note, and address.
2. **Given** tagged bookmarks, **When** the user searches `#travel`, **Then**
   only bookmarks carrying the `travel` tag are shown.
3. **Given** a query combining a tag term and an ordinary text term with no
   operator between them (e.g. `#travel japan`), **When** the search runs,
   **Then** both must match — the bookmark must carry the `travel` tag AND
   contain "japan" (implicit AND between adjacent terms).
4. **Given** a query in quotation marks, **When** the search runs, **Then** only
   bookmarks containing that exact phrase match.
5. **Given** the words AND, OR, or NOT appear unquoted, **When** the search runs,
   **Then** they are treated as boolean operators; **and given** they appear
   inside quotation marks (e.g. `"rock and roll"`), **Then** they are treated as
   ordinary search text, not operators.
6. **Given** a boolean query such as `#travel AND (japan OR korea) NOT flight`,
   **When** the search runs, **Then** results honour the AND, OR, NOT, and
   parenthesised grouping.
7. **Given** a query that matches nothing, **When** the search runs, **Then** a
   clear "no matches" state is shown.
8. **Given** a malformed query (e.g. unbalanced parentheses or quotes), **When**
   the search runs, **Then** the app shows a clear, non-destructive message
   rather than failing.

---

### User Story 5 - Rich editing: address, tags, and formatted notes (Priority: P2)

The user edits any field of a bookmark — address, title, description, tags, and a
longer free-form note. Notes support basic formatting (such as bold, italic,
lists, and links), and that formatting is preserved and rendered when the note is
viewed. When entering tags, the app suggests tags already used.

**Why this priority**: Full editing and notes turn saved links into a useful
personal knowledge store, but build on the core save/browse loop.

**Independent Test**: Edit a bookmark's address, add tags with the help of
suggestions, write a formatted note, save, and confirm the formatting renders and
all fields persist after reload.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user edits the address, title,
   description, tags, or note and saves, **Then** all changes persist and are
   shown after reload.
2. **Given** the user is writing a note, **When** they apply basic formatting
   (bold, italic, lists, links), **Then** the formatting is preserved and
   rendered when the note is later viewed.
3. **Given** the user has previously used certain tags, **When** they begin
   typing a tag, **Then** the app suggests matching existing tags to choose from.
4. **Given** the user edits an address to one that already exists on another
   bookmark, **When** they save, **Then** the app prevents creating a duplicate
   and informs the user.

---

### User Story 6 - Read-later workflow (Priority: P2)

The user marks bookmarks as unread ("read later"), views a dedicated unread list,
and marks items read when done.

**Why this priority**: A read-later flow is a distinct, valuable workflow but not
required for the app to deliver initial value.

**Independent Test**: Mark a bookmark unread, confirm it appears in the unread
view, mark it read, and confirm it leaves the unread view.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user marks it as read-later
   (unread), **Then** it appears in the dedicated unread view.
2. **Given** an unread bookmark, **When** the user marks it read, **Then** it is
   removed from the unread view while remaining in the main list.
3. **Given** a bookmark is being saved, **When** the user chooses "read later"
   during saving, **Then** it is created as unread; otherwise it is created as an
   ordinary (read) bookmark.
4. **Given** an ordinary bookmark, **When** the user marks it unread afterward,
   **Then** it appears in the unread view.

---

### User Story 7 - Archive and delete (Priority: P2)

The user archives bookmarks they want out of the way and deletes ones they no
longer need. Archived bookmarks disappear from the normal list and search, appear
in a separate archive view, and can be restored. Deletion requires confirmation.

**Why this priority**: Keeping the active collection focused preserves long-term
usefulness; distinct from destructive deletion.

**Independent Test**: Archive a bookmark and confirm it leaves the main list and
search but appears in the archive view and can be restored; delete a bookmark and
confirm it is gone after confirmation and does not reappear.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user archives it, **Then** it is removed
   from the normal list and from normal search results and appears in the archive
   view.
2. **Given** an archived bookmark, **When** the user restores it, **Then** it
   returns to the normal list and search.
3. **Given** a bookmark, **When** the user deletes it and confirms, **Then** it is
   permanently removed and does not reappear after reload.
4. **Given** a delete request, **When** the user is asked to confirm, **Then** no
   removal happens unless the user confirms.

---

### User Story 8 - Bulk actions (Priority: P3)

The user selects multiple bookmarks and changes their tags, read status, or
archive status, or deletes them together. The same actions can be applied to
every bookmark matching the current search or filter.

**Why this priority**: Bulk operations are an efficiency multiplier for large
collections but not part of the core loop.

**Independent Test**: Select several bookmarks, apply a bulk tag change and a bulk
archive, and confirm all selected items updated; then apply a bulk action to a
full search result set and confirm every match updated.

**Acceptance Scenarios**:

1. **Given** several bookmarks are selected, **When** the user applies a bulk
   change to tags, read status, or archive status, **Then** every selected
   bookmark is updated accordingly.
1a. **Given** several bookmarks with differing existing tags are selected,
   **When** the user bulk-adds or bulk-removes specific tags, **Then** only those
   tags are added or removed and each bookmark's other tags are left untouched
   (bulk tag changes never wholesale-replace a bookmark's tag set).
2. **Given** several bookmarks are selected, **When** the user bulk-deletes them
   and confirms, **Then** all selected bookmarks are removed.
3. **Given** an active search or filter, **When** the user applies a bulk action
   to "all matching items", **Then** every bookmark matching the current query is
   updated, including matches not individually selected.

---

### User Story 9 - Saved searches and filter sets (Priority: P3)

The user saves useful combinations of a search query together with included and
excluded tags, then reapplies them later by name.

**Why this priority**: Reusable searches speed up recurring retrieval but depend
on search and tagging existing first.

**Independent Test**: Build a query with included and excluded tags, save it with
a name, change the view, then reapply the saved search and confirm the same
results return.

**Acceptance Scenarios**:

1. **Given** a search query with included and excluded tags, **When** the user
   saves it with a name, **Then** it appears in a list of saved searches.
2. **Given** a saved search, **When** the user selects it, **Then** the query,
   included tags, and excluded tags are reapplied and the matching results shown.
3. **Given** a saved search, **When** the user deletes or renames it, **Then** the
   saved-search list updates accordingly.

---

### User Story 10 - Import and export (browser bookmark format) (Priority: P3)

The user imports and exports bookmarks using the standard browser bookmark file
format, preserving titles, tags, and dates.

**Why this priority**: Interoperability protects the user's investment and eases
migration, but is not needed for daily use.

**Independent Test**: Export the collection to a browser bookmark file, then
import that file into an empty collection and confirm titles, tags, and dates are
preserved.

**Acceptance Scenarios**:

1. **Given** a collection of bookmarks, **When** the user exports, **Then** a
   standard browser bookmark file is produced preserving titles, tags, and dates.
2. **Given** a standard browser bookmark file, **When** the user imports it,
   **Then** bookmarks are added with their titles, tags, and dates preserved.
3. **Given** an imported address that already exists, **When** the import runs,
   **Then** the app avoids creating a duplicate (consistent with the re-save
   behaviour).
4. **Given** a file that is not a valid browser bookmark file, **When** the user
   imports it, **Then** the app reports the problem clearly and imports nothing.

---

### User Story 11 - Local page preservation and optional web archiving (Priority: P3)

The user preserves a local copy of a bookmarked page so it remains readable even
if the original changes or disappears. Web pages are preserved as a single
self-contained HTML file; pages that are PDFs are preserved as PDFs.
Optionally, the user can also request the page be saved through the Internet
Archive.

**Why this priority**: Preservation guards against link rot and is highly
valuable, but is an enhancement beyond the core collection.

**Independent Test**: Save a bookmark and preserve a local copy; confirm the copy
can be opened from the app; for a PDF address confirm the preserved copy is a PDF;
request an Internet Archive save and confirm a reference is recorded.

**Acceptance Scenarios**:

1. **Given** a bookmarked web page, **When** the user preserves a local copy,
   **Then** the copy is stored as a single self-contained HTML file and can be
   opened later from within the app.
2. **Given** a bookmarked address that is a PDF, **When** a local copy is
   preserved, **Then** it is stored and reopened as a PDF.
3. **Given** a bookmark, **When** the user requests an Internet Archive save,
   **Then** the app submits it and records a reference to the archived version.
4. **Given** preservation or archiving cannot complete (e.g. the page or the
   external service is unavailable), **When** the attempt fails, **Then** the
   bookmark is still saved and the user is told preservation did not succeed.

---

### User Story 12 - Personal display preferences (Priority: P3)

The user sets personal display choices such as the default sort order, how many
items are shown per view, and the text size.

**Why this priority**: Comfort and readability preferences improve the experience
but are not core functionality.

**Independent Test**: Change default sort, page size, and text size; reload and
confirm the preferences are remembered and applied.

**Acceptance Scenarios**:

1. **Given** the preferences screen, **When** the user changes the default sort
   order, **Then** new views open in that order.
2. **Given** the preferences screen, **When** the user changes how many items are
   shown, **Then** lists display that many items per view.
3. **Given** the preferences screen, **When** the user changes the text size,
   **Then** the app renders text at that size and remembers it after reload.

---

### Edge Cases

- What happens when metadata cannot be fetched (page offline, blocks fetching,
  or times out)? The app still lets the user save with a derived title and manual
  entry, and shows fallbacks for missing icon/preview.
- How does the app treat addresses that differ only by trailing slash, scheme, or
  host letter case when detecting duplicates? They are normalised so obvious
  duplicates are caught.
- What happens with a very long title, description, note, or address? Stored in
  full and truncated gracefully in list views.
- What happens if a bulk action partially fails? The app reports which items
  succeeded and which did not, without silent data loss.
- How are archived bookmarks treated by saved searches and bulk "all matching"
  actions? Excluded from normal search unless the archive view is being viewed.
- What happens on import when tags or dates are missing from the file? The
  bookmark is imported with whatever fields are present and sensible defaults for
  the rest.
- What happens when a note contains formatting that the app does not support?
  Unsupported formatting is dropped safely, keeping the readable text.

## Requirements *(mandatory)*

### Functional Requirements

**Saving & metadata**

- **FR-001**: System MUST let a user save a bookmark by providing a web address.
- **FR-002**: System MUST automatically collect the page's title, description,
  icon, and preview image when a valid address is provided.
- **FR-003**: System MUST let the user edit the title and description both before
  saving and at any time after saving.
- **FR-004**: System MUST derive a readable title and show sensible fallbacks
  when metadata (description, icon, preview) is unavailable, and still allow the
  save to complete.
- **FR-005**: System MUST validate the submitted address and reject empty or
  malformed addresses with a clear message.
- **FR-006**: System MUST detect when a submitted address matches an existing
  bookmark (using normalised comparison) and, instead of creating a duplicate,
  open the existing bookmark for editing.

**Fields & editing**

- **FR-007**: System MUST let the user edit a bookmark's address, title,
  description, tags, and a longer free-form note.
- **FR-008**: System MUST support basic formatting in notes (at least bold,
  italic, lists, and links) and render that formatting when the note is viewed.
- **FR-009**: System MUST let the user assign one or more tags to a bookmark and
  suggest previously used tags while the user types.

**Browsing, list & opening**

- **FR-010**: System MUST display bookmarks in a list showing at least the
  title, description, tags, and page icon.
- **FR-011**: System MUST open the original page when the user selects a
  bookmark.
- **FR-012**: System MUST let the user sort the list, including at least by date
  added and by title.

**Search**

- **FR-013**: System MUST provide case-insensitive search across titles,
  descriptions, notes, and addresses.
- **FR-014**: System MUST support tag terms (e.g. `#travel`), exact phrases in
  quotation marks, and boolean combinations using AND, OR, NOT, and parentheses.
  Adjacent terms with no operator between them (including a tag term next to an
  ordinary text term) MUST be combined with an implicit AND — all must match. The
  words AND, OR, NOT MUST act as operators when unquoted and as ordinary search
  text when enclosed in quotation marks.
- **FR-015**: System MUST show a clear "no matches" state, and a clear,
  non-destructive message for malformed queries.

**Read-later, archive & delete**

- **FR-016**: System MUST support a read/unread ("read later") state per
  bookmark, with a dedicated unread view and the ability to mark items read or
  unread. New bookmarks MUST be created as ordinary (read) bookmarks unless the
  user chooses "read later" while saving.
- **FR-017**: System MUST let the user archive a bookmark so it is removed from
  the normal list and normal search, appears in a separate archive view, and can
  be restored.
- **FR-018**: System MUST let the user delete a bookmark, requiring confirmation
  before permanent removal.

**Bulk actions**

- **FR-019**: System MUST let the user select multiple bookmarks and apply, in
  one action, changes to tags, read status, or archive status, or delete them
  together. Bulk tag changes MUST be expressed as adding or removing specific
  tags and MUST NOT replace or discard a bookmark's other existing tags.
- **FR-020**: System MUST let the user apply those bulk actions to all bookmarks
  matching the current search or filter, not only individually selected items,
  and report partial failures without silent data loss.

**Saved searches**

- **FR-021**: System MUST let the user save named combinations of a search query
  with included and excluded tags, and reapply, rename, or delete them.

**Import & export**

- **FR-022**: System MUST import and export bookmarks using the standard browser
  bookmark file format, preserving titles, tags, and dates.
- **FR-023**: System MUST avoid creating duplicates on import, consistent with
  the re-save behaviour, and report an invalid import file without importing.

**Preservation & archiving**

- **FR-024**: System MUST let the user preserve a local copy of a bookmarked page
  that can be reopened from within the app, storing a web page as a single
  self-contained HTML file and a PDF page as a PDF.
- **FR-025**: System MUST optionally submit a page to the Internet Archive on
  request and record a reference to the archived version.
- **FR-026**: System MUST keep the bookmark saved and inform the user when
  preservation or external archiving fails.

**Preferences & persistence**

- **FR-027**: System MUST let the user set personal display preferences including
  default sort order, number of items shown per view, and text size, and remember
  them across sessions.
- **FR-028**: System MUST persist all bookmarks, tags, notes, states, saved
  searches, preferences, and preserved copies so they remain available after the
  app is closed and reopened.
- **FR-029**: System MUST show a friendly empty state when no bookmarks exist.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved web reference. Attributes: address, title, description,
  icon, preview image, tags, free-form formatted note, read/unread state,
  archived state, date added, and references to any preserved local copy and
  Internet Archive snapshot.
- **Tag**: A short label grouping related bookmarks. Many-to-many with bookmarks;
  prior tags are offered as suggestions.
- **Saved Search**: A named, reusable combination of a search query with included
  and excluded tags.
- **Preserved Copy**: A locally stored rendition of a page linked to a bookmark,
  openable offline — a single self-contained HTML file for web pages, or a PDF for
  PDF pages.
- **Preferences**: Per-user display settings — default sort order, items per view,
  and text size.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark, including automatic metadata, in
  under 20 seconds from opening the app.
- **SC-002**: A user can locate a specific bookmark among 1,000 saved entries in
  under 10 seconds using search, tags, or a saved search.
- **SC-003**: 100% of saved bookmarks, notes, tags, states, and preferences remain
  present and unchanged after closing and reopening the app.
- **SC-004**: Re-saving an already-bookmarked address never creates a duplicate in
  100% of attempts and instead opens the existing bookmark.
- **SC-005**: Exporting then re-importing a collection preserves 100% of titles,
  tags, and dates.
- **SC-006**: A preserved local copy can be reopened from within the app with no
  access to the original site.
- **SC-007**: 90% of first-time users successfully save, organise, and later
  retrieve a bookmark without external help.

## Assumptions

- Single-user personal app for v1; no accounts, sign-in, sharing, or cross-device
  sync (confirmed by client).
- The app runs as a web application accessed through a browser (confirmed).
- Bookmarks and preserved copies are stored locally to the app's environment;
  cloud backup and multi-device sync are out of scope for v1.
- Newly saved bookmarks are **ordinary (read)** by default; they only become
  unread if the user chooses "read later" while saving or marks them unread
  afterward (confirmed by client).
- A preserved web page is stored as a **single self-contained HTML file**; a PDF
  page is preserved as a **PDF** (confirmed by client).
- "Basic formatting" for notes means at least bold, italic, lists, and links;
  unsupported formatting is dropped safely.
- Duplicate detection normalises addresses (scheme, host case, trailing slash,
  common tracking noise) so obvious duplicates are caught; the exact
  normalisation rules will be refined during planning.
- The standard browser bookmark file format refers to the common HTML "Netscape
  bookmark" file that browsers import/export; tags and dates are carried using
  that format's conventional attributes.
- Internet Archive saving depends on an available external service; when it is
  unreachable the app degrades gracefully.
- Metadata and preview fetching require network access to the target page;
  fetching may be blocked or time out, in which case manual entry is available.
- Standard web app expectations apply for performance and error handling.
