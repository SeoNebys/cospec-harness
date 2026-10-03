# Feature Specification: Bookmark Manager

**Feature Branch**: `not-created`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "Build an app to save and manage bookmarks, automatically retrieve page details, support read-later and archive workflows, provide sorting and advanced search, and allow bookmark import and export."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save Bookmarks with Page Details (Priority: P1)

As a user, I can paste a web address and have the app retrieve the page title, a short description, and the site's icon so that saving a useful, recognizable bookmark requires minimal manual work.

**Why this priority**: Fast capture with useful details is the core experience and the main advantage over keeping a plain list of links.

**Independent Test**: Paste a valid public web address, review the retrieved details, optionally edit them, save the bookmark, and open it from the collection.

**Acceptance Scenarios**:

1. **Given** a signed-in user entering a valid web address, **When** the address is accepted, **Then** the app retrieves and previews the available page title, short description, and site icon before saving.
2. **Given** retrieved page details, **When** the user edits the title or description and saves, **Then** the user's edited values are stored instead of the retrieved values.
3. **Given** a destination that supplies only some or none of the requested details, **When** retrieval finishes or fails, **Then** the user can still save the bookmark using a useful title derived from its destination, an empty description, and a generic icon as needed.
4. **Given** a saved bookmark, **When** the user selects its web address, **Then** the destination opens without losing the user's place in the collection.
5. **Given** an invalid or unsupported web address, **When** the user tries to continue, **Then** the bookmark is not created and the user receives a clear correction message.
6. **Given** the same destination already exists in the user's collection, **When** they try to save it again, **Then** they are directed to the existing bookmark and can update it instead of creating an accidental duplicate.

---

### User Story 2 - Keep a Read-Later List (Priority: P2)

As a user, I can mark bookmarks to read later, view them as a focused list, and mark them as read when I finish so I can manage an intentional reading queue.

**Why this priority**: Many bookmarks represent unfinished reading rather than permanent reference material, and separating that queue makes saved links actionable.

**Independent Test**: Mark bookmarks for later, view only unread read-later items, mark one as read, and return it to the unread list.

**Acceptance Scenarios**:

1. **Given** a new or existing bookmark, **When** the user marks it to read later, **Then** it appears in the read-later view as unread.
2. **Given** an unread bookmark in the read-later view, **When** the user marks it as read, **Then** it leaves the default unread list but remains in the collection.
3. **Given** a bookmark previously marked as read, **When** the user marks it unread again, **Then** it returns to the unread read-later list.
4. **Given** a bookmark not in the reading queue, **When** the user views the unread read-later list, **Then** that bookmark is not shown.

---

### User Story 3 - Find and Order Bookmarks (Priority: P3)

As a user with many saved bookmarks, I can search for words or exact phrases, combine tags and other filters, and sort results so I can narrow the collection and review it in a useful order.

**Why this priority**: A growing collection becomes difficult to use unless retrieval supports both precise queries and predictable ordering.

**Independent Test**: Populate a collection with varied details, tags, dates, and states; then verify word search, quoted exact phrases, combined-tag filters, state filters, and each sort order.

**Acceptance Scenarios**:

1. **Given** a collection containing multiple bookmarks, **When** the user enters unquoted search words, **Then** bookmarks matching all entered words across title, address, description, personal notes, or tags are shown regardless of letter case.
2. **Given** bookmark details containing a multi-word phrase, **When** the user encloses that phrase in quotation marks, **Then** only bookmarks containing the words together in that order are shown.
3. **Given** bookmarks with different tags, **When** the user selects two or more tag filters, **Then** only bookmarks containing every selected tag are shown.
4. **Given** bookmarks with different favorite and read-later states, **When** the user applies those state filters, **Then** only bookmarks satisfying all selected filters are shown.
5. **Given** a bookmark list or search result, **When** the user sorts by title or date added in either direction, **Then** all displayed items are reordered accordingly without changing the active search or filters.
6. **Given** a search or filter with no matches, **When** results are displayed, **Then** the user sees a helpful empty state and a way to clear the search or filters.
7. **Given** active search terms, filters, or sorting, **When** the user clears them, **Then** the default collection view returns.

---

### User Story 4 - Organize, Archive, and Maintain Bookmarks (Priority: P4)

As a user, I can edit bookmark details, add reusable tags and personal notes, mark important bookmarks as favorites, archive links I want out of the way, restore archived links, and permanently delete links I no longer need.

**Why this priority**: Long-term maintenance keeps the collection useful while offering a reversible alternative to deletion.

**Independent Test**: Edit a bookmark, change its tags and favorite state, archive and restore it, then permanently delete it with confirmation.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user changes its title, description, personal notes, web address, or tags and saves, **Then** the updated details replace the prior details and the last-updated date changes.
2. **Given** an existing bookmark, **When** the user marks or unmarks it as a favorite, **Then** its favorite state changes immediately and remains correct on the next visit.
3. **Given** tags already used in the collection, **When** the user organizes another bookmark, **Then** they can reuse existing tags or create a new tag.
4. **Given** an active bookmark, **When** the user archives it, **Then** it is removed from the normal collection and read-later views and appears in the archive.
5. **Given** an archived bookmark, **When** the user restores it, **Then** it returns to the normal collection with its details and prior read-later state intact.
6. **Given** an existing bookmark, **When** the user chooses to delete it and confirms the action, **Then** it is permanently removed from the collection and all views.

---

### User Story 5 - Bring Bookmarks In and Take Them Out (Priority: P5)

As a user, I can import bookmarks I already have and export my collection so I can adopt the app without starting over and retain control of my data.

**Why this priority**: Data portability reduces the cost and risk of adopting the app, although it does not block the core save-and-find workflow.

**Independent Test**: Import a representative browser bookmark export containing valid, invalid, and duplicate entries; review the result; then export the collection and verify that saved details and states are represented.

**Acceptance Scenarios**:

1. **Given** a bookmark export file from Chrome, Edge, Firefox, or Safari, **When** the user previews an import, **Then** they see the number of valid new bookmarks, duplicates, and entries that cannot be imported before confirming.
2. **Given** a confirmed import, **When** processing finishes, **Then** valid new bookmarks appear in the collection, duplicates are not created, and failed entries are identified without cancelling successful entries.
3. **Given** imported bookmarks with titles and source groupings, **When** they are added, **Then** their titles are preserved and source groupings are represented as tags where possible.
4. **Given** any non-empty collection, **When** the user requests a complete export, **Then** they receive a reusable copy containing bookmark destinations, user-visible details, tags, favorite state, read-later state, archive state, and relevant dates.
5. **Given** a complete export and an empty collection, **When** the user imports that export, **Then** the collection is restored with all exported details and states intact.

### Edge Cases

- The collection has no bookmarks yet; the user sees a clear starting action instead of an empty list without guidance.
- Page details are missing, slow to arrive, inaccessible, or reported in an unsupported form; saving remains possible with clear fallbacks.
- Retrieved text or an icon contains unsafe or malformed content; it is not allowed to affect the rest of the app or other users.
- A title, description, note, or tag exceeds its stated limit; the user is told what to change without losing other entered values.
- A web address is valid but temporarily unavailable; the user can still save it because availability may change.
- A web address differs from an existing one only by host-name case, a fragment, or a trailing slash; it is treated as the same destination for duplicate detection.
- A saved destination later becomes unavailable; the bookmark remains editable, archivable, restorable, exportable, and removable.
- Search contains unmatched quotation marks, punctuation, mixed case, or extra spaces; the app explains or handles the query predictably.
- A bookmark is both a favorite and a read-later item; both states remain independent.
- An archived bookmark was unread in the reading queue; restoring it returns it to that queue.
- A tag is removed from its last bookmark; it no longer appears as an available filter.
- An import is interrupted or contains thousands of entries; completed results are not duplicated if the user safely retries.
- The user attempts to access another user's bookmark, icon, import result, or export; no private details are revealed.
- A save, edit, archive, restore, import, or export operation fails; the user receives a clear status and a safe retry path.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide each signed-in user with a private bookmark collection associated with their account.
- **FR-002**: Users MUST be able to begin creating a bookmark by providing only a valid HTTP or HTTPS web address.
- **FR-003**: After a valid address is entered, the system MUST attempt to retrieve the destination's page title, short description, and site icon and MUST show the results before the bookmark is saved.
- **FR-004**: If any page detail cannot be retrieved, the system MUST provide a usable fallback and MUST still allow the bookmark to be saved.
- **FR-005**: Users MUST be able to edit a retrieved or fallback title and description before saving, and their edits MUST take precedence over retrieved values.
- **FR-006**: Users MUST be able to add optional plain-text personal notes and zero or more tags to a bookmark.
- **FR-007**: The system MUST validate required fields and web address structure before saving and MUST explain how to correct invalid input.
- **FR-008**: The system MUST prevent accidental duplicates for equivalent destinations within one user's active and archived bookmarks and MUST direct the user to the existing bookmark.
- **FR-009**: The system MUST record and display when each bookmark was created and last updated.
- **FR-010**: Users MUST be able to view bookmarks showing, at minimum, title, destination, description, site icon, tags, favorite state, read-later state, and creation date.
- **FR-011**: Users MUST be able to open a saved destination without losing their current collection state.
- **FR-012**: Users MUST be able to add a bookmark to or remove it from their read-later queue at creation time or later.
- **FR-013**: Users MUST be able to view unread read-later bookmarks separately, mark them as read, and mark them unread again.
- **FR-014**: The system MUST preserve the distinction between a bookmark's read-later, read/unread, favorite, and archive states.
- **FR-015**: Users MUST be able to search bookmark titles, addresses, descriptions, personal notes, and tags using case-insensitive word matching.
- **FR-016**: Users MUST be able to enclose a multi-word query in quotation marks to require an exact phrase match.
- **FR-017**: When a query contains multiple unquoted words, results MUST contain every search word across the searchable bookmark fields.
- **FR-018**: Users MUST be able to filter by one or more tags, and selecting multiple tags MUST return only bookmarks containing every selected tag.
- **FR-019**: Users MUST be able to combine tag, favorite, and read-later filters with a text query.
- **FR-020**: Users MUST be able to sort any displayed bookmark list by title from A to Z or Z to A and by date added from newest to oldest or oldest to newest.
- **FR-021**: Search terms, filters, and sorting MUST continue to apply together until the user changes or clears them.
- **FR-022**: Users MUST be able to edit a bookmark's title, description, personal notes, address, and tags.
- **FR-023**: When a user changes a bookmark's address, the system MUST offer to retrieve page details again without overwriting user-edited details unless the user confirms.
- **FR-024**: Users MUST be able to mark and unmark a bookmark as a favorite.
- **FR-025**: Users MUST be able to create tags while editing a bookmark and reuse tags already present in their collection.
- **FR-026**: Users MUST be able to archive an active bookmark and view archived bookmarks separately.
- **FR-027**: Archived bookmarks MUST be excluded from the normal collection and read-later views unless the user is explicitly viewing or searching the archive.
- **FR-028**: Users MUST be able to restore an archived bookmark with its details and prior states intact.
- **FR-029**: Users MUST be able to permanently delete a bookmark only after explicit confirmation.
- **FR-030**: The system MUST provide actionable empty states for a new collection, an empty read-later queue or archive, and searches or filters with no matches.
- **FR-031**: Users MUST be able to preview and confirm an import from bookmark export files produced by Chrome, Edge, Firefox, and Safari.
- **FR-032**: Before import confirmation, the system MUST report valid new entries, duplicates, and invalid entries; failures MUST NOT prevent valid entries from being imported.
- **FR-033**: Imported source groupings MUST be represented as tags where possible, and imported bookmarks MUST follow the same duplicate rules as manually saved bookmarks.
- **FR-034**: Users MUST be able to export their complete collection, including active and archived bookmarks and all user-visible details, tags, states, and relevant dates, in a reusable form.
- **FR-035**: Users MUST be able to import a complete collection export into an empty collection and restore all exported details and states.
- **FR-036**: The system MUST clearly report the completion, partial completion, or failure of imports and exports.
- **FR-037**: The system MUST preserve user-entered values when an operation fails, except values that would create a security risk.
- **FR-038**: The system MUST ensure users can view and change only bookmarks, tags, imports, and exports belonging to their own account.
- **FR-039**: All primary flows MUST remain usable on both mobile-sized and desktop-sized screens.
- **FR-040**: All primary bookmark management actions MUST be operable by keyboard and provide meaningful labels for assistive technology.

### Scope Boundaries

**Included in this feature**:

- A private bookmark collection for each signed-in user.
- Automatic retrieval and editable preview of page titles, short descriptions, and site icons.
- Creating, browsing, opening, searching, filtering, sorting, editing, favoriting, tagging, archiving, restoring, and deleting bookmarks.
- Read-later and read/unread workflows.
- Import from common browser bookmark files and complete collection export.
- Responsive and accessible primary workflows.

**Not included in this feature**:

- Shared collections, teams, comments, or public bookmark profiles.
- Browser extensions or operating-system share-sheet integrations.
- Live synchronization with browsers or external bookmark providers.
- Offline access, full-text indexing of destination page contents, and automatic broken-link monitoring.
- Folders, nested collections, manual drag-and-drop ordering, and custom sort rules beyond the defined title and date options.

### Deferred Follow-Up Candidate

- **Saved page copies**: Retaining a private snapshot so a user can read a page after its source disappears is valuable, but it is deferred to a separately specified follow-up. That specification must define which page content is captured, how updates and deletion work, what storage limits apply, how unsafe active content is handled, and what privacy and content-rights boundaries apply. Deferral keeps the first release focused while preserving saved copies as an explicit product direction rather than rejecting it.

### Key Entities *(include if feature involves data)*

- **User**: An account holder who owns a private bookmark collection; each user is isolated from every other user's collection.
- **Bookmark**: A saved destination owned by one user, with a web address, title, description, optional personal notes, site icon, favorite state, read-later state, read/unread state, archive state, creation date, last-updated date, and zero or more tags.
- **Tag**: A reusable label within one user's collection; a tag may be associated with many bookmarks and a bookmark may have many tags.
- **Import**: A user-initiated intake of bookmarks from a supported file, with preview counts and an outcome for every entry.
- **Export**: A user-requested reusable copy of their complete collection and its user-visible organization data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of first-time users can save a recognizable bookmark by entering only its address, without assistance, in under 30 seconds.
- **SC-002**: For at least 95% of accessible public pages tested under normal conditions, all available title, description, and site-icon details are previewed within 5 seconds.
- **SC-003**: At least 95% of users can locate a known bookmark in a collection of 1,000 items using search, combined filters, and sorting in under 15 seconds.
- **SC-004**: At least 90% of users can add an item to the read-later queue and later mark it read without assistance on their first attempt.
- **SC-005**: After a successful edit, state change, archive, restore, or delete action, the resulting collection state is visible within 2 seconds under normal conditions.
- **SC-006**: A supported import of 1,000 valid bookmarks completes with an outcome reported for every entry and creates no duplicate destinations.
- **SC-007**: A complete export accounts for 100% of a user's active and archived bookmarks and preserves every user-visible field and state defined in this feature.
- **SC-008**: A user can complete every primary workflow using only a keyboard, with no loss of information or functionality.
- **SC-009**: In acceptance testing, 100% of attempts to access another user's bookmarks, icons, import results, or exports are denied without revealing private details.
- **SC-010**: At least 90% of usability-test participants rate saving and finding bookmarks as easy or very easy.
- **SC-011**: All defined acceptance scenarios pass on both a mobile-sized screen and a desktop-sized screen.

## Assumptions

- The first release is a responsive web application for individual users rather than a shared or collaborative workspace.
- Account sign-in and account recovery are supporting platform capabilities; defining their detailed flows is outside this feature's scope.
- Bookmarks are private by default and are never discoverable by other users.
- Automatic page-detail retrieval applies to destinations that can be reached without signing in or completing an interactive challenge.
- The retrieved description is distinct from the user's optional personal notes; users can edit either without changing the destination page.
- Retrieved metadata is captured when a bookmark is created or when a user explicitly requests a refresh; it is not continuously synchronized.
- Notes are plain text. Rich text and file attachments are outside the first release.
- Tag names are unique within a user's collection without regard to letter case.
- The default active-collection order is newest-created first; the user can select any sorting option defined in this feature.
- Unquoted multi-word searches use all-words matching, and multiple selected tags use all-tags matching.
- Marking a bookmark as read does not archive or delete it, and archiving preserves its read-later history.
- Import supports bookmark export files from Chrome, Edge, Firefox, and Safari; continuous synchronization and exact reproduction of unsupported source-specific organization are outside scope.
- Export prioritizes full data portability and therefore includes states that may not be understood by other bookmark products.
- The product is designed for collections of at least 1,000 bookmarks per user.
- Opening a bookmark uses the normal behavior of the user's browser and does not verify that the destination is safe or currently available.
- Internet access is required; offline use is outside the first release.
