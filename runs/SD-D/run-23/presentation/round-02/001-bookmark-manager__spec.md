# Feature Specification: Bookmark Manager

**Feature Branch**: `N/A (no branch hook configured)`

**Created**: 2026-09-25

**Status**: Revised draft — awaiting client approval

**Input**: User description: Build an app to save and manage bookmarks, including automatic page details, read-later status, archiving, advanced search, personal notes, bulk actions, and saved views.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a Rich Bookmark with Minimal Typing (Priority: P1)

As a user, I can paste a web address and have the app fill in useful page details automatically so saving a useful bookmark requires little manual effort.

**Why this priority**: Fast capture with meaningful visual context is the core value of the product and directly removes the tedium the user wants to avoid.

**Independent Test**: Paste a publicly accessible page address, verify the available title, description, site icon, and preview image are shown automatically, adjust any details, save, and reopen the bookmark.

**Acceptance Scenarios**:

1. **Given** the user enters a valid public web address, **When** the address is recognized, **Then** the app automatically attempts to retrieve the page title, short description, site icon, and preview image and shows the available details before saving.
2. **Given** some page details are unavailable, **When** the retrieval attempt completes, **Then** the app clearly distinguishes unavailable details, supplies a sensible title fallback, and still allows the bookmark to be saved.
3. **Given** automatic detail retrieval fails or takes too long, **When** the user continues, **Then** they can save the bookmark manually without losing entered information.
4. **Given** automatic details have been retrieved, **When** the user changes the title, description, notes, tags, collection, or read status, **Then** the user's values are preserved when the bookmark is saved.
5. **Given** the submitted web address is missing a scheme but is otherwise recognizable, **When** the user saves it, **Then** the app normalizes it into a usable web address and shows the normalized value.
6. **Given** the submitted value is not a usable web address, **When** the user tries to save it, **Then** the app explains the problem and does not create a bookmark.
7. **Given** a bookmark with the same normalized web address already exists, **When** the user attempts to save it again, **Then** the app identifies the existing bookmark and lets the user open or update it instead of silently creating a duplicate.

---

### User Story 2 - Find Bookmarks with Precise Search (Priority: P2)

As a user, I can browse, search, filter, and sort my active bookmarks with simple or advanced criteria so I can quickly find exactly what I need.

**Why this priority**: A growing library remains valuable only when users can retrieve the right item quickly, including through combinations of terms and tags.

**Independent Test**: Populate a library with bookmarks that vary by text, notes, tags, collections, and read status; then verify plain words, quoted phrases, tag queries, exclusions, alternatives, filters, and sorting return the expected active bookmarks.

**Acceptance Scenarios**:

1. **Given** the user has active bookmarks, **When** they view the main library, **Then** each result shows enough information to identify it, including title, destination, site icon, preview image, tags, collection, read status, and save date when available.
2. **Given** matching bookmarks exist, **When** the user enters ordinary search words, **Then** matches are found case-insensitively across title, web address, description, and personal notes.
3. **Given** bookmarks have tags, **When** the user searches with a tag expression such as `tag:research`, **Then** results are limited to bookmarks carrying that tag.
4. **Given** a user places words in quotation marks, **When** the search runs, **Then** only bookmarks containing that exact phrase in a searchable field match that phrase.
5. **Given** a user combines terms or tag expressions with AND, OR, NOT, or parentheses, **When** the search runs, **Then** the results follow the stated inclusion, alternative, exclusion, and grouping logic.
6. **Given** a query contains adjacent terms without an operator, **When** the search runs, **Then** the terms are treated as an AND combination.
7. **Given** bookmarks have tags, collections, or read states, **When** the user applies one or more available filters, **Then** displayed results satisfy the query and all selected filters.
8. **Given** the library contains multiple bookmarks, **When** the user chooses a supported sort order, **Then** results are ordered by newest saved, oldest saved, or title.
9. **Given** a bookmark is visible, **When** the user opens it, **Then** its saved web address opens without losing the user's place in the library and its read state changes only when the user explicitly requests that change.
10. **Given** a search expression is incomplete or invalid, **When** the user submits it, **Then** the app identifies the problematic part and offers guidance without discarding the query.
11. **Given** no active bookmarks match the current query or filters, **When** results are displayed, **Then** the app shows a clear empty state and offers a way to clear the active criteria.

---

### User Story 3 - Keep a Read-Later Queue (Priority: P3)

As a user, I can distinguish unread bookmarks from those I have finished so I have a focused read-later queue.

**Why this priority**: Many bookmarks represent future reading rather than long-term reference material, so a dedicated state makes that workflow usable.

**Independent Test**: Save an unread bookmark, find it in the unread view, mark it read, verify it leaves that view but remains in the library, and mark it unread again.

**Acceptance Scenarios**:

1. **Given** the user is saving a bookmark, **When** they do not change its initial read state, **Then** it is saved as unread.
2. **Given** unread active bookmarks exist, **When** the user opens the unread view, **Then** only active unread bookmarks are shown.
3. **Given** an unread bookmark, **When** the user marks it read, **Then** it immediately leaves the unread view but remains available in the main library.
4. **Given** a read bookmark, **When** the user marks it unread, **Then** it appears in the unread view.
5. **Given** a user opens a bookmark destination, **When** they return to the library, **Then** the bookmark retains its prior read state unless the user explicitly changed it.

---

### User Story 4 - Organize and Annotate Bookmarks (Priority: P4)

As a user, I can organize bookmarks with tags and collections and add substantial personal notes so the library reflects my own context and thinking.

**Why this priority**: Reusable labels and searchable notes turn a list of links into a useful personal knowledge library.

**Independent Test**: Create tags and collections, use tag suggestions while editing a bookmark, add formatted notes, and verify organization and notes persist and are searchable.

**Acceptance Scenarios**:

1. **Given** a bookmark exists, **When** the user assigns zero or more tags and optionally one collection, **Then** the bookmark appears under those organizational labels.
2. **Given** the user begins typing a tag while creating or editing a bookmark, **When** existing tags match the entered text, **Then** the app suggests those tags and allows selection without creating a duplicate.
3. **Given** no existing tag matches the entered text, **When** the user confirms it, **Then** a new tag is created and assigned to the bookmark.
4. **Given** the user creates or renames a tag or collection, **When** the change is saved, **Then** the updated label appears on every associated bookmark.
5. **Given** a tag or collection is in use, **When** the user requests its deletion, **Then** the app explains how many bookmarks are affected and requires confirmation before removing the label without deleting the bookmarks.
6. **Given** a tag or collection name differs from an existing one only by capitalization or surrounding spaces, **When** the user tries to create it, **Then** the app reuses the existing label instead of creating a visually duplicate label.
7. **Given** the user adds personal notes with paragraphs, headings, lists, links, or emphasis, **When** they view the bookmark details, **Then** those notes are presented with their intended readable structure.
8. **Given** personal notes exist, **When** the user edits the bookmark or searches for text contained in those notes, **Then** the notes remain editable and their text contributes to search results.

---

### User Story 5 - Set Bookmarks Aside Without Deleting (Priority: P5)

As a user, I can archive bookmarks to remove them from everyday browsing and search while keeping them available for later restoration or permanent deletion.

**Why this priority**: Archiving gives users a safe way to reduce clutter without forcing an irreversible choice.

**Independent Test**: Archive an active bookmark, verify it disappears from the main library and ordinary searches, find it in the archive, and restore it with all details intact.

**Acceptance Scenarios**:

1. **Given** an active bookmark, **When** the user archives it, **Then** it leaves the main library, ordinary search results, and unread view without being deleted.
2. **Given** archived bookmarks exist, **When** the user opens the archive, **Then** only archived bookmarks are shown and can be searched, filtered, and sorted there.
3. **Given** an archived bookmark, **When** the user restores it, **Then** it returns to the active library with its details, notes, tags, collection, and read state unchanged.
4. **Given** an archived bookmark, **When** the user chooses permanent deletion, **Then** the app identifies the bookmark and requires explicit confirmation before removing it.

---

### User Story 6 - Update Many Bookmarks at Once (Priority: P6)

As a user, I can apply common actions to selected bookmarks or every bookmark matching the current view so managing a large library does not become repetitive.

**Why this priority**: Bulk actions are essential for practical maintenance once a user has accumulated many bookmarks.

**Independent Test**: Select several bookmarks and separately choose all matches from a multi-page result set, then apply tags, read state, archive, restore, and deletion actions while verifying counts and outcomes.

**Acceptance Scenarios**:

1. **Given** a result list, **When** the user selects individual bookmarks, **Then** the app clearly shows the selection count and available bulk actions.
2. **Given** the current query or filters match more bookmarks than are visible, **When** the user chooses all matching bookmarks, **Then** the app clearly states that the action applies to the complete matching set and shows its count.
3. **Given** bookmarks are selected, **When** the user adds or removes tags, marks them read or unread, archives them, or restores them, **Then** the action is applied to the full intended selection and the resulting view updates.
4. **Given** bookmarks are selected for permanent deletion, **When** the user proceeds, **Then** the app states the exact number to be deleted and requires explicit confirmation.
5. **Given** part of a bulk operation cannot be completed, **When** processing finishes, **Then** the app reports how many items succeeded, identifies the failed items, and does not report the entire operation as successful.

---

### User Story 7 - Reuse a Frequent Search as a Named View (Priority: P7)

As a user, I can save a useful combination of search, filters, and sorting under a name so I can return to the same live view in one step.

**Why this priority**: Saved views make advanced organization efficient for recurring workflows without duplicating or moving bookmarks.

**Independent Test**: Build a combined query and filter state, save it under a name, change the library, reopen the saved view, and verify it dynamically returns the bookmarks that now match.

**Acceptance Scenarios**:

1. **Given** the user has an active search, filters, or non-default sort order, **When** they save the current view with a valid name, **Then** it becomes available in their saved views list.
2. **Given** a saved view exists, **When** the user opens it, **Then** its stored query, filters, library location, and sort order are reapplied to current bookmark data.
3. **Given** bookmarks have changed since a view was saved, **When** the view is reopened, **Then** the results reflect the current bookmarks rather than a frozen copy of past results.
4. **Given** a saved view exists, **When** the user renames or deletes it, **Then** the saved views list updates without changing or deleting any bookmarks.
5. **Given** a saved-view name differs from an existing one only by capitalization or surrounding spaces, **When** the user tries to save it, **Then** the app asks them to choose a distinct name or replace the existing saved view.

---

### User Story 8 - Maintain Individual Bookmarks (Priority: P8)

As a user, I can update or permanently remove individual bookmarks so the library remains accurate and useful.

**Why this priority**: Individual maintenance remains necessary even with bulk actions, while permanent deletion must remain clearly separate from archiving.

**Independent Test**: Edit every user-managed field of a bookmark, verify changes persist, then permanently delete it after confirmation and verify it no longer appears in active or archived searches.

**Acceptance Scenarios**:

1. **Given** a bookmark exists, **When** the user edits its web address, title, description, notes, tags, collection, or read state with valid values, **Then** the updated details are saved and immediately reflected throughout the library.
2. **Given** a bookmark exists, **When** the user requests permanent deletion, **Then** the app distinguishes that action from archiving, identifies the bookmark, and requires confirmation before removing it.
3. **Given** the user cancels a permanent deletion, **When** they return to the library, **Then** the bookmark and all its details remain unchanged.

### Edge Cases

- Saving the same destination with superficial differences such as letter casing in the host, a missing scheme, or a trailing slash uses the normalized address for duplicate detection.
- Automatic page details may be missing, malformed, blocked by the publisher, require authentication, or take too long; none of these conditions prevents manual saving.
- Automatic detail retrieval does not attempt to access non-public network destinations and follows redirects only while they remain safe public web destinations.
- A publisher may provide an icon or preview image that later becomes unavailable; the bookmark remains usable with a neutral fallback.
- Very long titles, descriptions, notes, web addresses, tag names, collection names, or saved-view names are rejected at documented limits with a message that preserves entered content for correction.
- Bookmarks containing accented characters, emoji, query strings, fragments, or internationalized web addresses remain identifiable and open the intended destination.
- Search ignores letter casing and safely handles punctuation, unmatched quotation marks, unsupported operators, and characters with special meaning.
- Archived bookmarks are excluded from the main library, ordinary searches, and unread view even when their content otherwise matches; archive searches operate only on archived bookmarks.
- Removing a tag or collection never removes its associated bookmarks.
- A saved view that references a renamed or deleted tag remains editable and clearly identifies the unavailable criterion rather than silently broadening its results.
- When a bulk selection is based on all current matches, changing the query or filters clears that selection so the action scope cannot change invisibly.
- If any save, edit, archive, restore, or delete operation fails, the app reports that the change was not completed and avoids showing an unconfirmed result as saved.
- An empty library, unread queue, archive, or saved view clearly explains its state and offers a relevant next action.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide each user with a private bookmark library that is not visible to other users.
- **FR-002**: Users MUST be able to create a bookmark from a valid public HTTP or HTTPS web address.
- **FR-003**: For every recognized address, the system MUST automatically attempt to retrieve the page title, short description, site icon, and preview image before the bookmark is saved.
- **FR-004**: The system MUST show retrieved page details during the save flow, identify unavailable details, and allow the user to override editable text details.
- **FR-005**: Failure, timeout, or partial success while retrieving page details MUST NOT prevent the user from manually completing and saving a valid bookmark.
- **FR-006**: The system MUST NOT retrieve page details from loopback, private-network, or other non-public destinations, including destinations reached through redirection.
- **FR-007**: The system MUST store a normalized web address, title, read state, archive state, creation date, and last-updated date for every bookmark.
- **FR-008**: Users MUST be able to optionally provide or edit a short description, personal notes, zero or more tags, and one collection for a bookmark.
- **FR-009**: The system MUST normalize recognizable web addresses before saving them and MUST show the final normalized address to the user.
- **FR-010**: The system MUST reject values that cannot be interpreted as valid HTTP or HTTPS web addresses and MUST explain how to correct the error.
- **FR-011**: The system MUST prevent silent duplicate bookmarks within the same user's library by detecting an existing normalized web address across active and archived bookmarks and directing the user to that bookmark for opening, restoring, or updating.
- **FR-012**: New bookmarks MUST be unread by default, and the user MUST be able to choose a different initial state before saving.
- **FR-013**: Users MUST be able to mark individual bookmarks or bulk selections as read or unread.
- **FR-014**: The system MUST provide an unread view containing only active unread bookmarks and MUST remove a bookmark from that view as soon as it is marked read or archived.
- **FR-015**: Opening a bookmark destination MUST NOT automatically alter its read state.
- **FR-016**: Users MUST be able to view active bookmarks as a browsable library with each item's identifying details.
- **FR-017**: Users MUST be able to open a saved bookmark while retaining their current library view.
- **FR-018**: Ordinary text search MUST match case-insensitively across bookmark title, web address, description, and personal notes.
- **FR-019**: Search MUST support direct tag expressions using `tag:` followed by an existing tag name, with quoted values available for tag names containing spaces.
- **FR-020**: Search MUST support quoted exact phrases, the Boolean operators AND, OR, and NOT, and parentheses for grouping; adjacent terms without an operator MUST behave as AND.
- **FR-021**: Search MUST provide actionable feedback for an invalid expression without clearing the user's entered query.
- **FR-022**: Users MUST be able to filter bookmarks by tag, collection, and read state, including combinations of search terms and filters.
- **FR-023**: Users MUST be able to sort bookmarks by newest saved, oldest saved, and title.
- **FR-024**: The system MUST clearly identify active search and filter criteria and MUST provide a single action to clear them.
- **FR-025**: The main library, ordinary search, and unread view MUST exclude archived bookmarks.
- **FR-026**: Users MUST be able to archive active bookmarks and view archived bookmarks in a separate archive.
- **FR-027**: Within the archive, users MUST be able to search, filter, sort, restore, and permanently delete bookmarks.
- **FR-028**: Restoring a bookmark MUST preserve its title, destination, automatic page details, description, personal notes, tags, collection, and read state.
- **FR-029**: Users MUST be able to create, rename, and delete tags and collections.
- **FR-030**: While a user types a tag during bookmark creation or editing, the system MUST suggest existing tags using case-insensitive prefix and partial-name matches.
- **FR-031**: Tag and collection names MUST be unique per user after ignoring capitalization and surrounding spaces.
- **FR-032**: Before deleting a tag or collection, the system MUST show the number of affected bookmarks and require confirmation; deleting the label MUST NOT delete those bookmarks.
- **FR-033**: Personal notes MUST support and safely display paragraphs, headings, lists, links, and emphasis without interpreting unsafe embedded content.
- **FR-034**: Users MUST be able to select individual visible bookmarks and select all bookmarks matching the current query and filters, including matches beyond the current visible page.
- **FR-035**: For any selection, the system MUST show the selected count and distinguish selected visible items from all matching items.
- **FR-036**: Users MUST be able to add or remove tags, mark read or unread, archive, restore, or permanently delete all bookmarks in a selection when the action applies to their current location.
- **FR-037**: Bulk permanent deletion MUST state the exact impact and require explicit confirmation; bulk archive and permanent deletion MUST remain visually and verbally distinct.
- **FR-038**: A partially failed bulk operation MUST report succeeded and failed counts, identify failed items, and leave their actual states accurately represented.
- **FR-039**: Users MUST be able to save the current search query, filters, library location, and sort order as a named saved view.
- **FR-040**: Opening a saved view MUST evaluate its criteria against current bookmark data rather than displaying a frozen result set.
- **FR-041**: Users MUST be able to rename and delete saved views without modifying bookmarks.
- **FR-042**: Saved-view names MUST be unique per user after ignoring capitalization and surrounding spaces; a name conflict MUST offer replacement or cancellation rather than silently overwriting a view.
- **FR-043**: Users MUST be able to edit the web address, title, description, personal notes, tags, collection, and read state of an existing bookmark.
- **FR-044**: Users MUST be able to permanently delete a bookmark from either active or archived state only after confirming an action that identifies the bookmark.
- **FR-045**: The system MUST preserve confirmed bookmark, tag, collection, and saved-view changes across user sessions.
- **FR-046**: The system MUST present helpful empty states for the main library, unread queue, archive, and searches or saved views with no results.
- **FR-047**: The system MUST communicate whether create, edit, archive, restore, and delete operations succeeded or failed and MUST not present failed changes as confirmed.
- **FR-048**: User-entered titles, descriptions, personal notes, tag names, collection names, and saved-view names MUST support common international characters and emoji.
- **FR-049**: User-managed text MUST be limited to 200 characters for bookmark titles, 2,000 characters for descriptions, 20,000 characters for personal notes, and 50 characters for tag, collection, and saved-view names, with clear validation before submission.

### Key Entities

- **User**: The owner of a private bookmark library; has access only to their own bookmarks, tags, collections, and saved views.
- **Bookmark**: A saved web resource owned by one user, with a normalized destination, title, automatic page details when available, optional description, optional personal notes, tags, optional collection, read state, archive state, creation date, and last-updated date.
- **Tag**: A reusable user-owned label that can be associated with many bookmarks; a bookmark can have many tags.
- **Collection**: A reusable user-owned grouping that can contain many bookmarks; a bookmark belongs to at most one collection.
- **Saved View**: A user-named, reusable set of search text, filters, library location, and sort order that is evaluated against current bookmark data whenever opened.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of first-time users can paste and save their first valid bookmark without assistance in under 45 seconds.
- **SC-002**: For at least 90% of publicly accessible test pages that publish a title, description, site icon, or preview image, every published detail is available for review within 5 seconds; retrieval failure never prevents manual saving.
- **SC-003**: At least 95% of searches, filter changes, archive views, or saved-view openings show the resulting state within 1 second for libraries containing up to 10,000 bookmarks.
- **SC-004**: In acceptance testing, simple text, exact phrase, tag, AND, OR, NOT, and grouped searches return the expected results for all defined query cases.
- **SC-005**: At least 90% of users can locate and open a known bookmark from a 500-item library in under 30 seconds.
- **SC-006**: At least 90% of test participants can save an unread bookmark, mark it read, archive it, find it in the archive, and restore it without instruction or critical error.
- **SC-007**: At least 90% of test participants can apply a tag or read-state change to all matches in a result set of more than one visible page in under 60 seconds.
- **SC-008**: In acceptance testing, 100% of confirmed create, edit, archive, restore, bulk, and delete operations remain accurate after ending and starting a new session.
- **SC-009**: In acceptance testing, duplicate attempts covering all documented normalization cases result in no unintended duplicate bookmarks across active and archived states.
- **SC-010**: Every permanent deletion in acceptance testing identifies its impact and requires explicit confirmation, while no archive action permanently removes a bookmark.
- **SC-011**: At least 90% of test participants can create and reopen a named saved view that reproduces the intended live query, filters, location, and sort order without assistance.
- **SC-012**: At least 90% of test participants complete the core flows—save, find, annotate, organize, update status, archive, bulk-manage, save a view, and delete—without instruction or critical error.

## Assumptions

- The first release is a responsive web application for individual users rather than a shared or collaborative workspace.
- Users have an account and an authenticated session; account registration, sign-in, password recovery, and identity-provider choices are supporting capabilities outside this feature's scope.
- A bookmark has at most one collection but may have multiple tags; organization is optional.
- Automatic page details are retrieved only from publicly accessible HTTP or HTTPS pages. Pages requiring authentication, consent, payment, or publisher permission may yield partial or no details.
- Retrieved page details are a snapshot captured during bookmark creation; automatic recurring refresh and link-health monitoring are outside scope.
- The first release supports manually adding bookmarks. Browser extensions, automatic browser-history capture, bulk import/export, sharing, offline page copies, and collaborative annotations are outside scope.
- Archive is a reversible state; permanent deletion removes the bookmark only after confirmation. A recycle bin after permanent deletion and version history are outside scope.
- Opening a link does not imply that it was read; users control read status explicitly.
- Search covers saved bookmark fields and personal notes but does not search the full contents of destination pages.
- Saved views store criteria rather than copies of results and do not duplicate or move bookmarks.
- Users are responsible for the content and safety of external destinations they save and open.

