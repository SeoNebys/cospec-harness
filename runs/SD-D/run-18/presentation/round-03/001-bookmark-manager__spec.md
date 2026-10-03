# Feature Specification: Bookmark Manager

**Feature Branch**: `[001-bookmark-manager]`

**Created**: 2026-09-24

**Status**: Draft — Revised

**Input**: User description: "Build an app to save and manage bookmarks, including automatic page details, a retained readable copy of each saved page or the original PDF, read-later status, archiving, advanced search, bulk actions, rich notes, saved searches, browser import/export, and display preferences."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a Bookmark with Automatic Details (Priority: P1)

As a user, I want to paste a web address and have the app retrieve useful page details so that saving a recognizable bookmark requires minimal typing.

**Why this priority**: Fast, automatic capture is central to the desired experience and supplies the information used by browsing and search.

**Independent Test**: Paste a public page address, confirm that its title, description, site icon, and preview image are retrieved when available, edit the proposed details, and save the bookmark.

**Acceptance Scenarios**:

1. **Given** the user enters a valid public web address, **When** detail retrieval succeeds, **Then** the proposed bookmark displays the page title, description, site icon, and preview image that were available from the page before saving.
2. **Given** automatic details have been proposed, **When** the user edits the title or description or replaces or removes an image, **Then** the user's version is saved instead of the retrieved value.
3. **Given** some or all page details cannot be retrieved, **When** retrieval completes or times out, **Then** the app identifies the unavailable details and still allows the user to enter them manually and save the bookmark.
4. **Given** a bookmark has already been saved, **When** the user edits its title, description, site icon, preview image, notes, or tags, **Then** the changes persist and are reflected wherever that bookmark appears.
5. **Given** the entered address is missing or invalid, **When** the user attempts to continue, **Then** no retrieval or save occurs and the user receives a field-specific explanation.
6. **Given** the address matches an existing bookmark under the app's duplicate rule, **When** the user attempts to save it, **Then** the app identifies the existing bookmark and offers to open or update it instead of silently creating a duplicate.

---

### User Story 2 - Find Bookmarks with Smart Search (Priority: P1)

As a user, I want to browse, filter, sort, and express precise searches so that I can quickly retrieve a bookmark from a large collection.

**Why this priority**: A saved collection remains useful only when users can reliably find what they remember about an item.

**Independent Test**: Populate the library with varied content and verify plain terms, `#tag` terms, exact phrases, AND, OR, exclusions, grouped expressions, tag filters, and sorting against known result sets.

**Acceptance Scenarios**:

1. **Given** active bookmarks exist, **When** the user opens the main library, **Then** the bookmarks appear using the user's default sort order or most-recently-saved first when no preference has been chosen.
2. **Given** bookmarks contain different titles, addresses, descriptions, notes, and tags, **When** the user enters plain search terms, **Then** matching is case-insensitive across all of those fields and adjacent terms require all terms to match.
3. **Given** bookmarks have different tags, **When** the user searches for `#tagname`, **Then** only bookmarks with that tag match.
4. **Given** a multi-word phrase appears in some bookmarks, **When** the user encloses it in quotation marks, **Then** only bookmarks containing that exact phrase match.
5. **Given** a collection with varied content, **When** the user combines terms with AND, OR, exclusions, or parentheses, **Then** results reflect the combined expression using the documented search rules.
6. **Given** a search expression is incomplete or invalid, **When** the app evaluates it, **Then** the app identifies the problem and provides a correction hint without discarding the entered search.
7. **Given** the library is displayed, **When** the user applies tag filters or sorts by title, date saved, or date last updated, **Then** the visible result set updates accordingly and active criteria can be cleared.
8. **Given** no active bookmarks match, **When** results are evaluated, **Then** the user sees a clear empty state and can remove the active criteria.

---

### User Story 3 - Manage a Read-Later Queue (Priority: P1)

As a user, I want saved bookmarks to have unread or read status and a dedicated unread view so that I can use the app as a reading queue.

**Why this priority**: Returning to unread material is a primary reason the user saves links.

**Independent Test**: Save bookmarks as unread, view only unread active bookmarks, mark individual and multiple items read or unread, and confirm the unread view updates immediately.

**Acceptance Scenarios**:

1. **Given** the user is saving a bookmark, **When** they accept the default or explicitly choose a reading status, **Then** the bookmark is saved as unread by default or with the selected read status.
2. **Given** active unread bookmarks exist, **When** the user opens the unread view, **Then** only active unread bookmarks are displayed.
3. **Given** an unread bookmark is visible, **When** the user marks it read, **Then** it immediately leaves the unread view but remains in the main library.
4. **Given** a read bookmark exists, **When** the user marks it unread, **Then** it appears in the unread view if it is not archived.
5. **Given** the user opens a bookmark, **When** navigation begins, **Then** its reading status remains unchanged unless the user explicitly changes it.

---

### User Story 4 - Keep a Readable Offline Copy (Priority: P1)

As a user, I want the app to retain the page I saved so that I can still read what I originally bookmarked if the live page changes, disappears, or becomes inaccessible.

**Why this priority**: Preserving the saved material is a core reason to entrust links to the app, especially for a read-later collection.

**Independent Test**: Save a representative public web page and a PDF, disconnect access to the originals, and verify that the captured page remains readable and recognizable and that the retained PDF matches the original document.

**Acceptance Scenarios**:

1. **Given** a standard web page is accessible when its bookmark is saved, **When** capture completes, **Then** the bookmark contains an offline copy of the page as it appeared at capture time, including its readable content, structure, styling, and essential content images.
2. **Given** a saved address resolves directly to a PDF, **When** capture completes, **Then** the app retains the original PDF file rather than converting it into a page copy.
3. **Given** a bookmark has an available saved copy, **When** the original address is unavailable or the user has no network connection, **Then** the user can open and read the retained copy from the bookmark.
4. **Given** a bookmark is being captured, **When** the user views it, **Then** the app shows whether its saved copy is pending, available, or failed and shows the capture date when available.
5. **Given** capture fails or only an incomplete page can be obtained, **When** the attempt ends, **Then** the bookmark remains saved, the limitation is explained, and the user can retry capture.
6. **Given** a bookmark with a saved copy is archived and later restored, **When** the user opens the retained copy, **Then** it remains unchanged and available throughout that lifecycle.
7. **Given** a bookmark has an available saved copy, **When** the live page later changes, **Then** the retained copy is not silently replaced.
8. **Given** a bookmark with a saved copy is selected for permanent deletion, **When** the user reviews the confirmation, **Then** the app states that the retained page or PDF will also be permanently removed.

---

### User Story 5 - Archive and Restore Bookmarks (Priority: P2)

As a user, I want to archive links without deleting them so that I can remove finished or inactive material from everyday views while retaining it.

**Why this priority**: Archiving keeps normal browsing and search focused while preserving information that may be useful later.

**Independent Test**: Archive a bookmark, confirm it disappears from the main library, normal search, and unread view, then find it in the archive and restore it with its details and reading status intact.

**Acceptance Scenarios**:

1. **Given** an active bookmark, **When** the user archives it, **Then** it is hidden from the main library, ordinary searches, tag views, and the unread view.
2. **Given** archived bookmarks exist, **When** the user opens the archive, **Then** archived items can be browsed, searched with the same search language, filtered, and sorted separately.
3. **Given** an archived bookmark, **When** the user restores it, **Then** it returns to the active library with its content, tags, and read status unchanged.
4. **Given** an archived bookmark, **When** the user permanently deletes it and confirms, **Then** it is removed from the archive and cannot be restored through the app.

---

### User Story 6 - Maintain Bookmarks Individually or in Bulk (Priority: P2)

As a user, I want to edit, tag, change reading status, archive, or delete one or many bookmarks so that routine collection cleanup is efficient.

**Why this priority**: Bulk maintenance becomes essential as the collection grows, while explicit confirmation protects against unintended loss.

**Independent Test**: Select a mixed group of bookmarks, apply each supported bulk action, verify the result count and state changes, and verify that cancelling bulk deletion leaves every selected item unchanged.

**Acceptance Scenarios**:

1. **Given** bookmarks are visible in a collection view, **When** the user enters selection mode and selects multiple items, **Then** the app shows the selection count and offers bulk tagging, read/unread, archive or restore where applicable, and permanent deletion.
2. **Given** multiple bookmarks are selected, **When** the user adds or removes a tag in bulk, **Then** the requested tag change is applied to every selected bookmark without replacing their other tags.
3. **Given** multiple bookmarks are selected, **When** the user applies a read, unread, archive, or restore action, **Then** every eligible selected bookmark receives the requested state.
4. **Given** one or more bookmarks are selected for permanent deletion, **When** the user initiates deletion, **Then** the app identifies the number of affected items and requires explicit confirmation.
5. **Given** a bulk operation cannot be completed for every selected bookmark, **When** processing ends, **Then** the app reports how many succeeded and identifies items that still need attention without falsely reporting full success.
6. **Given** an existing bookmark, **When** the user edits its address, content details, reading status, tags, or rich note, **Then** the update persists while the original saved date remains unchanged and the last-updated date changes.

---

### User Story 7 - Add Rich Notes and Reuse Searches (Priority: P3)

As a user, I want longer formatted notes and named saved views so that bookmarks can carry useful context and recurring searches take one action to revisit.

**Why this priority**: These capabilities deepen organization after the core capture, retrieval, and lifecycle flows are working.

**Independent Test**: Add a formatted note and verify its display, then save a combined search-and-tag view, reopen it by name, edit it, and delete it.

**Acceptance Scenarios**:

1. **Given** a bookmark is being created or edited, **When** the user adds headings, lists, emphasis, or links to its note, **Then** the note is preserved and rendered with that formatting when viewed later.
2. **Given** a search expression and tag filters are active, **When** the user saves them under a unique name, **Then** that named view becomes available for later reuse.
3. **Given** a saved view exists, **When** the user opens it, **Then** the current collection is evaluated using its stored search and tag criteria.
4. **Given** a saved view exists, **When** the user renames it, changes its criteria, or deletes it, **Then** the saved-view list reflects the change without altering any bookmarks.

---

### User Story 8 - Move Data and Set Display Preferences (Priority: P4)

As a user, I want to import and export browser bookmarks and retain display choices so that adopting and repeatedly using the app is convenient.

**Why this priority**: Portability and personalization support adoption and comfort, but they depend on the core bookmark model and collection views.

**Independent Test**: Import a representative browser bookmark file, review its summary, export a chosen bookmark scope, inspect the result in a compatible browser, and verify default sort and text-size preferences after restarting the app.

**Acceptance Scenarios**:

1. **Given** the user selects a valid browser bookmark export file, **When** import completes, **Then** supported bookmarks are added with titles and addresses, folder names are retained as tags, duplicates are not silently created, and a success, duplicate, and failure summary is shown.
2. **Given** the import file is invalid or contains unsupported entries, **When** the app processes it, **Then** existing bookmarks remain intact and the user receives an actionable explanation of skipped or failed entries.
3. **Given** newly imported bookmarks have been created, **When** the import itself finishes, **Then** saved-copy capture continues for those bookmarks with aggregate progress visible and without delaying access to the imported links.
4. **Given** the user chooses active bookmarks, archived bookmarks, or both, **When** they export, **Then** the app produces a browser-compatible bookmark file and states which app-specific details the format cannot preserve.
5. **Given** the user selects a default sort order and supported text size, **When** they revisit or restart the app, **Then** those preferences remain in effect across applicable collection views.

### Edge Cases

- A page blocks automated access, requires authentication, redirects repeatedly, responds slowly, or exposes only some desired details; saving must remain possible with clear retrieval status.
- A page can supply metadata but blocks full-page capture, loads important content only after interaction, contains frames, or requires an authenticated session; the app must distinguish metadata success from saved-copy success.
- A page contains animations, audio, video, interactive controls, advertisements, comments loaded later, or other changing material; the retained copy must remain safe and readable even when those elements cannot be reproduced.
- An address claims to be a PDF but returns another type of content, or a PDF is extremely large, password-protected, malformed, or only partially downloaded; the app must report what was retained and must not label an incomplete file as available.
- The live page changes while capture is in progress, or its address is edited after capture; the app must preserve the completed copy and must not silently associate a different page with it.
- A retrieved title or description is blank, extremely long, malformed, or in a different language; the user must be able to review and replace it.
- A site icon or preview image is unavailable, later disappears, is unusually large, or cannot be displayed; the bookmark must remain usable without it.
- The same address is entered in a textually different but equivalent form; the app must apply one consistent duplicate rule and explain the detected match.
- A title, description, note, tag, saved-view name, or search contains non-Latin characters, punctuation, or leading or trailing whitespace.
- A search contains quoted operators, a `#` inside a phrase, nested parentheses, multiple exclusions, or words such as "or" in lowercase; parsing must follow the documented syntax consistently.
- An archived unread bookmark must not appear in the unread view until restored, while retaining its unread status.
- A selected item no longer exists or becomes ineligible before a bulk action completes; the result summary must distinguish it from successful items.
- An import contains thousands of bookmarks, duplicate addresses, empty folders, unsupported address types, malformed entries, or repeated folder names.
- A large import creates more saved-copy attempts than can finish immediately; imported bookmarks must remain usable while capture progress and failures continue to be reported.
- A saved view references a tag that has since been removed from every bookmark; opening the view must show an understandable empty state and allow editing.
- The library or any specialized view contains no bookmarks; the app must explain the state and offer a relevant next action.
- An operation fails; the app must retain user-entered information where possible, avoid claiming success, and allow a safe retry.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST allow the user to begin a bookmark by entering a valid web address.
- **FR-002**: After a valid address is entered, the app MUST attempt to retrieve the page title, description, site icon, and preview image and MUST show whether retrieval is in progress, succeeded fully or partially, or failed.
- **FR-003**: The app MUST allow saving when any automatically retrieved detail is unavailable, provided the bookmark has a valid address and a non-empty title supplied either automatically or manually.
- **FR-004**: Before and after saving, the user MUST be able to edit the title and description, replace or remove the site icon and preview image, and edit the address, rich note, and tags.
- **FR-005**: The app MUST reject missing or invalid required values with a field-specific explanation and preserve valid values already entered.
- **FR-006**: The app MUST detect an address matching an existing bookmark under a consistent normalization rule and direct the user to the existing item instead of silently creating a duplicate.
- **FR-007**: Each bookmark MUST retain its address, title, optional description, optional site icon, optional preview image, optional rich note, tags, read status, archive status, date saved, and date last updated.
- **FR-008**: New bookmarks MUST be unread by default, and the user MUST be able to change the proposed status before saving.
- **FR-009**: The user MUST be able to mark any bookmark read or unread without opening it; opening a bookmark MUST NOT automatically change its read status.
- **FR-010**: The app MUST provide a dedicated unread view containing only active unread bookmarks and update it immediately after relevant status changes.
- **FR-011**: The app MUST allow active bookmarks to be archived and archived bookmarks to be restored without changing their content, tags, or read status.
- **FR-012**: Archived bookmarks MUST be excluded from the main library, ordinary search results, ordinary tag views, and the unread view.
- **FR-013**: The app MUST provide a separate archive in which archived bookmarks can be browsed, searched, filtered, sorted, restored, or permanently deleted.
- **FR-014**: The app MUST present active bookmarks in a browsable main library, using the user's default sort order or most-recently-saved first when none is set.
- **FR-015**: Plain search terms MUST match case-insensitively across title, address, description, rich note text, and tags; adjacent unqualified terms MUST use AND behavior.
- **FR-016**: The search language MUST support `#tagname` for tag matching, quoted text for exact-phrase matching, uppercase `AND` and `OR`, a leading minus sign or uppercase `NOT` for exclusion, and parentheses for grouping.
- **FR-017**: Search evaluation MUST apply parentheses first, exclusions second, AND third, and OR last, and the app MUST make these rules available to users near the search experience.
- **FR-018**: Invalid search expressions MUST preserve the user's input and identify the error with a correction hint instead of returning misleading results.
- **FR-019**: The user MUST be able to apply and clear tag filters independently of the search expression.
- **FR-020**: The user MUST be able to sort visible bookmarks by title, date saved, or date last updated in ascending or descending order.
- **FR-021**: The app MUST treat tags case-insensitively for matching and grouping while preserving one consistent display label.
- **FR-022**: The user MUST be able to select multiple bookmarks from applicable collection views, see the current selection count, and clear the selection.
- **FR-023**: Bulk actions MUST allow adding or removing tags without replacing unrelated tags, marking items read or unread, archiving active items, restoring archived items, and permanently deleting items.
- **FR-024**: Permanent deletion of one or many bookmarks MUST require explicit confirmation that identifies the number of affected items.
- **FR-025**: A bulk operation MUST report the number of successful and unsuccessful items and MUST NOT label a partially completed operation as fully successful.
- **FR-026**: Editing a bookmark MUST retain its original saved date and update its last-updated date.
- **FR-027**: Rich notes MUST preserve and display at least headings, bulleted and numbered lists, emphasis, and hyperlinks without allowing note content to perform actions on the user's behalf.
- **FR-028**: The user MUST be able to save the current search expression and tag-filter combination under a unique, non-empty name.
- **FR-029**: Saved views MUST evaluate current bookmark data when opened, and the user MUST be able to rename, edit, and delete them without changing bookmarks.
- **FR-030**: The app MUST import bookmarks from a common browser bookmark export file, retain supported titles and addresses, convert enclosing folder names to tags, apply the standard duplicate rule, and report counts for imported, duplicate, skipped, and failed entries.
- **FR-031**: Import failure MUST NOT alter bookmarks that existed before the import, and partial imports MUST identify entries that were not imported.
- **FR-032**: The app MUST export a user-selected scope of active bookmarks, archived bookmarks, or both to a common browser-compatible bookmark file and disclose any fields the export format cannot retain.
- **FR-033**: The user MUST be able to choose and persist a default sort order and a text-size preference from at least three distinguishable sizes.
- **FR-034**: The app MUST provide a direct action to open a saved address in the user's web-browsing context.
- **FR-035**: The app MUST provide informative empty states for the main library, unread view, archive, saved views, and searches or filters with no matches.
- **FR-036**: Bookmarks, saved views, and preferences MUST remain available to the same user across app and ordinary device restarts.
- **FR-037**: Saving a bookmark MUST begin a saved-copy attempt for the content available at that address at save time without making successful capture a prerequisite for retaining the bookmark.
- **FR-038**: For a standard web page, the saved copy MUST retain the readable content, document structure, styling, and essential content images needed for an offline view that remains recognizable as the captured page.
- **FR-039**: When the saved resource is a PDF, the saved copy MUST retain the original PDF file without converting its pages into a web-page representation.
- **FR-040**: Each bookmark MUST expose a saved-copy status of pending, available, or failed; an available copy MUST include its capture date and resource type, and a failed copy MUST include an actionable explanation.
- **FR-041**: The user MUST be able to open an available saved copy without contacting or depending on the original address.
- **FR-042**: A failed capture MUST preserve the bookmark and its entered details and MUST provide a retry action.
- **FR-043**: A completed saved copy MUST remain unchanged when the live resource changes and MUST remain associated with the bookmark through read-status changes, archiving, and restoration.
- **FR-044**: Editing a bookmark address MUST NOT silently replace or relabel an existing saved copy; the app MUST identify that the copy belongs to the earlier address and offer an explicit new capture.
- **FR-045**: Permanent bookmark deletion MUST disclose that its saved copy will also be deleted and, after confirmation, MUST remove both the bookmark and saved copy.
- **FR-046**: Viewing a saved web-page copy MUST prevent retained page content from executing active behavior or performing actions on the user's behalf.
- **FR-047**: Newly imported bookmarks MUST enter the same saved-copy capture workflow as individually saved bookmarks; import completion MUST NOT wait for all captures, and the user MUST be able to see aggregate capture progress and failures.

### Key Entities

- **Bookmark**: A saved web resource containing an address, title, optional description, optional site icon, optional preview image, optional rich note, zero or more tags, read status, archive status, saved-copy status, date saved, and date last updated.
- **Saved Copy**: An immutable capture associated with a bookmark: either a readable offline representation of a web page and its essential visual assets or the original PDF file, together with capture status, capture date, source address, resource type, and failure information when applicable.
- **Tag**: A user-defined organizational label associated with bookmarks and usable in filters, searches, imports, and bulk changes; capitalization variants represent the same tag.
- **Saved View**: A uniquely named reusable combination of a search expression and zero or more tag filters, evaluated against current bookmarks when opened.
- **Display Preferences**: The user's persisted choices for default bookmark sort order and text size.
- **Import Result**: A summary of imported, duplicate, skipped, and failed entries, with enough detail to understand entries needing attention.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For at least 90% of tested public pages that expose standard page details, title, description, and at least one available image are proposed within 5 seconds of entering the address.
- **SC-002**: At least 90% of first-time users can paste an address, review or adjust the proposed details, and save an unread bookmark without assistance in under 60 seconds.
- **SC-003**: Users can locate a known bookmark in a library of 10,000 items using plain or advanced search in under 10 seconds in at least 95% of usability trials.
- **SC-004**: Search, filtering, sorting, read-status changes, archive or restore actions, and opening saved views produce visible results within 1 second for a library of up to 10,000 bookmarks under normal operating conditions.
- **SC-005**: At least 90% of representative users can save an item, find it in the unread view, open it, and mark it read on their first attempt without external guidance.
- **SC-006**: In acceptance testing, archiving removes 100% of selected bookmarks from ordinary views without data loss, and restoring returns them with their prior content and read status intact.
- **SC-007**: A bulk action on 500 bookmarks completes with an accurate outcome summary within 5 seconds under normal operating conditions.
- **SC-008**: A valid import of 10,000 supported, non-duplicate browser bookmarks retains at least 99.9% of their titles and addresses and produces an accurate result summary.
- **SC-009**: In acceptance testing, 100% of successfully saved bookmarks, saved views, and preferences remain available with unchanged user-entered details after the app restarts.
- **SC-010**: Duplicate attempts, incomplete metadata, invalid searches, empty views, import problems, partial bulk operations, and failed actions each provide a clear next step in 100% of defined acceptance tests.
- **SC-011**: At least 95% of a representative test set of publicly accessible, non-interactive web pages produce an offline copy whose primary text and essential content images remain readable and recognizably arranged when the original is unavailable.
- **SC-012**: In acceptance testing, 100% of successfully captured PDFs remain complete and identical in content to the PDF delivered at capture time.
- **SC-013**: In acceptance testing, every available saved copy can be opened with the original address unavailable, and no retained web-page copy can initiate navigation, downloads, form submissions, or other actions without a new explicit user action.
- **SC-014**: Capture status and a usable bookmark are visible within 2 seconds of saving, even when creation of the offline copy continues in the background or ultimately fails.

## Assumptions

- The first release serves one user with a private bookmark collection; accounts, multi-user permissions, synchronization between devices, and sharing remain outside this feature's scope.
- The initial experience targets a general-purpose screen-based app with a keyboard-and-pointer-friendly interface; dedicated mobile apps and browser extensions remain outside this feature's scope.
- New bookmarks default to unread, but the user can choose read before saving and change the status at any time.
- Automatic detail retrieval targets information made available by the referenced page. Authenticated, blocked, unavailable, or incomplete pages may require manual entry.
- Retrieved details and the offline copy represent what was available at capture time; continuous page monitoring, automatic link-health checking, and automatic refresh are outside this feature's scope.
- Saved web-page copies prioritize the readable page and its recognizable appearance. Server-side features, authenticated interactions, advertisements, analytics, form behavior, animations, audio, video, and other interactive or continuously loaded elements are not guaranteed to work in the retained copy.
- Capture covers content the app can lawfully access at save time without bypassing access controls; the user is responsible for retaining material they are entitled to keep for personal use.
- One retained copy per bookmark is sufficient for the first release. Automatic version history and comparison of page changes are outside this feature's scope; an explicit new capture replaces the prior copy only after user confirmation.
- A common browser bookmark export file means the broadly supported bookmark interchange format produced by major browsers. Enclosing browser folders become tags because a separate folder hierarchy is outside this feature's scope.
- Browser-compatible exports may not preserve rich notes, descriptions, read status, archive status, preview images, saved copies, saved views, or display preferences; the app clearly discloses such limitations before export.
- Favorites, nested collections, and a recycle-bin recovery workflow remain outside this feature's scope.
- Only web addresses intended for normal browser navigation are supported; local files, executable commands, and arbitrary application protocols are excluded.
- The user's device provides the web-browsing context used to open a bookmark.
