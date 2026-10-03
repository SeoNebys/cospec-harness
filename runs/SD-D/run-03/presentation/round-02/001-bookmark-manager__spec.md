# Feature Specification: Personal Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-17

**Status**: Draft revision 2 — awaiting client approval

**Input**: Build a personal bookmark manager with automatic page metadata, read-later tracking, advanced search, multi-tag filtering, bulk actions, strict duplicate prevention, formatted notes, and reusable saved views.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a Bookmark by Pasting Its Address (Priority: P1)

As a user, I can paste a web address and save it without typing a title because the app retrieves the page title, description, and site icon for me.

**Why this priority**: Fast, low-effort capture is the core value of the bookmark manager.

**Independent Test**: Start with an empty collection, paste the address of a publicly reachable page, save without entering any other text, and verify that the bookmark persists with retrieved or fallback display information.

**Acceptance Scenarios**:

1. **Given** a new valid web address, **When** the user pastes or enters it, **Then** the app automatically begins retrieving the page title, description, and site icon.
2. **Given** page information is available, **When** retrieval completes, **Then** the retrieved title, description, and icon are shown on the bookmark without requiring the user to type a title.
3. **Given** page information is slow or unavailable, **When** the user saves, **Then** the bookmark is saved without waiting indefinitely, uses a readable title derived from the address, and uses clear empty-description and placeholder-icon states.
4. **Given** retrieved text is present, **When** the user edits the title or description before or after saving, **Then** the user's version is retained instead of being overwritten by a later retrieval result.
5. **Given** the same normalized address is already saved, including when its bookmark is archived, **When** the user attempts to save it again, **Then** no duplicate is created and the app opens the existing bookmark in edit mode.
6. **Given** a bookmark has been saved, **When** the user returns in a later session and opens it, **Then** its information remains available and its destination opens without replacing the bookmark manager.

---

### User Story 2 - Find Bookmarks with Precise Search and Filters (Priority: P2)

As a user with a growing collection, I can combine text, exact phrases, tag expressions, logical operators, status filters, and sorting to find precisely the bookmarks I need.

**Why this priority**: A large collection is useful only when users can reliably retrieve a specific subset.

**Independent Test**: Seed bookmarks with overlapping titles, addresses, descriptions, notes, tags, favorite states, reading states, and dates; verify simple queries, quoted phrases, `#tag` expressions, `AND`, `OR`, combined filters, and each sort order against known results.

**Acceptance Scenarios**:

1. **Given** matching bookmarks exist, **When** the user enters ordinary search terms, **Then** results contain all terms using case-insensitive partial matching across title, address, description, note text, and tags.
2. **Given** bookmarks contain distinct phrases, **When** the user encloses a phrase in quotation marks, **Then** only bookmarks containing that contiguous phrase within a searchable field are returned.
3. **Given** tagged bookmarks exist, **When** the user searches for `#news`, **Then** only bookmarks with the `news` tag are returned.
4. **Given** multiple search terms or expressions, **When** the user combines them with `AND` or `OR`, **Then** `AND` requires both sides, `OR` permits either side, and `AND` is evaluated before `OR`.
5. **Given** bookmarks have multiple tags and statuses, **When** the user selects two or more tag filters and optionally favorite or read-later filters, **Then** results satisfy every selected tag and every other active filter.
6. **Given** multiple bookmarks are visible, **When** the user sorts by newest created, oldest created, recently modified, or title, **Then** all results are ordered accordingly.
7. **Given** a search expression is incomplete or invalid, **When** it is evaluated, **Then** the app identifies the problem and provides concise syntax guidance without changing any bookmarks.

---

### User Story 3 - Maintain a Read-Later List (Priority: P3)

As a user, I can mark a bookmark as unread for later, review all unread bookmarks in a dedicated view, and mark them read when finished.

**Why this priority**: Reading intent is different from importance, so it must remain independent from favorites.

**Independent Test**: Mark favorite and non-favorite bookmarks for later, open the Read Later view, mark one as read, and verify that it leaves that view while its favorite state and other details remain unchanged.

**Acceptance Scenarios**:

1. **Given** a bookmark is not in Read Later, **When** the user marks it for later, **Then** it appears in the Read Later view and its favorite state is unchanged.
2. **Given** a bookmark is in Read Later, **When** the user marks it as read, **Then** it leaves the Read Later view and remains in the active collection.
3. **Given** a new bookmark is being saved, **When** the user chooses the Read Later option, **Then** it is saved as unread and appears in the Read Later view.
4. **Given** active unread bookmarks exist, **When** the user opens Read Later, **Then** only active bookmarks currently marked unread are shown and may be searched, filtered, and sorted.

---

### User Story 4 - Organize and Annotate Bookmarks (Priority: P4)

As a user, I can edit metadata, add tags, favorite or archive links, and write readable formatted notes so the collection reflects my own context.

**Why this priority**: Personal organization adds long-term value after capture and retrieval work reliably.

**Independent Test**: Save a bookmark, change its title and description, add multiple tags, favorite it, write and format a note, archive it, and restore it while verifying that all details and states persist.

**Acceptance Scenarios**:

1. **Given** a bookmark exists, **When** the user changes its title, description, address, tags, or note, **Then** valid changes persist and the modification date is refreshed.
2. **Given** the user applies supported formatting to a note, **When** the bookmark is viewed, **Then** the note displays the intended headings, emphasis, lists, links, and inline code rather than raw formatting markers.
3. **Given** a bookmark exists, **When** the user marks or unmarks it as a favorite, **Then** only its favorite state changes and favorite filtering reflects the change.
4. **Given** an active bookmark exists, **When** the user archives it, **Then** it leaves active and Read Later results and appears in the archived view with its favorite and reading states retained.
5. **Given** an archived bookmark exists, **When** the user restores it, **Then** it returns to the active collection and any retained unread state returns it to Read Later.

---

### User Story 5 - Act on Many Bookmarks at Once (Priority: P5)

As a user, I can select individual bookmarks or every bookmark in the current search and filter result, then apply one organization action to all of them.

**Why this priority**: Bulk actions make large collections practical to maintain.

**Independent Test**: Produce a filtered result set, select all matching results, apply each supported bulk action in turn, and verify that bookmarks outside the result set remain unchanged.

**Acceptance Scenarios**:

1. **Given** a collection result is visible, **When** the user selects individual bookmarks, **Then** the app shows the selected count and makes bulk actions available.
2. **Given** search or filters produce a result set, **When** the user chooses to select all results, **Then** every bookmark matching that current result is selected, including matches not currently visible on screen.
3. **Given** bookmarks are selected, **When** the user adds or removes tags, favorites or unfavorites, marks read or unread, archives or restores, **Then** the chosen change is applied to every selected bookmark and no unselected bookmark.
4. **Given** bookmarks are selected, **When** the user requests bulk deletion, **Then** the app displays the number of bookmarks to be permanently deleted and requires explicit confirmation.
5. **Given** the search, filters, collection scope, or saved view changes, **When** a selection exists, **Then** the selection is cleared so a bulk action cannot silently affect a previous result set.

---

### User Story 6 - Correct or Remove a Bookmark (Priority: P6)

As a user, I can correct outdated bookmark information and permanently delete links I no longer want.

**Why this priority**: Individual maintenance is necessary over time but follows the higher-value capture, retrieval, and organization workflows.

**Independent Test**: Edit every editable field of a saved bookmark, confirm changes survive a later session, then delete it and verify it no longer appears in any view or saved-view result.

**Acceptance Scenarios**:

1. **Given** a bookmark exists, **When** the user changes its address to another valid address, **Then** duplicate prevention is rechecked and fresh page information is requested without silently replacing text the user previously customized.
2. **Given** the user introduces an invalid required value while editing, **When** they try to save, **Then** the existing bookmark remains unchanged and the address field displays actionable guidance.
3. **Given** a bookmark exists, **When** the user requests deletion, **Then** the app asks for confirmation before permanently removing it.
4. **Given** the user confirms deletion, **When** deletion completes, **Then** the bookmark no longer appears in active, favorite, tagged, Read Later, search, archived, or saved-view results.

---

### User Story 7 - Reuse a Saved View (Priority: P7)

As a user, I can name and save a useful combination of search expression, tags, statuses, scope, and sort order so I can return to the same live view later.

**Why this priority**: Saved views reduce repeated setup for recurring searches but are less urgent than the core management workflows.

**Independent Test**: Configure a search with multiple tags and statuses, save it, change the collection, reopen the saved view, and verify that the stored criteria run against the current bookmarks.

**Acceptance Scenarios**:

1. **Given** search, filter, scope, or sort criteria are active, **When** the user supplies a unique non-empty name and saves the view, **Then** the named view becomes available for later reuse.
2. **Given** a saved view exists, **When** the user opens it, **Then** its stored criteria are restored and evaluated against the current collection rather than an old snapshot.
3. **Given** a saved view exists, **When** the user renames it, updates it from current criteria, or deletes it after confirmation, **Then** the saved-view list reflects the change without altering any bookmarks.

### Edge Cases

- Leading or trailing spaces around an entered address are ignored before validation, duplicate comparison, and saving.
- Address comparison ignores capitalization in the scheme and host, removes a default port, and treats an empty path and `/` as equivalent; other path, query, and fragment differences remain distinct.
- If an existing match is archived, a duplicate attempt opens that archived bookmark and offers restoration rather than creating another bookmark.
- If metadata retrieval encounters a redirect, missing metadata, an unreachable destination, or a page that refuses access, capture still succeeds with available information and clear fallbacks.
- A late metadata response never overwrites title or description text that the user has edited.
- Empty addresses, malformed addresses, and schemes other than `http://` or `https://` are rejected with field-specific guidance.
- Tags that differ only by capitalization or surrounding spaces are treated as the same tag.
- In search, adjacent terms have the same meaning as `AND`; quoted phrases cannot span separate bookmark fields; `#tag` requires an exact tag name match; and multiword tags use a quoted form such as `#"machine learning"`.
- An unmatched quote, a standalone `#`, or a logical operator missing one side is invalid search syntax and produces guidance rather than partial results.
- Parentheses and negation are not supported in the initial search syntax.
- An empty collection, an empty Read Later list, and criteria with no matches have distinct empty states and relevant recovery actions.
- Clearing search or filters restores the applicable collection without changing any bookmark.
- Very long titles, addresses, descriptions, and notes remain readable without obscuring controls or breaking the collection layout.
- Archived bookmarks retain favorite and unread states but are excluded from active favorites and Read Later until restored.
- A saved view whose referenced tag no longer exists remains editable and displays an empty result rather than failing.
- Cancelling an edit, single deletion, or bulk deletion leaves bookmarks unchanged.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST let the user create a bookmark by providing only a valid `http://` or `https://` address; title, description, site icon, notes, tags, favorite state, and reading state MUST NOT be required inputs.
- **FR-002**: On entry of a valid new address, the app MUST automatically attempt to retrieve the destination page's title, description, and site icon and show retrieval progress without blocking the user indefinitely.
- **FR-003**: The user MUST be able to save before metadata retrieval completes; unavailable metadata MUST use a readable address-derived title, an empty description, and a placeholder icon.
- **FR-004**: Retrieved title and description MUST remain editable before and after saving; a late or refreshed retrieval MUST NOT overwrite a field the user has manually changed unless the user explicitly chooses the retrieved replacement.
- **FR-005**: The app MUST prevent duplicate bookmark addresses. Duplicate comparison MUST ignore surrounding whitespace and capitalization in scheme and host, remove default ports, and treat an empty path and `/` as equivalent while preserving other path, query, and fragment distinctions.
- **FR-006**: When a duplicate is detected during creation, the app MUST create no new bookmark and MUST open the existing bookmark in edit mode. When detected during address editing, the bookmark being edited MUST retain its previous address and the existing matching bookmark MUST open in edit mode. This behavior MUST also apply when the match is archived.
- **FR-007**: The app MUST display active bookmarks as a browsable collection showing, at minimum, site icon, title, destination address, description when present, tags, favorite state, reading state, and creation date.
- **FR-008**: The user MUST be able to open a bookmark's destination without losing their current place in the bookmark manager.
- **FR-009**: The app MUST retain bookmarks, bookmark changes, and saved views between user sessions until the user deletes them.
- **FR-010**: The user MUST be able to edit a bookmark's address, title, description, formatted note, and tags and to change its favorite, reading, and archive states.
- **FR-011**: Changing a bookmark address MUST re-run validation and duplicate detection and attempt fresh metadata retrieval while preserving manually customized text unless the user accepts a replacement.
- **FR-012**: The user MUST be able to permanently delete one bookmark only after explicit confirmation.
- **FR-013**: The user MUST be able to add and remove tags; within a bookmark, tags that differ only by capitalization or surrounding whitespace MUST be treated as the same tag.
- **FR-014**: The user MUST be able to mark or unmark a bookmark as a favorite independently of its reading and archive states.
- **FR-015**: The user MUST be able to mark an active bookmark unread for Read Later and mark it read to remove it from Read Later; new bookmarks MUST default to read unless the user chooses Read Later during capture.
- **FR-016**: The user MUST be able to archive and restore a bookmark; archived bookmarks MUST be excluded from active and Read Later results while retaining all metadata, tags, favorite state, and reading state.
- **FR-017**: Ordinary search terms MUST use case-insensitive partial matching across title, destination address, description, plain note text, and tags; adjacent terms MUST default to `AND`.
- **FR-018**: Search MUST support quoted exact phrases, exact tag expressions using `#tag` and `#"multiword tag"`, and case-insensitive `AND` and `OR` operators, with `AND` evaluated before `OR`.
- **FR-019**: Invalid or incomplete search syntax MUST produce a specific explanation and concise syntax guidance without modifying bookmarks.
- **FR-020**: The user MUST be able to combine search with filters for favorite state, reading state, and multiple tags; a bookmark MUST contain every selected tag and satisfy every other active filter to appear.
- **FR-021**: The user MUST be able to sort the current results by newest created, oldest created, recently modified, or title; newest created MUST be the default.
- **FR-022**: The app MUST provide clearly identified Active, Read Later, and Archived scopes; search, filters, and sorting MUST work within each applicable scope.
- **FR-023**: The user MUST be able to select individual bookmarks or select every bookmark in the current search-and-filter result, including results not currently visible on screen.
- **FR-024**: The app MUST show the current selection count and clear the selection when the user changes search, filters, scope, or saved view.
- **FR-025**: The user MUST be able to apply these bulk actions to the selection: add tags, remove tags, favorite, unfavorite, mark unread, mark read, archive, restore, and permanently delete.
- **FR-026**: Bulk deletion MUST display the number of affected bookmarks and require explicit confirmation; every bulk action MUST leave unselected bookmarks unchanged and report the number successfully affected.
- **FR-027**: Bookmark notes MUST support headings, bold, italic, unordered and ordered lists, links, and inline code and MUST display as formatted content when the bookmark is viewed.
- **FR-028**: Formatted notes MUST treat user-entered content as display content and MUST NOT execute embedded scripts or other active content.
- **FR-029**: The user MUST be able to save current search text, selected tags, favorite and reading filters, collection scope, and sort order as a named saved view; names MUST be non-empty and unique after ignoring surrounding whitespace and letter case.
- **FR-030**: The user MUST be able to open, rename, update, and delete a saved view; deletion MUST require confirmation, and opening the view MUST evaluate its stored criteria against the current collection rather than restoring an old result snapshot.
- **FR-031**: The app MUST show helpful, distinct empty states for an empty collection, an empty Read Later scope, and valid criteria with no matches, including an appropriate next action.
- **FR-032**: The app MUST record when each bookmark was created and most recently modified and make both dates available when viewing its details.
- **FR-033**: All core bookmark, advanced-search, saved-view, and bulk-selection workflows MUST be operable by keyboard with visible focus and programmatically identifiable controls, states, and validation messages.
- **FR-034**: The collection, forms, formatted notes, search tools, saved views, and bulk-action controls MUST remain usable on common phone and desktop screen sizes without horizontal page scrolling.

### Key Entities

- **Bookmark**: A unique saved web destination with its original address, normalized comparison identity, retrieved or fallback title, optional description, site icon or placeholder, optional formatted note, zero or more tags, favorite state, reading state, archive state, creation date, and modification date.
- **Tag**: A user-defined label associated with one or more bookmarks and usable in filters, search expressions, bulk actions, and saved views.
- **Saved View**: A uniquely named, reusable definition containing search text, selected tags, favorite and reading filters, collection scope, and sort order. It stores criteria, not bookmark results.
- **Collection View State**: The user's current active, Read Later, or Archived scope plus search expression, filters, and sort order. It changes which bookmarks are visible without altering them.
- **Selection**: The set of bookmarks chosen individually or from the complete current result set for one bulk action. It is cleared when the defining view criteria change.

## Scope Boundaries

### Included in This Feature

- A personal, single-user bookmark collection.
- Address-only capture with automatic page title, description, and site-icon retrieval plus graceful fallbacks.
- Strict prevention of duplicate normalized addresses.
- Browsing, opening, editing, permanent deletion, tagging, favoriting, Read Later tracking, archiving, and restoring.
- Basic formatted bookmark notes.
- Plain and structured search, multi-tag and status filtering, sorting, and named saved views.
- Individual selection, selection of all current results, and bulk organization or deletion actions.
- Persistent use across sessions on the same app installation.
- Responsive and keyboard-accessible core workflows.

### Out of Scope for This Feature

- User accounts, authentication, multiple users, shared collections, and collaboration.
- Cross-device synchronization or cloud backup.
- Browser extensions, automatic browser-history capture, and native mobile applications.
- Import from or export to browser bookmark files or other services.
- Full-page content capture, offline reading copies, and searching the destination page beyond retrieved metadata.
- Detecting duplicate destinations that use unrelated aliases, shortened addresses, or different query parameters.
- Link-health monitoring, reminders, nested folders, and standalone tag administration.
- Parentheses, negation, proximity operators, or other search syntax beyond the expressions specified here.
- Note attachments, tables, embedded media, arbitrary styling, and executable note content.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Given a reachable page address, at least 90% of first-time users can save a useful bookmark by pasting only the address within 15 seconds and without assistance.
- **SC-002**: Under normal network conditions, at least 95% of tested public pages that expose a title, description, or site icon show each available item on the bookmark within 5 seconds; unavailable items consistently use the defined fallbacks.
- **SC-003**: In acceptance testing, 100% of attempts to save a duplicate normalized address create no additional bookmark and lead to the existing bookmark.
- **SC-004**: With a collection of 10,000 bookmarks, at least 95% of search, filter, and sort actions visibly update results within 1 second under normal operating conditions.
- **SC-005**: Across a representative seeded collection, every valid combination of ordinary terms, quoted phrases, tag expressions, `AND`, `OR`, multi-tag filters, and status filters returns exactly the expected bookmarks.
- **SC-006**: In a usability test, at least 90% of first-time users can add a bookmark to Read Later, locate it there, and mark it read without assistance.
- **SC-007**: A user can select all results from a filtered set and apply a supported bulk action to 1,000 bookmarks within 10 seconds, with no bookmark outside the selected result changed.
- **SC-008**: In acceptance testing, every supported note-formatting option is retained between sessions, displays correctly when viewed, and never executes active content.
- **SC-009**: Opening a saved view restores all stored criteria and evaluates them against the current collection in 100% of acceptance-test cases.
- **SC-010**: All valid bookmark and saved-view changes completed in one session are present in a later session, while cancelled or invalid changes are not applied.
- **SC-011**: In accessibility verification, every core workflow—including metadata-assisted capture, advanced search, Read Later, saved views, and bulk actions—can be completed using only a keyboard.
- **SC-012**: Core workflows can be completed at screen widths from 320 pixels through standard desktop sizes without horizontal page scrolling.

## Assumptions

- The initial release serves one person per app installation; identity and access control are outside this scope.
- Data persists on the same app installation; synchronization and backup across devices are separate future capabilities.
- Bookmark destinations are ordinary web pages using `http://` or `https://`; metadata availability depends on what the destination exposes and permits the app to retrieve.
- Metadata retrieval is best-effort and may finish after saving; capture remains useful when a destination is unavailable.
- Duplicate identity is based on the normalization rules in FR-005, not page-content similarity or recognition of unrelated aliases and shortened addresses.
- New bookmarks are treated as read unless the user explicitly marks them for Read Later during or after capture.
- Multiple tags selected in the filter controls use all-tags matching; users can express alternatives with `OR` in search.
- Basic note formatting comprises headings, bold, italic, ordered and unordered lists, links, and inline code.
- Saved views are live reusable criteria and never freeze, copy, or own their matching bookmarks.
- Bulk “select all” applies to the complete current result set, not only the portion currently visible on screen.
- A flat tag system is sufficient; folders and tag hierarchies are not required.
- Deletion is permanent after confirmation; recovery from a trash area is not included.
- The user has a modern browser and a stable local operating environment.
