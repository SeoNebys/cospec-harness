# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-24

**Status**: Draft

**Input**: User description: "An app to save and manage bookmarks." (expanded after client review to include automatic metadata capture, advanced search, read-later/archive states, bulk actions, saved searches, page preservation, and import/export.)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark with automatic metadata (Priority: P1)

A person finds a web page worth keeping and saves its address. The app automatically collects the page's title, description, favicon, and preview image so the saved entry is rich and recognisable without manual effort. The bookmark then appears in their list.

**Why this priority**: Saving links with useful, automatically captured detail is the core reason the app exists. This single story is a usable MVP: capture a link and see a recognisable entry in a list.

**Independent Test**: Add a bookmark by entering a URL, then confirm it appears in the list showing the automatically collected title, description, and favicon, and remains after reloading the app.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user submits a valid URL, **Then** the app fetches and stores the page's title, description, favicon, and preview image, and shows a new bookmark with those details.
2. **Given** the target page provides no title or description, **When** the bookmark is saved, **Then** the app falls back to a readable derived title (e.g. from the address) so the entry is never blank.
3. **Given** the user submits an entry that is not a valid web address, **When** they try to save, **Then** the app rejects it with a clear message and saves nothing.
4. **Given** metadata cannot be fetched (page unreachable or slow), **When** the bookmark is saved, **Then** the address is still saved with a derived title and the app indicates metadata is unavailable rather than failing the save.

---

### User Story 2 - Save-or-edit on duplicate address (Priority: P1)

When a person saves an address they have already bookmarked, the app takes them straight to the existing bookmark to edit it, rather than rejecting the save as a duplicate.

**Why this priority**: Re-encountering a saved link is common; turning that moment into an edit (rather than an error) is central to how the client wants to manage their collection.

**Independent Test**: Save a URL, then save the same URL again and confirm the app opens the existing bookmark's edit view instead of creating a second entry or showing only an error.

**Acceptance Scenarios**:

1. **Given** a bookmark for a given address already exists, **When** the user submits that same address, **Then** the app opens the existing bookmark in an editable view and creates no second entry.
2. **Given** the app opens the existing bookmark on a duplicate save, **When** the user changes fields and saves, **Then** the existing bookmark is updated in place.

---

### User Story 3 - Edit a bookmark's fields (Priority: P1)

A person refines a saved bookmark by editing its address, title, description, tags, and a free-form note.

**Why this priority**: Correcting and enriching saved entries is essential to keeping a personal collection accurate and useful, and pairs directly with save.

**Independent Test**: Open a saved bookmark, change its address, title, description, tags, and note, save, and confirm all changes persist across reloads.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user edits its address, title, description, tags, or note and saves, **Then** the updated values are shown and persist across reloads.
2. **Given** the user edits the address to one that already exists on another bookmark, **When** they save, **Then** the app warns of the conflict and does not create a duplicate.
3. **Given** a note with basic formatting, **When** the user saves and later views the bookmark, **Then** the formatting is preserved and displayed correctly.

---

### User Story 4 - Browse, sort and open bookmarks (Priority: P2)

A person browses their collection in a list that clearly shows each bookmark's title, description, tags, and favicon, sorts it (for example by date added or title), and opens any bookmark in their browser.

**Why this priority**: A growing collection is only useful if items are legible, orderable, and reachable. Builds directly on saving.

**Independent Test**: With several bookmarks saved, confirm each row shows title, description, tags, and favicon; change the sort to "title" and confirm order changes; open a bookmark and confirm the correct address loads in a new tab.

**Acceptance Scenarios**:

1. **Given** multiple saved bookmarks, **When** the list is shown, **Then** each entry clearly displays its title, description, tags, and favicon.
2. **Given** the list of bookmarks, **When** the user chooses a sort option (e.g. date added newest/oldest, title A–Z/Z–A), **Then** the list reorders accordingly.
3. **Given** a bookmark in the list, **When** the user activates it, **Then** its web address opens in a new browser tab.

---

### User Story 5 - Advanced search (Priority: P2)

A person finds specific bookmarks with a powerful, case-insensitive search over title, description, note, and address, including tag searches, exact quoted phrases, and boolean combinations.

**Why this priority**: Fast, expressive retrieval is what makes a large collection worth keeping. High value, builds on the saved list.

**Independent Test**: With varied bookmarks saved, run queries such as `#news AND "open source"`, `report NOT archived-topic`, and `(cats OR dogs)`, and confirm results match the stated logic; confirm matching is case-insensitive.

**Acceptance Scenarios**:

1. **Given** saved bookmarks, **When** the user searches plain text, **Then** results include bookmarks whose title, description, note, or address contain that text, matched case-insensitively.
2. **Given** the user enters `#tagname`, **When** the search runs, **Then** results are limited to bookmarks carrying that tag.
3. **Given** the user enters a phrase in double quotes, **When** the search runs, **Then** only bookmarks containing that exact phrase match.
4. **Given** the user combines terms with `AND`, `OR`, `NOT`, and parentheses, **When** the search runs, **Then** results honour the boolean logic and grouping.
5. **Given** a search that matches nothing, **When** results are shown, **Then** a clear "no matching bookmarks" state is displayed.

---

### User Story 6 - Read-later and read/unread states (Priority: P2)

A person marks bookmarks to read later, views only unread items in a dedicated view, and marks items as read once done.

**Why this priority**: A read-later workflow is a primary way the client intends to use the app day to day.

**Independent Test**: Mark a bookmark unread/read-later, open the unread view and confirm it appears, mark it read, and confirm it leaves the unread view.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user marks it read-later/unread, **Then** it appears in the separate unread view.
2. **Given** an unread bookmark, **When** the user marks it read, **Then** it is removed from the unread view while remaining in the main collection.
3. **Given** the unread view, **When** it is empty, **Then** a clear empty state is shown.

---

### User Story 7 - Tagging with suggestions and tag filtering (Priority: P2)

A person groups related bookmarks with tags. While typing a tag, the app suggests tags they already use. They can filter the list by including or excluding tags.

**Why this priority**: Tags are the primary organising structure and feed both filtering and saved searches.

**Independent Test**: Add a tag to a bookmark and confirm that when tagging another bookmark the same tag is suggested; filter the list to include one tag and exclude another and confirm results.

**Acceptance Scenarios**:

1. **Given** existing tags in use, **When** the user begins typing a tag, **Then** matching existing tags are suggested for quick selection.
2. **Given** bookmarks with tags, **When** the user filters to include a tag, **Then** only bookmarks carrying that tag are shown.
3. **Given** bookmarks with tags, **When** the user filters to exclude a tag, **Then** bookmarks carrying that tag are hidden.

---

### User Story 8 - Bulk actions on selections (Priority: P2)

A person selects several bookmarks — or everything matching the current search or filter — and applies an action to all of them at once: add or remove tags, mark read or unread, archive, or delete.

**Why this priority**: Bulk maintenance keeps a large collection manageable and is explicitly required by the client.

**Independent Test**: Select multiple bookmarks (and separately "select all matching current search"), add a tag to the selection, confirm all gained it; then archive the selection and confirm they leave the normal list.

**Acceptance Scenarios**:

1. **Given** several bookmarks, **When** the user selects them individually and adds or removes a tag, **Then** every selected bookmark reflects the change.
2. **Given** an active search or filter, **When** the user chooses "select all matching", **Then** the action applies to every bookmark matching that search/filter, not only those visible on screen.
3. **Given** a multi-selection, **When** the user marks read/unread, archives, or deletes, **Then** the action applies to all selected bookmarks, with deletion requiring confirmation.

---

### User Story 9 - Archive, separate from deletion (Priority: P2)

A person archives bookmarks they want out of the way but not gone. Archived items are hidden from normal lists and searches, live in their own archive view, and can be restored. Permanent deletion is a distinct, confirmed action.

**Why this priority**: Reversible tidy-up without data loss is a core safety and organisation behaviour the client requires.

**Independent Test**: Archive a bookmark and confirm it disappears from normal lists/searches but appears in the archive view; restore it and confirm it returns; separately delete a bookmark and confirm it is gone permanently.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user archives it, **Then** it is hidden from normal lists and searches and appears in the archive view.
2. **Given** an archived bookmark, **When** the user restores it, **Then** it returns to the normal collection.
3. **Given** a bookmark, **When** the user permanently deletes it (with confirmation), **Then** it is removed from all views and does not reappear.
4. **Given** a normal search or list, **When** results are computed, **Then** archived items are excluded unless the user is in the archive view.

---

### User Story 10 - Saved searches (Priority: P3)

A person saves useful combinations of search text and included/excluded tags, then revisits them later with one action.

**Why this priority**: Convenience layer over search and tags; valuable but the app is fully usable without it.

**Independent Test**: Create a saved search combining query text with an included and an excluded tag, revisit it later, and confirm it reproduces the same result set.

**Acceptance Scenarios**:

1. **Given** an active search with included/excluded tags, **When** the user saves it with a name, **Then** it is stored and listed among saved searches.
2. **Given** a saved search, **When** the user opens it, **Then** the app re-applies its query and tag inclusions/exclusions and shows the matching bookmarks.
3. **Given** a saved search, **When** the user deletes it, **Then** it is removed from the saved-search list without affecting any bookmarks.

---

### User Story 11 - Preserved copy of the page (Priority: P3)

A person keeps a preserved copy of a bookmarked page so its content survives even if the original changes or disappears. When the link is a PDF, the original file is saved. The user can also request preservation through the Internet Archive.

**Why this priority**: Protects against link rot; important to the client but the collection is usable before it exists.

**Independent Test**: Save a bookmark, request a preserved copy, and confirm the preserved content can be opened later; save a PDF link and confirm the original file is retained; trigger Internet Archive preservation and confirm a reference to the archived snapshot is stored.

**Acceptance Scenarios**:

1. **Given** a bookmarked web page, **When** the user requests preservation, **Then** the app stores a viewable copy of the page's content associated with the bookmark.
2. **Given** a bookmarked address that points to a PDF, **When** it is preserved, **Then** the original PDF file is saved and can be reopened.
3. **Given** a bookmark, **When** the user requests Internet Archive preservation, **Then** the app submits it and stores a link to the resulting archived snapshot.
4. **Given** preservation cannot be completed (source unreachable or service unavailable), **When** the attempt fails, **Then** the bookmark is unaffected and the user is told preservation did not succeed.

---

### User Story 12 - Import and export (browser HTML format) (Priority: P3)

A person imports an existing browser-bookmark HTML file and exports their collection to the same format. Importing preserves titles, tags, and dates.

**Why this priority**: Migration in and out protects the client's investment; important but not needed to start using the app.

**Independent Test**: Import a standard browser-bookmark HTML file and confirm titles, tags, and dates are preserved; export the collection and confirm the file opens as bookmarks elsewhere.

**Acceptance Scenarios**:

1. **Given** a standard browser-bookmark HTML file, **When** the user imports it, **Then** bookmarks are added with their titles, tags, and original dates preserved.
2. **Given** the user's collection, **When** they export, **Then** a browser-compatible HTML bookmark file is produced containing their bookmarks and tags.
3. **Given** an import that contains an address already saved, **When** it is processed, **Then** the app does not create a duplicate entry (it updates or skips the existing one).

---

### User Story 13 - Display preferences (Priority: P3)

A person sets basic display preferences: default sort order, number of items shown per page, and text size. Preferences persist.

**Why this priority**: Personalisation improves daily comfort; the app works with sensible defaults without it.

**Independent Test**: Change default sort, page size, and text size; reload the app and confirm the preferences are still applied.

**Acceptance Scenarios**:

1. **Given** the preferences screen, **When** the user sets a default sort order, items-per-page count, and text size, **Then** those settings take effect and persist across reloads.

---

### Edge Cases

- What happens when metadata (title/description/favicon/preview) cannot be fetched? The address is still saved with a derived title and an "metadata unavailable" indication.
- What happens when the user saves an address that already exists? The app opens the existing bookmark for editing rather than duplicating it.
- How does the system handle very long titles, descriptions, or addresses? Displayed text is truncated gracefully while the full value is preserved.
- What happens when a saved link later becomes unreachable? The bookmark and any preserved copy remain; the app does not silently delete it.
- How does the system handle deleting bookmarks by mistake? Permanent deletion requires confirmation, and archiving offers a reversible alternative.
- What happens when a bulk action targets "all matching" a large search? The action applies to every match, not just those currently visible, with confirmation for destructive actions.
- What happens when an import file is malformed or partially invalid? Valid entries are imported and the user is told which entries could not be read.
- What happens when a search query has unbalanced quotes or parentheses? The app reports the query is invalid and does not return misleading results.
- What happens when a preserved-copy or Internet Archive request fails? The bookmark is unaffected and the user is informed the preservation did not complete.

## Requirements *(mandatory)*

### Functional Requirements

**Saving & metadata**

- **FR-001**: Users MUST be able to save a bookmark by providing a web address.
- **FR-002**: System MUST validate that a submitted address is a well-formed web URL and reject invalid entries with a clear message.
- **FR-003**: On save, System MUST automatically fetch and store the page's title, description, favicon, and preview image when available.
- **FR-004**: System MUST derive a readable title and save the bookmark even when page metadata cannot be fetched, indicating that metadata is unavailable.
- **FR-005**: When a submitted address matches an existing bookmark, System MUST open the existing bookmark for editing rather than creating a duplicate.

**Editing**

- **FR-006**: Users MUST be able to edit a bookmark's address, title, description, tags, and note.
- **FR-007**: System MUST prevent edits that would create two bookmarks with the same address, warning the user of the conflict.
- **FR-008**: System MUST support basic formatting within notes and display that formatting correctly.

**Listing, sorting & opening**

- **FR-009**: System MUST display bookmarks in a list where each entry clearly shows its title, description, tags, and favicon.
- **FR-010**: Users MUST be able to sort the list, including by date added and by title, in ascending and descending order.
- **FR-011**: Users MUST be able to open a bookmark's address in their web browser.
- **FR-012**: System MUST display clear empty states (no bookmarks yet; no search/filter matches; empty unread view; empty archive).

**Search**

- **FR-013**: System MUST provide case-insensitive search across each bookmark's title, description, note, and address.
- **FR-014**: Search MUST support `#tag` terms that restrict results to bookmarks carrying that tag.
- **FR-015**: Search MUST support exact phrase matching via double-quoted text.
- **FR-016**: Search MUST support boolean combination of terms using AND, OR, NOT, and parentheses for grouping.
- **FR-017**: System MUST report invalid queries (e.g. unbalanced quotes or parentheses) rather than returning misleading results.

**Read-later**

- **FR-018**: Users MUST be able to mark a bookmark as read-later/unread and as read.
- **FR-019**: System MUST provide a separate view showing only unread bookmarks.

**Tags**

- **FR-020**: Users MUST be able to assign one or more tags to a bookmark.
- **FR-021**: While entering a tag, System MUST suggest tags the user already uses.
- **FR-022**: Users MUST be able to filter the list by including and by excluding specific tags.

**Bulk actions**

- **FR-023**: Users MUST be able to select multiple bookmarks individually, and to select all bookmarks matching the current search or filter.
- **FR-024**: Users MUST be able to apply to a selection: add or remove tags, mark read or unread, archive, and delete.
- **FR-025**: Destructive bulk actions (delete) MUST require confirmation.

**Archive vs delete**

- **FR-026**: Users MUST be able to archive a bookmark, hiding it from normal lists and searches and showing it in a dedicated archive view.
- **FR-027**: Users MUST be able to restore an archived bookmark to the normal collection.
- **FR-028**: Users MUST be able to permanently delete a bookmark, with confirmation; deletion is distinct from archiving and irreversible.
- **FR-029**: System MUST exclude archived bookmarks from normal lists and searches unless the user is in the archive view.

**Saved searches**

- **FR-030**: Users MUST be able to save a named combination of search text and included/excluded tags, and revisit it to reproduce its results.
- **FR-031**: Users MUST be able to delete a saved search without affecting any bookmarks.

**Page preservation**

- **FR-032**: Users MUST be able to request a preserved, viewable copy of a bookmarked page's content, stored with the bookmark.
- **FR-033**: When a bookmarked address points to a PDF, System MUST save the original PDF file for later reopening.
- **FR-034**: Users MUST be able to request preservation through the Internet Archive and have a link to the resulting snapshot stored with the bookmark.
- **FR-035**: When a preservation attempt fails, System MUST leave the bookmark unaffected and inform the user it did not complete.

**Import & export**

- **FR-036**: Users MUST be able to import a standard browser-bookmark HTML file, preserving titles, tags, and dates.
- **FR-037**: Import MUST not create duplicates for addresses already saved (updating or skipping existing entries).
- **FR-038**: Users MUST be able to export their collection to a browser-compatible HTML bookmark file including titles and tags.
- **FR-039**: System MUST report import entries that could not be read while still importing the valid ones.

**Preferences**

- **FR-040**: Users MUST be able to set and persist display preferences: default sort order, number of items shown per page, and text size.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved link. Attributes: web address, title, description, note (with basic formatting), favicon, preview image, set of tags, date added, read/unread state, archived state, references to any preserved copy / saved PDF / Internet Archive snapshot.
- **Tag**: A short label grouping related bookmarks. A bookmark may carry several tags; a tag may apply to many bookmarks. The set of tags in use drives tag suggestions and tag filters.
- **Saved Search**: A named, revisitable combination of search text plus included and excluded tags.
- **Preserved Copy**: Stored content associated with a bookmark — a captured copy of the page, an original PDF file, and/or a link to an Internet Archive snapshot.
- **Preferences**: The user's persisted display settings (default sort, items per page, text size).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark, with metadata automatically collected, in under 15 seconds from opening the save action (excluding time spent by unreachable external pages).
- **SC-002**: A user can locate a specific bookmark among at least 1,000 saved items in under 5 seconds using search or tag filter.
- **SC-003**: 100% of saved bookmarks, tags, notes, read/archive states, and saved searches remain present and correct after the app is closed and reopened.
- **SC-004**: Search and filter results update within 1 second of the user finishing their input for a collection of at least 1,000 bookmarks.
- **SC-005**: A boolean/phrase/tag search returns results consistent with the stated logic in 100% of defined acceptance cases.
- **SC-006**: A user can apply a bulk action to all items matching a search of at least 200 matches in a single operation.
- **SC-007**: Importing a standard browser-bookmark HTML file preserves 100% of titles, tags, and dates for valid entries, and exported files re-import without loss.
- **SC-008**: 95% of first-time users successfully save, find, and re-open a bookmark without external help.

## Assumptions

- Single-user, personal use; no login/accounts, sharing, collaboration, or browser extension (confirmed by client).
- The app runs as a web application accessed through a browser.
- Bookmarks and preserved copies are retained indefinitely; no automatic expiry.
- "Basic formatting" for notes means common rich-text such as bold, italic, lists, and links — not a full document editor.
- Automatic metadata capture depends on the target page being reachable and providing standard title/description/preview information; missing data falls back to derived values.
- Internet Archive preservation depends on the external Internet Archive service being reachable; unavailability is reported, not fatal.
- Import/export targets the widely used Netscape-style browser-bookmark HTML format; tag preservation relies on tag data being present in the file.
- Users have a modern web browser and stable internet connectivity.
