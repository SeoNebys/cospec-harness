# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-17

**Status**: Draft (revision 3)

**Input**: User description: "Build an app to save and manage bookmarks." — expanded
with metadata capture, rich notes, advanced search, read status, archiving, bulk
actions, sorting, saved views, page preservation, import/export, and display
preferences.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark with rich metadata (Priority: P1)

A person finds a web page worth keeping and saves its address. The app
automatically collects the page title, description, site icon (favicon), and a
preview image when they are available, and shows them so the user can confirm or
edit the title, description, and address before or after saving.

**Why this priority**: Saving links with useful, recognizable metadata is the
core reason the app exists and makes every later feature meaningful.

**Independent Test**: Save a web address and confirm the bookmark appears with an
auto-collected title, description, icon, and preview image, and that the title,
description, and address can be edited.

**Acceptance Scenarios**:

1. **Given** an empty list, **When** the user submits a valid web address, **Then**
   the app collects the page title, description, site icon, and preview image
   when available and saves the bookmark showing them.
2. **Given** a page whose metadata cannot be retrieved, **When** the user saves,
   **Then** the bookmark is still saved using the address as its display name and
   missing metadata is simply omitted (no error).
3. **Given** a saved bookmark, **When** the user edits the title, description, or
   address, **Then** the edited values are shown and persisted, overriding the
   auto-collected values.
4. **Given** a saved bookmark, **When** the user changes its address to one that
   already exists, **Then** the app applies duplicate handling (see User Story 2)
   rather than creating a conflicting second copy.
5. **Given** a bookmark form, **When** the user submits an invalid or empty
   address, **Then** the app rejects it with a clear message and saves nothing.

---

### User Story 2 - Saving a duplicate address opens the existing bookmark (Priority: P1)

When the user saves an address that is already bookmarked, the app takes them to
the existing bookmark so they can update it, instead of creating a second copy or
only showing a warning.

**Why this priority**: Prevents clutter and data loss and matches the user's
expectation that re-saving means "update what I already have."

**Independent Test**: Save an address, then save the same address again; confirm
the app opens the existing bookmark for editing and no duplicate is created.

**Acceptance Scenarios**:

1. **Given** an address already saved (including an archived bookmark), **When**
   the user saves the same address, **Then** the app opens the existing bookmark
   in an editable state rather than creating a new one.
2. **Given** the matched bookmark was archived, **When** it is opened via a
   duplicate save, **Then** the user is informed it is archived and offered the
   option to restore it.
3. **Given** two addresses that differ only by host capitalization, a standard
   default port, or a single trailing slash on the path, **When** the user saves
   the second, **Then** the app treats them as the same bookmark (see FR-041 for
   the matching rules).
4. **Given** two addresses that differ only by a fragment (e.g., `#section`) or a
   query parameter, **When** the user saves the second, **Then** the app treats
   them as **different** bookmarks unless the differing part is a known-harmless
   one that does not change the destination.

---

### User Story 3 - Browse and reopen bookmarks (Priority: P1)

The user opens the app to a readable list that emphasizes each bookmark's title,
description, tags, and site icon, and clicks a bookmark to open the original page.

**Why this priority**: Saved bookmarks have no value unless they can be found,
recognized at a glance, and reopened.

**Independent Test**: With several bookmarks saved, confirm the list shows title,
description, tags, and icon prominently, and that selecting one opens the correct
page.

**Acceptance Scenarios**:

1. **Given** multiple saved bookmarks, **When** the user opens the app, **Then**
   each is listed emphasizing title, description, tags, and site icon.
2. **Given** a bookmark in the list, **When** the user selects it, **Then** the
   original web page opens in a new browser tab.
3. **Given** a bookmark showing one or more tags, **When** the user clicks a tag
   displayed on the bookmark, **Then** the list is immediately filtered to
   bookmarks carrying that tag (without the user typing a `#tag` search).
4. **Given** an empty collection, **When** the user opens the app, **Then** a
   friendly empty state invites them to add their first bookmark.

---

### User Story 4 - Descriptions and formatted notes (Priority: P2)

Beyond the short description, the user records their own longer notes on a
bookmark using basic formatting (headings, bold/italic, lists, links) to capture
why it matters.

**Why this priority**: Turns a link list into a personal knowledge store; builds
on core saving but is not required for the minimum loop.

**Independent Test**: Add a formatted note to a bookmark, reopen it, and confirm
the formatting and content are preserved.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user enters a note with basic formatting,
   **Then** the formatted note is saved and re-displayed with its formatting.
2. **Given** a bookmark with a note, **When** the user edits or clears the note,
   **Then** the change persists.
3. **Given** a description field, **When** the user edits it, **Then** it is kept
   distinct from the longer formatted note.

---

### User Story 5 - Tagging with suggestions from existing tags (Priority: P2)

While tagging a bookmark, the user sees suggestions drawn from tags they already
use, so tags stay consistent and are quick to apply.

**Why this priority**: Consistent tags are the backbone of organization, search,
and saved views.

**Independent Test**: With some tags already in use, begin typing a tag and
confirm matching existing tags are suggested and can be selected.

**Acceptance Scenarios**:

1. **Given** existing tags, **When** the user types part of a tag name, **Then**
   matching existing tags are suggested for selection.
2. **Given** a suggestion list, **When** the user picks a suggestion, **Then**
   that existing tag is applied (no near-duplicate tag is created).
3. **Given** no matching existing tag, **When** the user confirms a new tag name,
   **Then** a new tag is created and applied.

---

### User Story 6 - Powerful search (Priority: P1)

The user searches across titles, descriptions, notes, addresses, and tags
without worrying about capitalization, and can use exact phrases, `#tag` terms,
and boolean combinations (AND, OR, NOT) with parentheses for precise results.

**Why this priority**: Finding the right bookmark quickly is essential once a
collection grows; it is the second half of the core value loop.

**Independent Test**: Save varied bookmarks, then run case-insensitive keyword,
exact-phrase, `#tag`, and combined boolean queries and confirm results match the
expected sets.

**Acceptance Scenarios**:

1. **Given** bookmarks with varied content, **When** the user searches a keyword,
   **Then** matches are found across title, description, note, address, and tags
   regardless of letter case.
2. **Given** a query in quotation marks, **When** the user searches, **Then** only
   bookmarks containing that exact phrase are returned.
3. **Given** a `#tag` term, **When** the user searches, **Then** only bookmarks
   carrying that tag are returned.
4. **Given** a query using AND, OR, NOT and parentheses (e.g.,
   `(#recipe OR #cooking) AND pasta NOT #dessert`), **When** the user searches,
   **Then** results respect the boolean logic and grouping.
5. **Given** a query where AND, OR, or NOT appears inside quotation marks (e.g.,
   `"rock and roll"`), **When** the user searches, **Then** those words are
   treated as ordinary search text, not as boolean operators.
6. **Given** a query with no matches, **When** the user searches, **Then** a
   clear no-results state is shown, not an error.
7. **Given** any search, **When** results are shown, **Then** archived bookmarks
   are excluded unless the user is explicitly viewing the archive.

---

### User Story 7 - Read-later status and unread view (Priority: P2)

The user marks bookmarks as read or unread (read-later) and switches to a
separate view that shows only unread items.

**Why this priority**: Supports the common "save now, read later" workflow that
distinguishes a bookmark manager from a plain link dump.

**Independent Test**: Mark some bookmarks unread, open the unread view, and
confirm only unread items appear; mark one read and confirm it leaves the view.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user sets its read status, **Then** the
   status is shown and persisted.
2. **Given** newly saved bookmarks, **When** they are created, **Then** they
   default to unread. (Default recorded in Assumptions.)
3. **Given** a mix of read and unread bookmarks, **When** the user opens the
   unread view, **Then** only unread, non-archived bookmarks are shown.

---

### User Story 8 - Archiving as a reversible action (Priority: P2)

The user archives bookmarks they want out of the way but not gone. Archived items
are excluded from normal browsing and search, live in a separate archive view,
and can be restored.

**Why this priority**: Lets users declutter without the finality of deletion.

**Independent Test**: Archive a bookmark, confirm it disappears from normal
browsing and search, find it in the archive view, and restore it.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user archives it, **Then** it is excluded
   from normal browsing, search, filters, and the unread view.
2. **Given** an archived bookmark, **When** the user opens the archive view,
   **Then** it is listed there and can be restored to normal status.
3. **Given** an archived bookmark, **When** the user restores it, **Then** it
   reappears in normal browsing with its prior tags, notes, and read status
   intact.

---

### User Story 9 - Bulk actions on selections (Priority: P2)

The user selects several bookmarks — individually, or everything matching the
current search/filter — and applies an action to all of them at once: add/remove
tags, set read status, archive/restore, or delete.

**Why this priority**: Makes managing large collections practical.

**Independent Test**: Select multiple bookmarks (and "select all matching"),
apply a tag and an archive action, and confirm all selected items are updated.

**Acceptance Scenarios**:

1. **Given** a list, **When** the user selects multiple bookmarks, **Then** a
   bulk-action control shows the count and available actions.
2. **Given** an active search or filter, **When** the user chooses "select all
   matching", **Then** every bookmark matching the current query is selected,
   including matches not currently on screen.
3. **Given** a selection, **When** the user applies tagging, read status, or
   archiving, **Then** all selected bookmarks are updated consistently.
4. **Given** a selection, **When** the user chooses delete, **Then** the app asks
   for confirmation before permanently removing all selected bookmarks.

---

### User Story 10 - Sorting the list (Priority: P2)

The user orders the bookmark list by different criteria to suit the task at hand.

**Why this priority**: Complements search and browsing for finding and reviewing
bookmarks.

**Independent Test**: Switch sort order and confirm the list reorders accordingly
and the choice persists per the display preferences.

**Acceptance Scenarios**:

1. **Given** a list, **When** the user chooses a sort option (e.g., date added,
   title, last updated, read status), **Then** the list reorders accordingly.
2. **Given** a chosen sort order, **When** the user returns later, **Then** the
   default sort from display preferences is applied.

---

### User Story 11 - Saved views (reusable searches + tag filters) (Priority: P3)

The user saves a combination of a search query and included/excluded tags as a
named view they can reopen with one click.

**Why this priority**: Speeds up recurring workflows for power users; valuable but
beyond the core loop.

**Independent Test**: Create a saved view from a query plus included/excluded
tags, reopen it later, and confirm it reproduces the same result set.

**Acceptance Scenarios**:

1. **Given** an active search with included and excluded tags, **When** the user
   saves it as a named view, **Then** the view appears in a list of saved views.
2. **Given** a saved view, **When** the user opens it, **Then** the same search
   and tag filters are re-applied and current matching results are shown.
3. **Given** a saved view, **When** the user renames or deletes it, **Then** the
   change persists and does not affect the underlying bookmarks.

---

### User Story 12 - Preserving a copy of a page (Priority: P3)

The user preserves a local copy of a bookmarked page so its content survives if
the original changes or disappears. For a normal web page the local copy is a
single self-contained HTML file (with its needed assets embedded). For a PDF
link the PDF file itself is stored. The user can also request preservation
through the Internet Archive.

**Why this priority**: Protects against link rot; a valuable safeguard but not
part of the minimum loop.

**Independent Test**: Preserve a normal page and confirm a local copy is viewable;
preserve a PDF link and confirm the file is downloaded; request Internet Archive
preservation and confirm a resulting archive reference is stored.

**Acceptance Scenarios**:

1. **Given** a bookmarked web page, **When** the user preserves it, **Then** a
   single self-contained HTML file (with needed assets embedded) is stored and
   can be opened later from the bookmark.
2. **Given** a bookmark whose address is a PDF, **When** the user preserves it,
   **Then** the PDF file itself is downloaded and retained.
3. **Given** a bookmark, **When** the user requests Internet Archive
   preservation, **Then** the app submits it and stores the returned archive
   reference on the bookmark.
4. **Given** preservation cannot be completed (unreachable page or archive
   service unavailable), **When** the user attempts it, **Then** the app reports
   the failure clearly and the bookmark itself is unaffected.

---

### User Story 13 - Import and export browser bookmark files (Priority: P2)

The user imports an existing standard browser bookmark file to bring their
collection in, and exports to the same standard format to take it elsewhere,
retaining titles, tags, and dates.

**Why this priority**: Removes the cost of switching to the app and avoids
lock-in.

**Independent Test**: Import a standard bookmark file and confirm titles, tags,
and dates are retained; export and confirm the file opens in a browser with the
same data.

**Acceptance Scenarios**:

1. **Given** a standard browser bookmark file, **When** the user imports it,
   **Then** bookmarks are added retaining their titles, tags/folders, and dates.
2. **Given** an import that includes an address already saved, **When** it is
   imported, **Then** the existing bookmark is kept as-is — its own title,
   description, note, read status, archive status, and dates are retained — and
   only imported tags it does not already have are added. No duplicate is
   created.
3. **Given** a collection, **When** the user exports, **Then** a standard browser
   bookmark file is produced that retains titles, tags, and dates.

---

### User Story 14 - Display preferences (Priority: P3)

The user sets preferences for how the list looks and behaves: default sort order,
number of items shown per page, and text size.

**Why this priority**: Personalization and readability; a refinement on top of a
working app.

**Independent Test**: Change default sort, items-per-page, and text size, then
reopen the app and confirm the preferences are applied.

**Acceptance Scenarios**:

1. **Given** the preferences screen, **When** the user changes default sort,
   items per page, or text size, **Then** the settings persist and apply to the
   list.
2. **Given** more bookmarks than the items-per-page setting, **When** the list is
   shown, **Then** the user can move through the collection in pages.

---

### Edge Cases

- **Duplicate save**: opens the existing bookmark for editing; if it was
  archived, offers restore. Never creates a second copy.
- **Address normalization**: addresses differing only by host letter case, a
  standard default port (80 for http, 443 for https), or a single trailing slash
  on the path are treated as the same bookmark. Differences in fragment or query
  parameters are treated as **different** bookmarks unless the differing part is
  on a maintained list of known-harmless items that do not change the
  destination (see FR-041).
- **Metadata unavailable**: title/description/icon/preview are omitted
  gracefully; the address becomes the display name.
- **Unreachable or dead page**: the bookmark remains; reachability is not
  guaranteed; preservation of an unreachable page reports failure.
- **Empty / no-results states**: distinct friendly messages for an empty
  collection, an empty search result, an empty unread view, and an empty archive.
- **Conflicting search syntax**: a malformed boolean query is reported clearly
  rather than silently returning wrong results.
- **Search + status interaction**: search and filters never return archived
  items unless the archive view is active; the unread view only shows unread,
  non-archived items.
- **Bulk "select all matching" then change of query**: the selection reflects the
  query at the moment the action is applied and the user is shown the affected
  count before a destructive action.
- **Import of a very large file / malformed file**: import reports how many
  entries were added, merged, and skipped, and never partially corrupts existing
  data.
- **Very long titles/descriptions/notes**: displayed truncated; full values
  preserved and shown on open.
- **Tag suggestions**: matching is case-insensitive and prevents creating a tag
  that only differs from an existing one by case or surrounding whitespace.

## Requirements *(mandatory)*

### Functional Requirements

**Saving & metadata**

- **FR-001**: The app MUST let a user save a bookmark from a web address.
- **FR-002**: On save, the app MUST attempt to collect the page title,
  description, site icon, and preview image, and store those that are available.
- **FR-003**: The app MUST let the user edit the title, description, and address
  of a bookmark (in addition to its tags and note), and these edits MUST override
  auto-collected values. Editing an address to one that already exists MUST be
  handled by the duplicate rules in FR-007.
- **FR-004**: The app MUST validate the address as a well-formed web (http/https)
  address and reject invalid input with a clear message, saving nothing.
- **FR-005**: When metadata cannot be retrieved, the app MUST still save the
  bookmark using the address as its display name, omitting missing fields.
- **FR-006**: The app MUST persist all bookmark data so it survives app restarts
  and separate visits.

**Duplicates**

- **FR-007**: When the user saves an address that already exists (after
  normalization, including archived items), the app MUST open the existing
  bookmark in an editable state instead of creating a duplicate.
- **FR-008**: When a duplicate save matches an archived bookmark, the app MUST
  inform the user it is archived and offer to restore it.
- **FR-041**: The app MUST determine whether two addresses refer to the same
  bookmark using these normalization rules, and no others by default:
  - Host comparison is case-insensitive.
  - A standard default port (80 for http, 443 for https) is equivalent to no
    port.
  - A single trailing slash on the path is ignored.
  - The scheme, remaining path, query parameters, and fragment are otherwise
    compared exactly; addresses that differ in a fragment or a query parameter
    are treated as **different** bookmarks.
  - The app MUST NOT strip fragments or query parameters wholesale. It MAY ignore
    a specific fragment or query parameter only when it appears on a maintained
    list of items known not to change the destination.

**Notes & descriptions**

- **FR-009**: The app MUST support a short description and a separate longer note
  per bookmark, with the note supporting basic formatting (headings,
  bold/italic, lists, links).
- **FR-010**: The app MUST preserve note formatting and content across edits and
  reloads.

**Tags**

- **FR-011**: Users MUST be able to assign zero or more tags to a bookmark.
- **FR-012**: While entering a tag, the app MUST suggest matching existing tags
  (case-insensitive) and apply the selected existing tag rather than creating a
  near-duplicate.
- **FR-013**: The app MUST let a new tag be created when no existing tag matches.

**Browsing & display**

- **FR-014**: The app MUST display bookmarks in a list emphasizing title,
  description, tags, and site icon.
- **FR-014a**: Clicking a tag shown on a bookmark in the list MUST immediately
  filter the list to bookmarks carrying that tag, without requiring the user to
  type a `#tag` search.
- **FR-015**: Users MUST be able to open a bookmarked page in a new browser tab.
- **FR-016**: The app MUST show distinct, friendly states for an empty
  collection, empty search results, an empty unread view, and an empty archive.

**Search**

- **FR-017**: Search MUST match across titles, descriptions, notes, addresses,
  and tags, case-insensitively.
- **FR-018**: Search MUST support exact-phrase queries (quoted), `#tag` terms,
  and boolean AND, OR, NOT with parentheses for grouping. When AND, OR, or NOT
  appears inside quotation marks, it MUST be treated as ordinary search text
  rather than a boolean operator.
- **FR-019**: A malformed search query MUST be reported clearly rather than
  returning misleading results.
- **FR-020**: Search and filtering MUST exclude archived bookmarks unless the
  archive view is active.

**Read status**

- **FR-021**: Users MUST be able to set a bookmark's read/unread (read-later)
  status, which MUST persist; newly saved bookmarks default to unread.
- **FR-022**: The app MUST provide a separate unread view showing only unread,
  non-archived bookmarks.

**Archiving**

- **FR-023**: Users MUST be able to archive a bookmark, excluding it from normal
  browsing, search, filters, and the unread view.
- **FR-024**: The app MUST provide an archive view and let users restore archived
  bookmarks with their tags, notes, and read status intact.

**Bulk actions**

- **FR-025**: Users MUST be able to select multiple bookmarks, and to select all
  bookmarks matching the current search/filter (including off-screen matches).
- **FR-026**: The app MUST let users apply tagging, read-status changes,
  archiving/restoring, and deletion to a selection.
- **FR-027**: Bulk deletion (and any destructive bulk action) MUST show the
  affected count and require confirmation before proceeding.

**Sorting**

- **FR-028**: Users MUST be able to sort the list by criteria including date
  added, title, last updated, and read status.

**Saved views**

- **FR-029**: Users MUST be able to save a named combination of a search query
  and included/excluded tags, and reopen, rename, or delete such saved views.
- **FR-030**: Opening a saved view MUST re-apply its search and tag filters and
  show current matching results.

**Preservation**

- **FR-031**: Users MUST be able to preserve a local copy of a bookmarked web
  page as a single self-contained HTML file (with its needed assets embedded),
  viewable later from the bookmark.
- **FR-032**: For a bookmark whose address is a PDF, preservation MUST store and
  retain the PDF file itself (not an HTML rendering).
- **FR-033**: Users MUST be able to request preservation through the Internet
  Archive, and the app MUST store the returned archive reference on the bookmark.
- **FR-034**: When preservation fails (unreachable page or archive service
  unavailable), the app MUST report the failure clearly without affecting the
  bookmark.

**Import / export**

- **FR-035**: The app MUST import standard browser bookmark files, retaining
  titles, tags, and dates.
- **FR-036**: Imported addresses that already exist MUST merge into the existing
  bookmark rather than duplicate it. The merge MUST retain the existing
  bookmark's own title, description, note, read status, archive status, and
  dates, and MUST add only imported tags the bookmark does not already have.
  Import MUST report counts of added, merged, and skipped entries.
- **FR-037**: The app MUST export to a standard browser bookmark file retaining
  titles, tags, and dates.

**Deletion**

- **FR-038**: Users MUST be able to delete a bookmark, with confirmation before
  permanent removal.

**Display preferences**

- **FR-039**: Users MUST be able to set display preferences for default sort
  order, number of items shown per page, and text size, and these MUST persist
  and apply to the list.
- **FR-040**: When the collection exceeds the items-per-page setting, the app
  MUST let the user page through the full collection.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved web reference. Attributes: normalized web address,
  display title, short description, formatted note, site icon, preview image,
  read/unread status, archived flag, creation date, last-updated date, associated
  tags, preservation references (local copy, downloaded file, Internet Archive
  reference).
- **Tag**: A short user-defined label used to group and filter bookmarks.
  Attributes: name (case-insensitive unique); related to many bookmarks.
- **Saved View**: A reusable named combination of a search query and
  included/excluded tags. Attributes: name, query, included tags, excluded tags.
- **Preserved Copy**: A retained representation of a bookmarked page. Attributes:
  type (self-contained HTML page copy, downloaded PDF file, or Internet Archive
  reference), location/reference, capture date, related bookmark.
- **Display Preferences**: Per-user settings. Attributes: default sort order,
  items per page, text size.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark with auto-collected metadata in under
  15 seconds from opening the app.
- **SC-002**: A user can locate a specific bookmark among at least 1,000 saved
  items in under 10 seconds using search, filters, or a saved view.
- **SC-003**: Search results (including phrase, `#tag`, and boolean queries)
  appear to the user instantly (no perceptible wait) for collections up to 5,000
  bookmarks.
- **SC-004**: 95% of first-time users successfully save, find, and reopen a
  bookmark without external help.
- **SC-005**: Saved bookmarks and their metadata, tags, notes, and status are
  retained with 100% fidelity across app restarts (no lost or altered entries).
- **SC-006**: Re-saving an existing address results in zero duplicate bookmarks
  in 100% of cases.
- **SC-007**: Importing then exporting a standard bookmark file retains 100% of
  titles, tags, and dates for supported entries.
- **SC-008**: A user can apply a bulk action (e.g., tag or archive) to all items
  matching a search in under 10 seconds regardless of how many match.
- **SC-009**: Archived items never appear in normal browsing, search, filters, or
  the unread view (0 leaks).

## Assumptions

- This is a single-user application for v1; no sign-in, multi-user accounts, or
  sharing. Browser extensions are out of scope for this version.
- The app is desktop-first, accessed through a web browser; dedicated mobile
  layouts are a later enhancement.
- Bookmarks and preserved copies are stored in the app's own local persistence;
  the only external services used are best-effort metadata fetching and, on
  request, the Internet Archive.
- Metadata collection (title, description, icon, preview) is best-effort; if a
  page is unreachable or blocks it, missing fields are omitted.
- Address matching is settled in FR-041: addresses are the same bookmark only
  when they differ solely by host letter case, a standard default port, or a
  single trailing slash. Fragments and query parameters are otherwise treated as
  significant (they can identify different content) and are never stripped
  wholesale; a specific fragment or parameter may be ignored only if it is on a
  maintained known-harmless list.
- "Standard browser bookmark file" refers to the common HTML bookmark export
  format shared across major browsers; tags map to that format's folder/tag
  structure on import and export.
- Newly saved bookmarks default to unread.
- Formatted notes support a basic, safe set of formatting; arbitrary embedded
  scripts or unsafe content are not permitted.
- Internet Archive preservation depends on that external service being reachable;
  its availability is outside the app's control.
- "Web address" means standard http/https links; other schemes are out of scope.
