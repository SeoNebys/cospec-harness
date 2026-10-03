# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-27

**Status**: Approved (2026-09-27) — ready for planning

**Input**: User description: "Build an app to save and manage bookmarks." — expanded with the client's requirements for automatic metadata, deduplication, notes, advanced search, read-later, archiving, bulk actions, sorting, saved searches, import/export, page preservation, and display preferences.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a link with automatic metadata (Priority: P1)

A user pastes or enters a web address. The app automatically fetches the page's title, description, site icon (favicon), and preview image, and creates the bookmark. The user can still edit the title and description before or after saving.

**Why this priority**: Fast, rich capture is the core reason the app exists and delivers a usable MVP on its own.

**Independent Test**: Enter a valid URL, save, and confirm a bookmark is created showing the fetched title, description, site icon, and preview image, and that the title and description are editable.

**Acceptance Scenarios**:

1. **Given** an empty list, **When** the user saves a valid URL, **Then** the app fetches and stores the page title, description, site icon, and preview image and the bookmark appears in the list.
2. **Given** metadata was fetched, **When** the user edits the title or description and saves, **Then** the edited values are shown and persist.
3. **Given** the page provides no title/description/icon/image, **When** the bookmark is saved, **Then** it is still created using the address as the display title and sensible placeholders for the missing fields.
4. **Given** metadata retrieval fails or times out, **When** the user saves, **Then** the bookmark is still created from the address and the user is informed that metadata could not be fetched, with an option to retry fetching later.
5. **Given** the user enters text that is not a well-formed web address, **When** they try to save, **Then** the save is rejected with a clear message and nothing is added.

---

### User Story 2 - No duplicates; saving an existing address opens it for update (Priority: P1)

When a user saves an address that already exists in their collection, the app does not create a second copy. Instead it takes the user to the existing bookmark so they can update it.

**Why this priority**: Duplicate prevention protects the integrity of a growing collection and is a core capture behaviour the client explicitly required.

**Independent Test**: Save a URL, then attempt to save the same URL again; confirm no second entry is created and the user lands on the existing bookmark in an editable state.

**Acceptance Scenarios**:

1. **Given** a bookmark for an address already exists, **When** the user saves the same address again, **Then** no new bookmark is created and the user is taken to the existing bookmark for editing.
2. **Given** two addresses that are safely equivalent (differing only by letter case of the host or the presence of a default port), **When** the second is saved, **Then** the app treats them as the same bookmark. Differences such as trailing slashes or query/tracking parameters are NOT treated as equivalent, because they can point to genuinely different pages. *(Exact normalization rules recorded in Assumptions.)*
3. **Given** the user is taken to an existing bookmark on a duplicate save, **When** any freshly fetched metadata differs, **Then** the user may choose to update the stored metadata or keep the existing values.

---

### User Story 3 - A bookmark with editable address, title, tags, description, and note (Priority: P1)

Each bookmark carries an editable web address, title, set of tags, description, and a free-form note. The note supports simple formatting when displayed.

**Why this priority**: These editable fields are the data model users manage day to day; retrieval and organization stories build on them.

**Independent Test**: Open a bookmark, edit its address, title, tags, description, and note (including some formatting in the note), save, and confirm all values persist and the note renders with formatting.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user edits the address, title, tags, description, or note and saves, **Then** the updated values persist after reload.
2. **Given** the user edits the address to one that already exists on another bookmark, **When** they save, **Then** the app prevents creating a duplicate and informs the user (consistent with User Story 2).
3. **Given** a note containing simple formatting (e.g., bold, italic, lists, links), **When** the bookmark is displayed, **Then** the note renders with that formatting.
4. **Given** the user types in the tag field, **When** existing tags match what is typed, **Then** matching existing tags are suggested for selection.
5. **Given** the user adds a tag whose name already exists in the collection (ignoring letter case), **When** it is applied, **Then** the existing tag is reused and no second tag with that name is created.

---

### User Story 4 - Advanced search (Priority: P2)

A user finds bookmarks with a search that covers titles, descriptions, notes, and addresses, ignores letter case, and supports `#tag` terms, exact phrases in quotes, and boolean combinations using AND, OR, NOT, and parentheses.

**Why this priority**: Powerful retrieval is essential for a growing collection; depends on bookmarks existing.

**Independent Test**: With a varied set of bookmarks, run queries using each feature (`#tag`, "exact phrase", AND/OR/NOT, parentheses) and confirm only correctly matching bookmarks are returned.

**Acceptance Scenarios**:

1. **Given** bookmarks with varied content, **When** the user types a plain keyword, **Then** results include bookmarks whose title, description, note, or address contains that keyword, regardless of letter case.
2. **Given** a query `#work`, **When** it runs, **Then** only bookmarks carrying the tag `work` are returned.
3. **Given** a quoted phrase, **When** it runs, **Then** only bookmarks containing that exact phrase (case-insensitive) are returned.
4. **Given** a boolean query such as `#work AND (report OR "quarterly review") NOT archived`, **When** it runs, **Then** results honor the AND/OR/NOT operators and parenthesized grouping.
5. **Given** a query where the words AND, OR, or NOT are enclosed in quotes (e.g., `"AND"` or `"cats AND dogs"`), **When** it runs, **Then** those words are searched literally as text rather than interpreted as operators.
6. **Given** a malformed query (e.g., unbalanced parentheses), **When** it runs, **Then** the user receives a clear message and no misleading results.
7. **Given** a query with no matches, **When** it runs, **Then** an empty-state message is shown.

---

### User Story 5 - Read-later list (Priority: P2)

A user marks links to read later, views that list separately, and marks them as read.

**Independent Test**: Mark a bookmark for reading later, open the read-later view and confirm it appears, mark it read, and confirm it leaves the read-later list.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user marks it "read later", **Then** it appears in the separate read-later list.
2. **Given** a read-later item, **When** the user marks it read, **Then** it is removed from the read-later list and recorded as read.
3. **Given** a read item, **When** the user marks it unread, **Then** it returns to the read-later list.

---

### User Story 6 - Archive without deleting (Priority: P2)

A user archives links to remove them from the main list without deleting them, browses the archive separately, and restores them.

**Independent Test**: Archive a bookmark, confirm it leaves the main list and appears in the archive, then restore it and confirm it returns to the main list.

**Acceptance Scenarios**:

1. **Given** a bookmark in the main list, **When** the user archives it, **Then** it no longer appears in the main list and appears in the archive view.
2. **Given** an archived bookmark, **When** the user restores it, **Then** it returns to the main list.
3. **Given** the archive view, **When** the user searches or filters, **Then** search and filters operate within the archive.
4. **Given** an archived bookmark, **When** the user deletes it, **Then** it is permanently removed (with confirmation).

---

### User Story 7 - Bulk actions (Priority: P2)

A user selects multiple links — individually, or all links matching the current search/filter — and applies an action to them together: add/remove tags, archive, mark read/unread, or delete.

**Independent Test**: Select several bookmarks (and separately "select all matching"), apply a bulk tag and a bulk archive, and confirm all selected items are affected and non-selected items are not.

**Acceptance Scenarios**:

1. **Given** several bookmarks, **When** the user selects them individually and applies a bulk action, **Then** the action is applied to exactly those bookmarks.
2. **Given** an active search or filter, **When** the user chooses "select all matching", **Then** every bookmark matching the current view is selected, including any not currently visible on screen.
3. **Given** a multi-selection, **When** the user applies bulk delete, **Then** a single confirmation covers all selected items before removal.
4. **Given** a bulk action completes, **When** it finishes, **Then** the user sees how many items were affected.

---

### User Story 8 - Sort and clear list presentation (Priority: P2)

A user sorts the list, and each item clearly shows its title, description, tags, and site icon.

**Independent Test**: Change the sort order and confirm the list reorders accordingly; confirm each list item displays title, description, tags, and site icon.

**Acceptance Scenarios**:

1. **Given** a list of bookmarks, **When** the user chooses a sort option (e.g., date added, title, last updated), **Then** the list reorders accordingly and the choice persists for the session.
2. **Given** any list item, **When** it is displayed, **Then** it shows the title, description, tags, and site icon.

---

### User Story 9 - Saved searches / smart filters (Priority: P3)

A user saves useful combinations of a search query plus included and excluded tags, and reuses them later.

**Independent Test**: Build a search with included and excluded tags, save it with a name, then reopen it and confirm the same results are produced.

**Acceptance Scenarios**:

1. **Given** a search query with included and excluded tags, **When** the user saves it with a name, **Then** it appears in a list of saved searches.
2. **Given** a saved search, **When** the user selects it, **Then** the current view is set to that query and tag inclusions/exclusions and shows matching results.
3. **Given** a saved search, **When** the user renames or deletes it, **Then** the change persists.

---

### User Story 10 - Import and export standard bookmark files (Priority: P2)

A user imports a standard browser bookmark file to bring in existing links, and exports their collection to a standard browser bookmark file.

**Why this priority**: Explicitly required by the client and not deferred; enables onboarding from and offboarding to browsers.

**Independent Test**: Import a standard bookmark file and confirm links (and folder/tag structure where applicable) appear; export and confirm the produced file is a valid standard bookmark file re-importable elsewhere.

**Acceptance Scenarios**:

1. **Given** a standard browser bookmark file, **When** the user imports it, **Then** its links are added as bookmarks, preserving each bookmark's title, tags, and original date-added information where the file contains them, with folder names mapped to tags where present, and duplicates handled per User Story 2.
2. **Given** the collection, **When** the user exports, **Then** a standard browser bookmark file is produced that can be re-imported into a browser or back into this app.
3. **Given** an import file that is malformed or partially invalid, **When** the user imports, **Then** valid entries are imported, invalid ones are reported, and the user sees a summary (added, skipped duplicates, failed).

---

### User Story 11 - Preserve a local copy of a page (Priority: P3)

A user preserves a local copy of a bookmarked page so its content remains available even if the original changes or disappears. Pages that are PDFs are preserved as PDFs. The user may optionally also request preservation through the Internet Archive.

**Independent Test**: Preserve a normal web page and confirm a local copy can be reopened; preserve a PDF link and confirm it is saved as a PDF; request Internet Archive preservation and confirm a reference to the archived snapshot is stored.

**Acceptance Scenarios**:

1. **Given** a bookmark to a normal web page, **When** the user preserves it, **Then** a self-contained HTML file representing the original page (with its needed resources embedded, not merely an extracted readable version) is stored and can be reopened from the bookmark.
2. **Given** a bookmark whose destination is a PDF, **When** the user preserves it, **Then** the local copy is saved as a PDF file.
3. **Given** a bookmark, **When** the user opts to preserve via the Internet Archive, **Then** the app submits it and stores a reference to the resulting archived snapshot.
4. **Given** preservation fails (network error, unreachable page, or Internet Archive unavailable), **When** it is attempted, **Then** the user is informed and the bookmark is otherwise unaffected.

---

### User Story 12 - Display preferences (Priority: P3)

A user adjusts basic display preferences: default sort order, number of items shown per page, and text size. Preferences persist across sessions.

**Independent Test**: Change each preference, reload the app, and confirm the preferences are still applied.

**Acceptance Scenarios**:

1. **Given** the preferences screen, **When** the user changes the default sort, items-per-page, or text size, **Then** the list reflects the change immediately.
2. **Given** changed preferences, **When** the user closes and reopens the app, **Then** the preferences are still applied.

---

### Edge Cases

- **Duplicate on edit and import**: Editing an address to match another bookmark, or importing an address that already exists, is resolved to the existing bookmark rather than creating a duplicate (per User Story 2).
- **Address normalization ambiguity**: Two addresses are treated as duplicates only when safely equivalent — differing only by host letter case or a default port. Differences such as trailing slashes or query/tracking parameters are kept as separate bookmarks, since they can point to genuinely different pages. Exact rules are in Assumptions.
- **Metadata fetch failures/timeouts**: The bookmark is still created from the address; the user is told metadata was unavailable and can retry.
- **Very long titles/descriptions/notes or unusual characters**: Stored fully and displayed without breaking layout (truncated in the list with full content available on the detail view).
- **Malformed search query**: Unbalanced quotes/parentheses or a dangling operator yield a clear message, not misleading results.
- **`#tag` for a non-existent tag**: Returns an empty result with an empty-state message.
- **Bulk "select all matching" across pages**: Applies to every matching bookmark, not only those currently visible.
- **Bulk delete / permanent archive delete**: Always requires a single explicit confirmation.
- **Marking read an item not in the read-later list**: Read status is tracked independently of read-later membership; marking read simply records the read state.
- **Restoring an archived item that was in read-later or had read state**: Its prior read-later membership and read/unread state are retained on restore.
- **Import of malformed file**: Valid entries import; invalid entries are reported with a summary.
- **Preserving a page that requires login or is unreachable**: Preservation fails gracefully with a clear message; the bookmark is unaffected.
- **PDF vs. web page detection**: A destination identified as a PDF is preserved as a PDF; otherwise a self-contained HTML copy of the page is stored.
- **Empty states**: First-time (no bookmarks), empty read-later, empty archive, and no-result searches/filters each show a friendly empty state.
- **Formatting in notes**: Only simple, safe formatting is rendered; any unsupported or unsafe markup is neutralized when displayed.

## Requirements *(mandatory)*

### Functional Requirements

**Capture & metadata**

- **FR-001**: System MUST let a user save a bookmark by entering a web address.
- **FR-002**: System MUST validate that the entered address is well-formed and reject invalid entries with a clear message.
- **FR-003**: On save, System MUST automatically fetch and store the page's title, description, site icon, and preview image when available.
- **FR-004**: System MUST allow the user to edit the fetched title and description (before and after saving).
- **FR-005**: When metadata is missing or cannot be fetched, System MUST still create the bookmark using the address as the display title and inform the user, offering a later retry.

**Deduplication**

- **FR-006**: System MUST prevent storing two bookmarks for the same address; saving an existing address MUST take the user to the existing bookmark in an editable state instead of creating a copy.
- **FR-007**: System MUST apply consistent address-normalization rules (see Assumptions) when deciding whether two addresses are the same, and apply the same rule to edits and imports.

**Bookmark data model**

- **FR-008**: A bookmark MUST have an editable address, title, description, note, and set of tags, plus a creation timestamp and last-updated timestamp.
- **FR-009**: System MUST render the note with simple formatting when displayed, and neutralize unsupported or unsafe markup.
- **FR-010**: While the user types a tag, System MUST suggest existing tags that match.
- **FR-010a**: System MUST enforce that tag names are unique within the collection; it MUST NOT create two tags with the same name (compared case-insensitively). Attempting to add a tag whose name already exists MUST reuse the existing tag rather than create a duplicate.

**Search**

- **FR-011**: System MUST provide search across titles, descriptions, notes, and addresses, ignoring letter case.
- **FR-012**: Search MUST support `#tag` terms, quoted exact phrases, and the boolean operators AND, OR, NOT with parenthesized grouping. When the words AND, OR, or NOT appear inside quotes, System MUST treat them as literal search text rather than operators.
- **FR-013**: System MUST report malformed queries clearly without returning misleading results.
- **FR-014**: Search and filter results MUST update responsively as the user refines the query.

**Read-later & read state**

- **FR-015**: Users MUST be able to mark a bookmark for reading later and view a separate read-later list.
- **FR-016**: Users MUST be able to mark a bookmark read or unread; read state MUST be tracked independently of read-later membership.

**Archive**

- **FR-017**: Users MUST be able to archive a bookmark (removing it from the main list without deleting it) and browse a separate archive view.
- **FR-018**: Users MUST be able to restore an archived bookmark to the main list, preserving its prior read-later membership and read/unread state.
- **FR-019**: Users MUST be able to permanently delete a bookmark (from main or archive) with a confirmation step.

**Bulk actions**

- **FR-020**: Users MUST be able to select multiple bookmarks individually, and to select all bookmarks matching the current search/filter (including items not currently visible).
- **FR-021**: Users MUST be able to apply the following actions to a selection: add/remove tags, archive, mark read/unread, and delete.
- **FR-022**: Bulk delete MUST require a single confirmation covering the whole selection, and System MUST report how many items were affected.

**List presentation & sorting**

- **FR-023**: System MUST display bookmarks in a list where each item shows its title, description, tags, and site icon.
- **FR-024**: Users MUST be able to sort the list (at least by date added, title, and last updated).

**Saved searches**

- **FR-025**: Users MUST be able to save a named combination of a search query with included and excluded tags, and reuse, rename, and delete it.

**Import / export**

- **FR-026**: Users MUST be able to import a standard browser bookmark file, preserving each bookmark's title, tags, and original date-added information where present in the file, mapping folders to tags, and handling duplicates per FR-006.
- **FR-027**: Users MUST be able to export the collection to a standard browser bookmark file that can be re-imported into a browser or this app.
- **FR-028**: On import, System MUST report a summary of items added, skipped as duplicates, and failed.

**Page preservation**

- **FR-029**: Users MUST be able to preserve a local copy of a bookmarked page and reopen it from the bookmark. For a web page, the preserved copy MUST be a self-contained HTML file representing the original page (embedding the resources needed to display it), not merely an extracted readable version.
- **FR-030**: When the destination is a PDF, the preserved local copy MUST be saved as a PDF.
- **FR-031**: Users MUST be able to optionally request preservation through the Internet Archive and have a reference to the resulting snapshot stored.
- **FR-032**: When preservation fails, System MUST inform the user and leave the bookmark otherwise unaffected.

**Display preferences**

- **FR-033**: Users MUST be able to set display preferences for default sort order, number of items shown, and text size, and these MUST persist across sessions.

**Persistence & general**

- **FR-034**: System MUST persist all bookmarks and their data (including read-later, read state, archive state, tags, notes, saved searches, preferences, and preservation references) so they remain available after the app is closed and reopened.
- **FR-035**: System MUST present clear empty states for first-time use, empty read-later, empty archive, and no-result searches/filters.
- **FR-036**: Users MUST be able to open a bookmark's destination in a new browser tab.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved link. Attributes: address, title, description, note (formatted), site icon, preview image, tags, creation timestamp, last-updated timestamp, read-later flag, read/unread state, archive state, and references to any preserved local copy and Internet Archive snapshot.
- **Tag**: A short label grouping bookmarks. Many-to-many with bookmarks; existing tags are suggested during entry. Tag names are unique within the collection (case-insensitive); the same name always refers to a single tag.
- **Saved Search**: A named, reusable combination of a search query plus included and excluded tags.
- **Preserved Copy**: A stored local rendition of a page — a self-contained HTML file representing the original page, or a PDF when the source is a PDF — and/or a reference to an Internet Archive snapshot, associated with a bookmark.
- **Display Preferences**: Per-user settings for default sort order, items shown, and text size.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark with automatic metadata in under 30 seconds, including fetch time under typical conditions.
- **SC-002**: A user can locate a specific bookmark in a collection of 1,000+ using search in under 5 seconds.
- **SC-003**: Search and filter results appear within 1 second of the user finishing input for collections up to 5,000 bookmarks.
- **SC-004**: Saving an already-saved address never produces a duplicate (0 duplicates in 100 repeated-save attempts).
- **SC-005**: A user can apply a bulk action to all items matching a search of 500+ results in under 10 seconds.
- **SC-006**: Importing a standard bookmark file of 1,000 links completes with an accurate added/skipped/failed summary and no duplicates.
- **SC-007**: All bookmark data (including tags, notes, states, saved searches, preferences, and preservation references) is still present 100% of the time after closing and reopening the app.
- **SC-008**: 95% of first-time users successfully save, find, and organize a bookmark without external help.

## Assumptions

- **Single user, no login, one device to start**: v1 is a single-user personal collection with no accounts; cross-device sync is deferred (client-confirmed).
- **Web application**: Delivered as a browser-based web app per the project's runtime presentation environment; a server-side component is expected because metadata fetching, page preservation, Internet Archive submission, and import/export exceed what a browser page can do purely client-side. (Concrete technology chosen at the plan gate.)
- **Address normalization rules for deduplication (v1)**: addresses are compared as duplicates only when they are safely equivalent. Normalization is limited to lower-casing the host (site name) and ignoring a default port. Trailing slashes and query/tracking parameters are NOT removed, because they can lead to genuinely different pages; any such difference keeps bookmarks distinct. These rules can be refined later.
- **Metadata source**: title, description, and preview image are taken from standard page metadata (e.g., Open Graph / standard meta tags) with the site favicon as the icon; a best-effort fallback is used when those are absent.
- **Note formatting**: "simple formatting" means a lightweight rich-text/markdown-style set (bold, italic, lists, links, headings) rendered safely; full HTML authoring is out of scope.
- **Standard bookmark file format**: import/export uses the widely supported Netscape bookmark HTML format used by major browsers; folder names map to tags on import.
- **Page preservation scope (v1)**: a preserved web page is stored best-effort as a single self-contained HTML file representing the original page (embedding the resources needed to display it), not merely an extracted readable version; a destination that is a PDF is stored as a PDF. It does not guarantee capture of login-gated pages, streamed media, or highly dynamic app states. Internet Archive preservation depends on that external service being reachable.
- **Search operator precedence**: NOT binds tightest, then AND, then OR, with parentheses overriding; case-insensitive; unquoted multi-word terms are treated as separate ANDed keywords unless quoted.
- **Standard error handling**: invalid input and failed external operations produce user-friendly messages with no data loss.
- **External dependencies**: automatic metadata, page preservation, and Internet Archive submission require outbound network access to the target sites and to the Internet Archive; these may be unavailable in restricted environments and degrade gracefully.
