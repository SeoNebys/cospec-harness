# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-27

**Status**: Draft (revised after client review round 1)

**Input**: User description: "An app to save and manage bookmarks" plus client
review expectations (single-user; auto metadata capture; advanced search;
read-later; bulk actions; archive; rich notes; saved filters; offline/PDF/
Internet Archive preservation; browser HTML import/export; display preferences).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark with automatic details (Priority: P1)

A user finds a web page and saves it by providing its address. The app
automatically collects the page's title, description, favicon, and a preview
image so the entry is rich without manual effort. The user can adjust the title
and description either before confirming the save or at any time afterward. If
the address is already saved, the app takes the user straight to the existing
bookmark to edit rather than creating a duplicate.

**Why this priority**: Saving links with useful, auto-populated details is the
core reason the app exists. This story alone is a usable product.

**Independent Test**: Add a link, confirm title/description/favicon/preview are
auto-filled, edit the title, reload, and confirm the saved bookmark persists with
edits. Re-add the same address and confirm the app opens the existing entry for
editing.

**Acceptance Scenarios**:

1. **Given** an empty collection, **When** the user submits a valid web address,
   **Then** the app retrieves and stores the page's title, description, favicon,
   and preview image, and the bookmark appears in the list.
2. **Given** the app is retrieving details, **When** the user reviews the entry
   before confirming, **Then** they can edit the title and description prior to
   saving.
3. **Given** a saved bookmark, **When** the user edits its title or description
   later, **Then** the changes are saved and displayed.
4. **Given** metadata retrieval fails or is incomplete (unreachable page,
   missing tags), **When** the user saves, **Then** the bookmark is still saved
   with whatever was obtained plus a readable fallback title derived from the
   address, and the user can fill in the rest manually.
5. **Given** an address that already exists in the collection, **When** the user
   tries to save it again, **Then** the app opens the existing bookmark for
   editing instead of creating a duplicate.
6. **Given** the user submits an invalid or empty address, **When** they try to
   save, **Then** the app rejects it with a clear message and saves nothing.

---

### User Story 2 - Browse, sort, and find bookmarks (Priority: P1)

A user opens the app to see their collection and locate a specific bookmark.
Each entry clearly shows its title, description, tags, and favicon. The user can
sort the list and run rich searches to narrow it down.

**Why this priority**: A collection is only useful if items are visible and
findable. Retrieval is essential to a usable product alongside saving.

**Independent Test**: Seed several bookmarks, confirm each row shows
title/description/tags/favicon, sort by title and by date added, then run keyword,
phrase, `#tag`, and boolean searches and confirm correct matches.

**Acceptance Scenarios**:

1. **Given** saved bookmarks, **When** the user opens the app, **Then** each
   bookmark is listed showing at least its title, description, tags, and favicon.
2. **Given** saved bookmarks, **When** the user chooses a sort option, **Then**
   the list reorders accordingly, supporting at least "date added" and "title"
   (each ascending and descending).
3. **Given** a search term, **When** the user searches, **Then** matching is
   case-insensitive and covers title, description, notes, and address.
4. **Given** a quoted phrase (e.g., `"machine learning"`), **When** the user
   searches, **Then** only bookmarks containing that exact phrase match.
5. **Given** a `#tag` term, **When** the user searches, **Then** only bookmarks
   carrying that tag match.
6. **Given** a boolean query using `AND`, `OR`, `NOT`, and parentheses (e.g.,
   `(#news OR #blog) AND climate NOT opinion`), **When** the user searches,
   **Then** results honor the boolean logic and grouping.
7. **Given** a search or filter that matches nothing, **When** results are
   shown, **Then** the app presents a clear "no results" state.

---

### User Story 3 - Read-later workflow (Priority: P2)

A user saves pages to read later, reviews everything still unread in a dedicated
view, and marks items as read once done.

**Why this priority**: A read-later state is a primary way the user intends to
work with the collection; it shapes browsing and bulk actions.

**Independent Test**: Save items (default unread), open the unread view and
confirm only unread items appear, mark one read, and confirm it leaves the unread
view.

**Acceptance Scenarios**:

1. **Given** a newly saved bookmark, **When** it is created, **Then** it starts
   in the unread ("read later") state by default.
2. **Given** unread and read bookmarks, **When** the user opens the unread view,
   **Then** only unread bookmarks are shown.
3. **Given** a bookmark, **When** the user marks it read (or unread), **Then**
   its state updates and it appears/disappears from the unread view accordingly.

---

### User Story 4 - Edit and delete bookmarks (Priority: P2)

A user keeps the collection accurate by editing details or removing bookmarks
that are no longer relevant.

**Why this priority**: Managing, not just saving, is explicit in the request.

**Independent Test**: Edit a bookmark's fields and confirm persistence; delete a
bookmark and confirm it does not reappear after reload.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user edits its title, description,
   address, notes, or tags, **Then** the updated values are saved and shown.
2. **Given** a saved bookmark, **When** the user deletes it, **Then** it is
   removed and does not reappear after reload.
3. **Given** a delete action, **When** the user triggers it, **Then** the app
   guards against accidental loss with a confirmation or undo.

---

### User Story 5 - Organize with tags and tag suggestions (Priority: P2)

A user labels bookmarks with tags to group them, aided by suggestions of
existing tags while typing, and filters the list to a chosen tag.

**Why this priority**: Tagging underpins organization, filtering, saved filters,
and `#tag` search. Suggestions keep tags consistent (avoiding near-duplicates).

**Independent Test**: Add tags to bookmarks, confirm existing tags are suggested
during entry, filter by a tag, and confirm only matching bookmarks appear.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user adds or removes tags, **Then** the
   tags are saved and displayed with the bookmark.
2. **Given** existing tags in the collection, **When** the user types in the tag
   field, **Then** matching existing tags are suggested for selection.
3. **Given** tagged bookmarks, **When** the user filters by a tag, **Then** only
   bookmarks carrying that tag are shown.

---

### User Story 6 - Bulk actions on selections (Priority: P2)

A user selects several bookmarks—or all bookmarks matching the current search or
filter—and applies one action to all of them at once.

**Why this priority**: Managing a large collection efficiently depends on acting
on many items together.

**Independent Test**: Select multiple bookmarks (and separately "select all
matching"), then add/remove a tag, mark read/unread, archive, and delete, each
confirmed to affect exactly the selected set.

**Acceptance Scenarios**:

1. **Given** a list, **When** the user selects several bookmarks, **Then** they
   can add tags, remove tags, mark read, mark unread, archive, or delete all
   selected in one action.
2. **Given** an active search or filter, **When** the user chooses "select all
   matching", **Then** the bulk action applies to every bookmark matching the
   current query, including those not currently on screen.
3. **Given** a bulk destructive action (delete), **When** it is triggered,
   **Then** the app guards against accidental loss with a confirmation or undo.

---

### User Story 7 - Archive bookmarks (Priority: P2)

A user archives bookmarks they want out of the way but not gone. Archived items
are hidden from the normal list and search, live in their own view, and can be
restored. Archiving is clearly different from deleting.

**Why this priority**: Archiving lets users declutter without losing anything;
it is explicitly required to be reversible and distinct from deletion.

**Independent Test**: Archive a bookmark, confirm it disappears from the normal
list and normal search, appears in the archive view, then restore it and confirm
it returns to the normal list.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user archives it, **Then** it is hidden
   from the normal list and normal search results.
2. **Given** archived bookmarks, **When** the user opens the archive view,
   **Then** only archived bookmarks are shown.
3. **Given** an archived bookmark, **When** the user restores it, **Then** it
   returns to the normal list; archiving never removes data as deletion does.

---

### User Story 8 - Notes with simple formatting (Priority: P3)

A user records notes on a bookmark using simple formatting (such as bold,
italic, lists, and links) and sees the formatting rendered when viewing the
bookmark.

**Why this priority**: Richer notes add value but are not required for the core
save/find/manage loop.

**Independent Test**: Add a note with bold text and a bulleted list, save, and
confirm the formatting renders correctly on view and is preserved after reload.

**Acceptance Scenarios**:

1. **Given** the notes field, **When** the user applies simple formatting,
   **Then** it is saved with the bookmark.
2. **Given** a bookmark with formatted notes, **When** the user views it,
   **Then** the formatting is displayed correctly (not shown as raw markup).

---

### User Story 9 - Saved filters (Priority: P3)

A user saves a combination of a search query with included and excluded tags as
a named filter, and reapplies it later in one click.

**Why this priority**: Saved filters speed up recurring workflows once search and
tags exist.

**Independent Test**: Create a saved filter combining a search term with one
included and one excluded tag, apply it, and confirm the resulting list matches
the definition; confirm it persists across reload.

**Acceptance Scenarios**:

1. **Given** a search plus included/excluded tags, **When** the user saves it as
   a named filter, **Then** the filter is stored and listed for reuse.
2. **Given** a saved filter, **When** the user applies it, **Then** the list
   shows exactly the bookmarks matching the search and tag inclusions/exclusions.
3. **Given** a saved filter, **When** the user edits or deletes it, **Then** the
   change persists.

---

### User Story 10 - Preserve an offline copy (Priority: P3)

A user preserves a copy of a saved page so its content survives even if the
original changes or disappears. Web pages are captured as an offline copy where
possible, PDFs are stored as PDFs, and the user can optionally request
preservation through the Internet Archive.

**Why this priority**: Preservation protects against link rot but is an
enhancement beyond core management.

**Independent Test**: Save a normal web page and confirm an offline copy is
viewable; save a PDF link and confirm it is stored/served as a PDF; trigger
Internet Archive preservation and confirm a link to the archived snapshot is
recorded.

**Acceptance Scenarios**:

1. **Given** a saved web page, **When** preservation runs, **Then** an offline
   copy is stored and can be opened later, on a best-effort basis.
2. **Given** the target is a PDF, **When** it is saved, **Then** it is preserved
   and served as a PDF.
3. **Given** a bookmark, **When** the user requests Internet Archive
   preservation, **Then** the app submits it and records a link to the archived
   snapshot.
4. **Given** a page that cannot be captured (e.g., login-only content), **When**
   preservation is attempted, **Then** the bookmark is still saved and the app
   indicates that an offline copy is unavailable.

---

### User Story 11 - Import and export (Priority: P3)

A user imports bookmarks from a browser export file and exports their collection
in the same common format, keeping titles, tags, and saved dates intact.

**Why this priority**: Import/export enables migration and backup but is not part
of the core loop.

**Independent Test**: Import a standard browser bookmark HTML file and confirm
titles, tags, and saved dates are retained; export and confirm the file opens in
a browser and round-trips back into the app.

**Acceptance Scenarios**:

1. **Given** a standard browser bookmark HTML file, **When** the user imports
   it, **Then** bookmarks are added with their titles, tags, and saved dates
   preserved.
2. **Given** the collection, **When** the user exports, **Then** a standard
   browser bookmark HTML file is produced retaining titles, tags, and saved
   dates.
3. **Given** an import containing addresses already present, **When** it runs,
   **Then** duplicates are not created (existing entries are matched, per the
   duplicate rule).

---

### User Story 12 - Personal display preferences (Priority: P3)

A user adjusts how the app presents their collection, including the default sort
order, how much detail each row shows (density), and the text size.

**Why this priority**: Personalization improves comfort but is not core to
managing bookmarks.

**Independent Test**: Change default sort, density, and text size; confirm the
list reflects each and the preferences persist across reload.

**Acceptance Scenarios**:

1. **Given** the preferences, **When** the user sets a default sort order,
   **Then** new sessions open the list in that order.
2. **Given** the preferences, **When** the user changes display density (how
   much is shown per item), **Then** the list updates accordingly.
3. **Given** the preferences, **When** the user changes text size, **Then** the
   interface text scales accordingly, and all preferences persist across reload.

---

### Edge Cases

- **Metadata fetch fails / slow page**: Bookmark still saves with a fallback
  title from the address; missing favicon/preview/description degrade gracefully.
- **Duplicate address**: Re-saving opens the existing bookmark for editing;
  addresses are matched after normalization (scheme, trailing slash, case of
  host) so trivial variants are treated as the same.
- **Address without a scheme** (e.g., `example.com`): normalized to a usable link
  rather than rejected.
- **Ambiguous or malformed search query** (unbalanced brackets, trailing `AND`):
  the app handles it gracefully—either a best-effort interpretation or a clear
  message—without crashing or returning misleading results.
- **`#tag` for a non-existent tag**: returns an empty result set with the
  "no results" state.
- **Archived items and search/filters**: archived items never appear in normal
  search, tag filters, or saved-filter results; they are reachable only from the
  archive view.
- **Bulk "select all matching" on large sets**: applies to the entire matching
  set consistently, including off-screen items, and remains responsive.
- **Delete vs. archive confusion**: destructive delete is clearly separated from
  reversible archive in the interface.
- **Notes formatting safety**: formatted notes render safely without allowing the
  content to break or alter the surrounding interface.
- **Import with malformed or partial file**: valid entries import; invalid ones
  are skipped with a summary, without aborting the whole import.
- **PDF vs. web page detection**: the app recognizes PDF targets and preserves
  them as PDFs rather than as an HTML capture.
- **Internet Archive unavailable**: the request is reported as failed/pending and
  can be retried; it never blocks saving the bookmark.
- **Empty states**: distinct, friendly empty states for an empty collection, an
  empty unread view, an empty archive, and no-results searches.
- **Large collection**: list, search, sort, and bulk actions remain responsive
  with hundreds of bookmarks.

## Requirements *(mandatory)*

### Functional Requirements

**Saving & metadata**

- **FR-001**: System MUST let a user save a bookmark by providing a web address.
- **FR-002**: System MUST automatically retrieve and store the page's title,
  description, favicon, and preview image when saving, on a best-effort basis.
- **FR-003**: System MUST let the user edit the title and description both before
  confirming a save and at any time afterward.
- **FR-004**: System MUST validate the address and reject empty or clearly
  malformed addresses with a clear message, saving nothing in that case.
- **FR-005**: System MUST derive a readable fallback title from the address when
  page metadata cannot be obtained, and still save the bookmark.
- **FR-006**: When the user saves an address that already exists (after
  normalization), the System MUST open the existing bookmark for editing instead
  of creating a duplicate.
- **FR-007**: System MUST persist all bookmarks and their data across app
  restarts and reloads.

**Browsing, sorting & display**

- **FR-008**: System MUST display each bookmark in the list showing at least its
  title, description, tags, and favicon.
- **FR-009**: Users MUST be able to open a saved bookmark's target page.
- **FR-010**: System MUST support sorting the list by at least date added and
  title, each in ascending and descending order.
- **FR-011**: System MUST record the date each bookmark was saved.

**Search**

- **FR-012**: Search MUST match case-insensitively across title, description,
  notes, and address.
- **FR-013**: Search MUST support exact-phrase matching via quotation marks.
- **FR-014**: Search MUST support `#tag` terms that match bookmarks carrying that
  tag.
- **FR-015**: Search MUST support boolean operators `AND`, `OR`, `NOT` and
  parentheses for grouping, and combinations thereof.
- **FR-016**: System MUST present a clear "no results" state when a search or
  filter matches nothing, and clear empty states for empty views.

**Editing, tags & deletion**

- **FR-017**: Users MUST be able to edit a bookmark's title, description,
  address, notes, and tags.
- **FR-018**: Users MUST be able to add and remove tags on a bookmark, and the
  System MUST suggest existing tags while the user types.
- **FR-019**: Users MUST be able to filter the list to bookmarks carrying a
  selected tag.
- **FR-020**: Users MUST be able to delete a bookmark, with a safeguard
  (confirmation or undo) against accidental deletion.

**Read-later**

- **FR-021**: System MUST assign new bookmarks an unread ("read later") state by
  default and let users mark bookmarks read or unread.
- **FR-022**: System MUST provide a separate view showing only unread bookmarks.

**Bulk actions**

- **FR-023**: Users MUST be able to select multiple bookmarks, or select all
  bookmarks matching the current search/filter, and apply a single action to the
  whole selection.
- **FR-024**: Bulk actions MUST include add tags, remove tags, mark read, mark
  unread, archive, and delete, with the same accidental-loss safeguard for bulk
  delete.

**Archive**

- **FR-025**: Users MUST be able to archive and restore bookmarks; archiving MUST
  be reversible and distinct from deletion.
- **FR-026**: System MUST hide archived bookmarks from the normal list and from
  normal search/filter results, and MUST provide a dedicated archive view.

**Notes formatting**

- **FR-027**: System MUST let users apply simple formatting to notes (such as
  bold, italic, lists, and links) and MUST render that formatting on display
  rather than showing raw markup.

**Saved filters**

- **FR-028**: Users MUST be able to save a combination of a search query with
  included and excluded tags as a named, reusable filter, and to apply, edit, and
  delete saved filters.

**Preservation**

- **FR-029**: System MUST attempt to preserve an offline copy of a saved web page
  where possible, and store PDFs as PDFs.
- **FR-030**: System MUST let the user optionally request preservation through
  the Internet Archive and record a link to the resulting snapshot; failure MUST
  not block saving the bookmark.

**Import & export**

- **FR-031**: System MUST import bookmarks from the common browser bookmark HTML
  format, retaining titles, tags, and saved dates, and MUST avoid creating
  duplicates per the duplicate rule.
- **FR-032**: System MUST export the collection in the common browser bookmark
  HTML format, retaining titles, tags, and saved dates.

**Preferences**

- **FR-033**: Users MUST be able to set personal display preferences including
  default sort order, display density (how much is shown per item), and text
  size, and these MUST persist across sessions.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved web page. Attributes: address (required, normalized),
  title, description, notes (formatted), favicon, preview image, tags, saved
  date, read/unread state, archived state, and preservation details (offline
  copy availability, PDF flag, Internet Archive snapshot link).
- **Tag**: A user-defined label. Many-to-many with bookmarks; used for display,
  filtering, `#tag` search, and saved filters.
- **Saved Filter**: A named, reusable definition combining a search query with
  sets of included and excluded tags.
- **Preferences**: The single user's display settings (default sort order,
  display density, text size).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save their first bookmark, with details auto-populated,
  in under 30 seconds from opening the app.
- **SC-002**: A user can locate a specific bookmark in a collection of 100+ in
  under 10 seconds using search, tag filter, or a saved filter.
- **SC-003**: Saved bookmarks and their data survive a full app restart with
  100% retention.
- **SC-004**: A user can apply a bulk action (e.g., tag or archive) to 50
  selected bookmarks in a single action in under 15 seconds.
- **SC-005**: Round-trip import/export retains 100% of titles, tags, and saved
  dates for well-formed entries.
- **SC-006**: The list, search, sort, and bulk actions feel responsive (results
  under ~1 second) with at least 500 saved bookmarks.
- **SC-007**: 95% of first-time users successfully save, find, and re-open a
  bookmark without external help.

## Assumptions

- **Single user, no accounts**: The app manages one person's collection and does
  not require sign-in or multi-user separation. (Confirmed by client: Option A.)
- **Web application**: Delivered as a browser-based app. Native mobile/desktop
  apps and a browser extension are out of scope for this version. (Confirmed.)
- **Bookmarks are web addresses (URLs)**: Saving arbitrary non-web resources is
  out of scope; PDFs reached by URL are supported for preservation.
- **Best-effort external retrieval**: Automatic metadata capture, offline copies,
  and Internet Archive preservation depend on reachable pages and external
  services; they are best-effort and never block saving.
- **Internet Archive** is an external dependency reached over the network; its
  availability is outside the app's control.
- **Duplicate detection** relies on address normalization (scheme, host case,
  trailing slash and similar), not on comparing page contents.
- **Simple notes formatting** means a small, common set (e.g., bold, italic,
  lists, links), not a full document editor.
- **English-language UI** with standard, accessible web interactions.
