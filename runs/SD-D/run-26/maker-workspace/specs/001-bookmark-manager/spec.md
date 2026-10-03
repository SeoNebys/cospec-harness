# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-27

**Updated**: 2026-09-27

**Status**: Approved

**Input**: User description: "Build a private, single-user bookmark manager with automatic page metadata, read-later and archive workflows, structured search, bulk actions, and standard bookmark import/export."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save an Enriched Bookmark (Priority: P1)

As a user, I can paste a web address and have the app retrieve the page title, description, and icon so that saving a useful, recognizable bookmark requires little or no manual entry.

**Why this priority**: Fast, automatic enrichment is the core advantage over keeping a plain list of links and is the user's primary reason for using the app.

**Independent Test**: Paste a reachable page address, verify that its available metadata is proposed, adjust the proposed values, save the bookmark, leave the app, and confirm that the enriched bookmark remains available on return.

**Acceptance Scenarios**:

1. **Given** a valid address for a page that exposes a title, description, and icon, **When** the user pastes the address, **Then** the app retrieves and pre-fills all three values before the user confirms the save.
2. **Given** retrieved metadata, **When** the user changes the proposed title or description or removes the proposed icon, **Then** the app saves the user's chosen values rather than the original proposals.
3. **Given** a valid address whose metadata is missing, unavailable, or unsafe to retrieve, **When** enrichment finishes or fails, **Then** the app explains the outcome and still lets the user complete the bookmark manually.
4. **Given** no usable title from either the page or the user, **When** the bookmark is saved, **Then** its address is used as the display label.
5. **Given** an address that exactly matches an existing bookmark, **When** the user tries to save it, **Then** no duplicate is created and the app points the user to the existing bookmark.
6. **Given** a saved bookmark, **When** the user leaves and later returns to the app, **Then** its address, metadata, note, tags, read status, archive status, and dates remain available.

---

### User Story 2 - Find and Organize Bookmarks (Priority: P2)

As a user, I can organize bookmarks with tags and find them using plain terms, tag criteria, exact phrases, and Boolean combinations so that a large collection remains useful.

**Why this priority**: A growing bookmark collection only creates value when the user can retrieve the right item quickly and precisely.

**Independent Test**: Create bookmarks with overlapping titles, addresses, descriptions, notes, and tags; verify plain search, `tag:` search, quoted phrases, `AND`, `OR`, and `NOT`, then clear the query and tag filter.

**Acceptance Scenarios**:

1. **Given** bookmarks with different titles, addresses, descriptions, notes, and tags, **When** the user enters plain search terms, **Then** matching active bookmarks are shown without regard to letter case.
2. **Given** bookmarks with different tags, **When** the user searches with `tag:research` or `tag:"machine learning"`, **Then** only bookmarks with the named tag are shown.
3. **Given** bookmarks containing a multi-word phrase, **When** the user encloses that phrase in quotation marks, **Then** only bookmarks containing that exact phrase in a searchable field are shown.
4. **Given** a query using `AND`, `OR`, or `NOT`, **When** the search runs, **Then** the criteria are combined according to the documented operator rules and the matching bookmarks are shown.
5. **Given** no bookmarks match a query or filter, **When** results are displayed, **Then** the app explains that no matches were found and offers a way to clear the criteria.
6. **Given** active search or filter criteria, **When** the user clears them, **Then** the full current collection view is shown again.

---

### User Story 3 - Use Read-Later and Archive Workflows (Priority: P3)

As a user, I can distinguish unread bookmarks from ones I have finished and archive bookmarks without deleting them so that my main library stays focused while older material remains recoverable.

**Why this priority**: Read status and archiving turn a static collection into a manageable reading workflow without sacrificing retained knowledge.

**Independent Test**: Save a bookmark as unread, view it in the unread collection, mark it read, archive it, locate it in the archive, restore it, and verify that its read status is retained throughout.

**Acceptance Scenarios**:

1. **Given** a new bookmark, **When** the user saves it without changing its initial status, **Then** it is marked unread and appears in both the main library and unread view.
2. **Given** an unread bookmark, **When** the user marks it read, **Then** it no longer appears in the unread view but remains in the main library.
3. **Given** a read bookmark, **When** the user marks it unread, **Then** it returns to the unread view.
4. **Given** an active bookmark, **When** the user archives it, **Then** it leaves the main and unread views, remains available in the archive, and keeps its read status and other data.
5. **Given** an archived bookmark, **When** the user restores it, **Then** it returns to the main library and, if unread, to the unread view.
6. **Given** a bookmark destination is opened, **When** the user returns to the app, **Then** its read status is unchanged until the user explicitly changes it.

---

### User Story 4 - Maintain Individual Bookmarks (Priority: P4)

As a user, I can keep readable formatted notes, correct or refresh bookmark details, and permanently remove a bookmark so that the collection remains useful and accurate.

**Why this priority**: Individual maintenance keeps saved material trustworthy and distinguishes recoverable archiving from permanent deletion.

**Independent Test**: Add a note containing emphasis, a list, and a link; verify that it displays as formatted content; edit every user-controlled field; retry metadata enrichment without overwriting an edited value unexpectedly; verify persistence; and then permanently delete the bookmark after confirmation.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user changes its address, title, description, note, tags, icon choice, or read status and saves, **Then** the updated values appear and persist on return.
2. **Given** a note containing paragraphs, bold or italic text, a bulleted or numbered list, or a link, **When** the user views the bookmark outside editing, **Then** the note is displayed with that formatting rather than showing the formatting symbols.
3. **Given** a bookmark with user-edited metadata, **When** the user requests refreshed page metadata, **Then** the app shows the proposed changes and requires approval before replacing user-edited values.
4. **Given** a bookmark in either the active library or archive, **When** the user requests deletion, **Then** the app clearly identifies deletion as permanent and asks for confirmation.
5. **Given** a deletion confirmation, **When** the user cancels, **Then** the bookmark remains unchanged.
6. **Given** a deletion confirmation, **When** the user confirms, **Then** the bookmark is permanently removed from every collection and result set.

---

### User Story 5 - Manage Multiple Bookmarks Together (Priority: P5)

As a user, I can select several bookmarks and apply one action to all of them so that maintaining a large collection does not require repetitive work.

**Why this priority**: Bulk actions make the read-later, archive, and tagging workflows practical at collection scale.

**Independent Test**: Select several bookmarks from a result set and verify bulk tag addition and removal, read-status changes, archive and restore, and confirmed permanent deletion.

**Acceptance Scenarios**:

1. **Given** a list of bookmarks, **When** the user selects individual items or all currently displayed results, **Then** the app shows the selection count and the actions available for that collection view.
2. **Given** selected bookmarks, **When** the user adds or removes one or more tags in bulk, **Then** the change is applied to every selected bookmark without removing unrelated tags.
3. **Given** selected active bookmarks, **When** the user marks them read or unread or archives them, **Then** the chosen status change is applied to every selected bookmark.
4. **Given** selected archived bookmarks, **When** the user restores them, **Then** every selected bookmark returns to the active library with its read status preserved.
5. **Given** selected bookmarks, **When** the user requests bulk deletion, **Then** the app states how many items will be permanently deleted and requires confirmation before removing any of them.
6. **Given** a completed bulk action, **When** the updated view is shown, **Then** the app reports how many bookmarks changed and clears the prior selection.

---

### User Story 6 - Import and Export the Collection (Priority: P6)

As a user, I can import bookmarks from a standard browser bookmark file and export my collection in the same broadly compatible format so that I can adopt or leave the app without re-entering my links.

**Why this priority**: Portability removes the largest barrier to starting with the app and prevents the collection from becoming locked in.

**Independent Test**: Import a standard browser bookmark file containing valid, invalid, nested, and duplicate entries; verify the preview and results; export the resulting collection; and re-import that export into an empty collection to verify round-trip preservation.

**Acceptance Scenarios**:

1. **Given** a valid standard browser bookmark HTML file, **When** the user chooses it for import, **Then** the app previews counts for new, duplicate, and invalid entries before changing the collection.
2. **Given** an import preview, **When** the user confirms it, **Then** valid new bookmarks are imported, exact-address duplicates and invalid entries are skipped, and a result summary explains each count.
3. **Given** imported bookmarks arranged in folders, **When** the import completes, **Then** their folder names are retained as tags and nested folder levels contribute their respective tag names.
4. **Given** imported bookmarks with missing descriptions or icons, **When** import completes, **Then** the bookmarks are available immediately and missing metadata is enriched without blocking the import result.
5. **Given** active and archived bookmarks, **When** the user exports the full collection, **Then** the app produces one standard browser bookmark HTML file containing every bookmark exactly once.
6. **Given** an export produced by the app, **When** another compatible bookmark tool opens it, **Then** at minimum each bookmark's title and address are available.
7. **Given** an export produced by the app, **When** it is imported into an empty copy of the app, **Then** titles, addresses, descriptions, notes, tags, icons where available, read status, archive status, and saved dates are restored.

### Edge Cases

- An empty main library, unread view, archive, or result set shows an explanation and a relevant next action.
- A malformed address or a scheme other than HTTP or HTTPS is rejected with a specific correction message while other entered values are preserved.
- Metadata retrieval may time out, be blocked, encounter a redirect, or find only some fields; each available value is retained and the user can retry or continue manually.
- Metadata retrieved after the user begins editing does not overwrite the user's changes without approval.
- A broken or unrecognized icon is omitted without preventing the bookmark from being saved or opened.
- Saving an address that exactly matches an existing active or archived bookmark is prevented, and the existing bookmark is identified.
- Leading and trailing whitespace does not create accidental differences or empty tags; tag names differing only in capitalization are treated as one tag.
- A bookmark may be saved even when its well-formed destination is temporarily unreachable; availability is not inferred from one failed retrieval.
- A very long title, description, note, tag, or address remains readable without obscuring primary actions.
- Unsupported or incomplete note-formatting syntax remains readable as text and cannot alter or control the surrounding app.
- An unmatched quotation mark, incomplete `tag:` criterion, or misplaced Boolean operator produces actionable search guidance rather than silently changing the intended query.
- `NOT` applies before `AND`, and `AND` applies before `OR`; criteria at the same precedence are evaluated from left to right.
- Archived unread bookmarks retain their unread status but do not appear in the active unread view until restored.
- If a filter or search changes after items are selected, selections that are no longer displayed are cleared to prevent hidden bulk changes.
- A bulk action that repeats an existing state, such as marking an already-read bookmark read, succeeds without creating a conflicting state.
- An import with a mixture of valid, invalid, and duplicate entries imports only valid new entries and reports the others without discarding successful work.
- Cancelling an import preview leaves the collection unchanged.
- Exporting an empty collection produces a valid, empty bookmark file rather than an error.
- Removing the final use of a tag removes that tag from available tag filters while preserving it in exported data only when still attached to a bookmark.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST let the user begin a bookmark by providing a required HTTP or HTTPS address.
- **FR-002**: After a valid address is provided, the app MUST attempt to retrieve the destination's title, description, and representative icon and MUST show progress and the eventual outcome.
- **FR-003**: Retrieved metadata MUST be presented as editable proposed values before the initial save; the user MUST be able to change the title and description and remove the proposed icon.
- **FR-004**: Missing or failed metadata retrieval MUST NOT prevent a valid address from being saved manually, and the app MUST explain which metadata could not be retrieved.
- **FR-005**: If neither the destination nor the user supplies a usable title, the app MUST use the address as the bookmark's display label.
- **FR-006**: The user MUST be able to retry metadata retrieval for a saved bookmark, review proposed changes, and choose which changes to accept.
- **FR-007**: Metadata refresh MUST NOT overwrite a user-edited title, description, or icon choice without the user's approval.
- **FR-008**: The app MUST reject missing, malformed, or unsupported addresses before saving and MUST preserve the user's other entered values while explaining the correction needed.
- **FR-009**: The app MUST prevent more than one bookmark with the exact same address across both active and archived collections and MUST direct the user to the existing bookmark.
- **FR-010**: The app MUST let the user add an optional personal note and zero or more tags independently of retrieved page metadata.
- **FR-011**: The app MUST show active bookmarks in a main library with enough information to distinguish them, including display label, address, available description and icon, tags, read status, and saved date.
- **FR-012**: The app MUST order collection views by most recently saved or updated by default and MUST let the user alternatively sort by title.
- **FR-013**: The user MUST be able to open a bookmark's destination without losing current search, filter, sort, collection-view, or selection context.
- **FR-014**: Opening a bookmark MUST NOT automatically change its read status.
- **FR-015**: The app MUST provide case-insensitive plain-text search across bookmark titles, addresses, descriptions, personal notes, and tag names.
- **FR-016**: The app MUST support exact-phrase search by enclosing the phrase in quotation marks.
- **FR-017**: The app MUST support direct tag criteria using `tag:name` and `tag:"multi-word name"`.
- **FR-018**: The app MUST support uppercase Boolean operators `AND`, `OR`, and `NOT`, with `NOT` evaluated before `AND`, `AND` before `OR`, and equal-precedence criteria evaluated from left to right.
- **FR-019**: Adjacent search criteria without an explicit operator MUST be treated as joined by `AND`.
- **FR-020**: The app MUST let plain terms, phrases, and tag criteria be combined in one query and MUST provide readily available guidance explaining the supported syntax.
- **FR-021**: The app MUST identify an invalid structured query, preserve it for correction, and explain the invalid portion rather than returning misleading results.
- **FR-022**: Search MUST operate within the current active or archived collection view; the archive MUST not appear in ordinary main-library or unread results.
- **FR-023**: The app MUST let the user filter the current collection by a single tag, clearly show active search and filter criteria, and clear either or both.
- **FR-024**: The user MUST be able to create tags while saving or editing a bookmark; empty tags MUST be ignored and names differing only in capitalization MUST refer to one tag.
- **FR-025**: New manually saved bookmarks MUST default to unread while allowing the user to choose read status before saving.
- **FR-026**: The user MUST be able to mark an individual active bookmark read or unread and view all active unread bookmarks as a dedicated collection.
- **FR-027**: The user MUST be able to archive an active bookmark and restore an archived bookmark without losing its metadata, note, tags, read status, or dates.
- **FR-028**: Archived bookmarks MUST be excluded from the main library and active unread view and MUST be accessible through a dedicated archive view.
- **FR-029**: The user MUST be able to edit a bookmark's address, title, description, note, tags, icon choice, and read status, subject to the same validation and duplicate rules as creation.
- **FR-030**: The user MUST be able to permanently delete an active or archived bookmark, and the app MUST require explicit confirmation that distinguishes deletion from archiving.
- **FR-031**: The app MUST let the user select individual bookmarks and select all bookmarks currently displayed by the active collection, search, filter, and sort criteria.
- **FR-032**: For selected bookmarks, the app MUST support adding tags, removing tags, marking read, marking unread, archiving, restoring when in the archive, and permanent deletion.
- **FR-033**: Bulk tag removal MUST remove only the chosen tags, and all bulk actions MUST leave unrelated bookmark data unchanged.
- **FR-034**: Bulk deletion MUST state the number of selected bookmarks and require confirmation before removing any of them.
- **FR-035**: After a bulk action, the app MUST report the number of bookmarks changed and clear the selection; an inapplicable state already held by a selected bookmark MUST not cause the other changes to fail.
- **FR-036**: The app MUST accept imports from standard browser bookmark HTML files and MUST preview counts of valid new, exact-duplicate, and invalid entries before applying the import.
- **FR-037**: Import MUST require confirmation, MUST leave the collection unchanged when cancelled, and MUST report the final counts of imported and skipped entries.
- **FR-038**: Import MUST preserve available titles and saved dates, convert each containing folder name into a tag, place imported bookmarks in the active collection, and default imported bookmarks without app-specific read status to unread.
- **FR-039**: Import MUST make bookmarks available without waiting for enrichment and MUST attempt to fill missing descriptions and icons afterward without replacing imported or user-edited values.
- **FR-040**: The app MUST export the full active and archived collection as a standard browser bookmark HTML file with every bookmark represented exactly once.
- **FR-041**: Exported files MUST expose at least bookmark titles and addresses to other compatible bookmark tools.
- **FR-042**: Re-importing an app-produced export into an empty collection MUST restore titles, addresses, descriptions, notes, tags, available icons, read status, archive status, and saved dates.
- **FR-043**: The app MUST provide meaningful empty states for the main library, unread view, archive, and searches or filters with no matches.
- **FR-044**: The app MUST persist all confirmed bookmark changes between app sessions on the same deployment until the user permanently deletes them.
- **FR-045**: The app MUST make each bookmark's saved date and most recent update date available to the user.
- **FR-046**: The app MUST keep the user's private bookmark collection inaccessible to unrelated visitors and MUST NOT send the collection to unrelated services for metadata retrieval or search.
- **FR-047**: The app MUST support keyboard operation for saving, metadata review, searching, filtering, collection switching, selection, bulk actions, importing, exporting, editing, opening, archiving, and deleting, with visible focus and understandable control labels.
- **FR-048**: Personal notes MUST support paragraphs, bold text, italic text, bulleted lists, numbered lists, and links using simple lightweight formatting syntax, and the app MUST make the supported syntax discoverable while editing.
- **FR-049**: Outside editing, the app MUST render supported note formatting without exposing its formatting symbols; unsupported syntax MUST remain readable, and note content MUST NOT execute or alter the surrounding app.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved web destination with an address; retrieved or user-edited title, description, and icon choice; an optional personal note with lightweight formatting; zero or more tags; read/unread status; active/archived status; a saved date; and a most recent update date. Its display label is its title when present and otherwise its address.
- **Tag**: A user-defined organizational label associated with many bookmarks. A bookmark may have many tags, and tag identity is case-insensitive.
- **Import Preview**: A proposed collection change derived from a selected bookmark file, including counts and details for valid new, exact-duplicate, and invalid entries. It does not affect the library until confirmed.
- **Selection**: The set of currently displayed bookmarks chosen for a bulk action, together with the collection and query context in which they were selected.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user can paste a valid address, review automatically proposed metadata, and save the bookmark in under 30 seconds without instructions.
- **SC-002**: For at least 95% of representative reachable pages that expose a title, description, and icon, every exposed value is proposed to the user within 5 seconds under ordinary network conditions.
- **SC-003**: At least 90% of representative users complete the save, structured-search, read-later, archive-and-restore, bulk-tag, import, and export journeys successfully on their first attempt.
- **SC-004**: With a library of 10,000 bookmarks, plain or structured search, filtering, sorting, and collection switching each show the resulting collection within 2 seconds of the user's action.
- **SC-005**: A bulk status or tag action applied to 1,000 selected bookmarks reports completion within 5 seconds and changes all intended bookmarks with no unintended field changes.
- **SC-006**: An import of 10,000 valid bookmarks completes within 60 seconds, makes imported links available immediately upon completion, and accurately reports all imported, duplicate, and invalid counts.
- **SC-007**: Exporting and re-importing a test collection restores 100% of bookmark addresses, titles, descriptions, notes, tags, read statuses, archive statuses, and saved dates; available icons are restored or safely re-enriched.
- **SC-008**: Across persistence tests covering at least 10,000 bookmarks and 100 leave-and-return cycles, 100% of confirmed changes remain intact.
- **SC-009**: In validation tests, 100% of missing, malformed, unsupported, and exact-duplicate addresses are prevented from creating invalid or duplicate bookmarks and receive an actionable message.
- **SC-010**: All primary bookmark-management journeys can be completed using only a keyboard and retain a visible indication of the currently focused control.
- **SC-011**: In a representative note-formatting test set, 100% of supported paragraphs, emphasis, lists, and links display as intended outside editing, while malformed or unsupported input remains readable and does not affect the surrounding app.

## Assumptions

- The first release remains a private, single-user bookmark manager; multiple user accounts, shared collections, roles, and collaboration are outside this feature.
- The experience is intended for modern desktop and mobile web browsers with ordinary internet connectivity.
- Automatic metadata is best-effort because destinations may omit, block, or delay metadata; inability to enrich a valid address never prevents manual saving.
- Metadata retrieval contacts only the destination needed for the bookmark and its declared icon resources; the rest of the private collection is not disclosed.
- Page content snapshots, offline reading, reader mode, automatic broken-link monitoring, and semantic or meaning-based search are outside this feature.
- Saved, named, or pinned searches are reserved for a future enhancement and are outside this feature.
- Standard browser bookmark HTML is the supported portable interchange format; proprietary browser-account synchronization formats are outside this feature.
- Folder names imported from bookmark files become tags because nested folders are not otherwise part of the app's organization model.
- App-produced exports may carry additional app-specific bookmark state while remaining readable by compatible tools that only understand titles and addresses.
- Browser extensions, favorites, automated expiration, and collaborative sharing remain outside this feature.
- Bookmarks persist for the life of the deployment unless the user permanently deletes them.
- The app manages bookmark records but does not control or guarantee the safety, content, or availability of external destinations.
