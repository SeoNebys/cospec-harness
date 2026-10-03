# Feature Specification: Bookmark Manager

**Feature Branch**: `[001-manage-bookmarks]`

**Created**: 2026-09-23

**Status**: Draft — revised after client review

**Input**: User description: "Build a personal bookmark manager with automatic page details and snapshots, read-later tracking, bulk organization, expressive and saved searches, sorting, and display preferences."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save an enriched, durable bookmark (Priority: P1)

As a user, I can paste a web address and have the app fill in useful page details and preserve a snapshot, so saving requires little effort and the page remains available if the original changes or disappears.

**Why this priority**: Automatic enrichment and preservation are central reasons to use this app instead of ordinary browser bookmarks.

**Independent Test**: Save a reachable page using only its address, verify that page details and a snapshot are produced, edit the suggested details, and confirm the original destination and saved snapshot can each be opened.

**Acceptance Scenarios**:

1. **Given** a reachable public web address, **When** the user submits it, **Then** the app saves the bookmark and attempts to fill its title, short description, site icon, and preview image from the destination.
2. **Given** retrieved details are displayed before or after saving, **When** the user changes any suggested value, **Then** the user's value is retained until the user explicitly requests another metadata refresh.
3. **Given** the destination can be captured, **When** the bookmark is saved, **Then** the app preserves a dated snapshot and provides a separate way to view it.
4. **Given** some metadata or the snapshot cannot be retrieved, **When** saving finishes, **Then** the bookmark remains saved, the unavailable items are identified, and the user can supply details or retry retrieval.
5. **Given** a saved destination later changes or becomes unavailable, **When** the user opens its saved snapshot, **Then** the preserved version from its capture date remains viewable.
6. **Given** a missing or invalid web address, **When** saving is attempted, **Then** no bookmark is created and the user receives a clear correction message.

---

### User Story 2 - Keep and complete a read-later list (Priority: P2)

As a user, I can mark bookmarks to read later, see unread items together, and mark them read so that the list reflects what remains.

**Why this priority**: Read-later tracking turns the collection into an actionable reading queue rather than a passive list.

**Independent Test**: Save bookmarks with and without read-later status, open the unread view, mark one item read, and verify it leaves that view while remaining in the collection.

**Acceptance Scenarios**:

1. **Given** a bookmark is being created or edited, **When** the user marks it to read later, **Then** it is recorded as unread and appears in the unread view.
2. **Given** an unread bookmark is visible, **When** the user marks it read, **Then** it immediately leaves the unread view but remains available elsewhere in the collection.
3. **Given** a previously read bookmark exists, **When** the user marks it unread, **Then** it returns to the unread view.

---

### User Story 3 - Find bookmarks with expressive searches (Priority: P3)

As a user, I can combine words, explicit tags, and filters, then save useful combinations so that I can repeatedly return to a focused collection.

**Why this priority**: Precise, reusable retrieval keeps a large bookmark collection useful.

**Independent Test**: Search a varied collection with combined text and tag expressions, apply filters and sorting, save that view, leave it, and reopen it to reproduce the same results and ordering.

**Acceptance Scenarios**:

1. **Given** bookmarks with different titles, destinations, descriptions, notes, and tags, **When** the user enters plain words, **Then** matching across those searchable fields is case-insensitive and all entered terms are required by default.
2. **Given** bookmarks have multiple tags, **When** the user searches with `#tag-name`, **Then** only bookmarks carrying that exact tag are matched.
3. **Given** the user enters terms joined by `OR`, **When** the search is evaluated, **Then** a bookmark matches when either side matches; terms without `OR` continue to use AND behavior.
4. **Given** search text, tag terms, filters, and a sort order are active, **When** the user saves the search with a unique name, **Then** that complete view definition is available for later reuse.
5. **Given** a saved search exists, **When** the user opens it, **Then** the current collection is evaluated using the saved query, filters, and sort order.
6. **Given** a saved search exists, **When** the user renames, updates, or deletes it, **Then** the saved-search list reflects the requested change without changing any bookmarks.
7. **Given** no bookmarks match, **When** results are displayed, **Then** the user sees a clear no-results state and can reset the criteria.

---

### User Story 4 - Organize one or many bookmarks (Priority: P4)

As a user, I can maintain individual bookmarks or apply common actions to a selected set or all current results so that large cleanup jobs are efficient.

**Why this priority**: Batch organization prevents routine collection maintenance from becoming repetitive.

**Independent Test**: Filter a collection, select several results and add a tag, then target all matching results for archive and delete actions while verifying scope and confirmation behavior.

**Acceptance Scenarios**:

1. **Given** a saved bookmark exists, **When** the user edits its title, description, preview image, site icon, notes, tags, favorite state, or read state, **Then** the updated values replace the previous values.
2. **Given** one or more visible bookmarks are selected, **When** the user adds a tag or archives them, **Then** the action applies to every selected bookmark and reports the affected count.
3. **Given** a filtered or searched result set spans more items than are currently visible on screen, **When** the user chooses all current results, **Then** the app states the total scope and can apply an add-tag, archive, or delete action to every matching bookmark.
4. **Given** a bulk destructive action is requested, **When** the confirmation is shown, **Then** it names the action and number of affected bookmarks and makes cancellation possible.
5. **Given** an archived bookmark exists, **When** the user restores it, **Then** it returns to the active collection with its details and snapshot intact.
6. **Given** one or more bookmarks are permanently deleted after confirmation, **When** any collection or saved search is viewed, **Then** those bookmarks no longer appear.
7. **Given** the user starts entering a tag, **When** existing tags match the entered text, **Then** the app suggests them and selecting a suggestion reuses the existing tag.

---

### User Story 5 - Adjust collection presentation (Priority: P5)

As a user, I can change the list order and basic display preferences so that the app suits how I browse and review bookmarks.

**Why this priority**: Presentation controls improve daily usability without changing the underlying collection.

**Independent Test**: Change sort order, color theme, and information density; leave and reopen the app; verify those preferences remain active.

**Acceptance Scenarios**:

1. **Given** a bookmark collection is visible, **When** the user chooses a supported sort field and direction, **Then** the visible results are reordered accordingly.
2. **Given** the settings area is open, **When** the user chooses a light, dark, or device-matched theme and a comfortable or compact density, **Then** the display updates and the choices persist between sessions.

### Edge Cases

- Leading and trailing whitespace is removed from bookmark fields before validation and saving.
- Addresses without an explicit scheme are interpreted as secure web addresses when they otherwise resemble a valid host; unsupported or malformed addresses are rejected.
- Saving an address already in the collection identifies the existing bookmark and offers to update it instead of silently creating a duplicate.
- Retrieval may fail because a site is unreachable, blocks automated access, requires authentication, or supplies no metadata; the app still permits a manually described bookmark.
- Snapshot capture may be incomplete for authenticated, interactive, media-heavy, or continuously changing pages; the app displays capture time and whether capture succeeded or was partial.
- Refreshing metadata or a snapshot requires an explicit user action and warns which user-edited or previously captured values will be replaced.
- Titles, descriptions, notes, tags, and searches support punctuation, emoji, and non-Latin characters.
- Tag identity and suggestions are case-insensitive, preventing tags that differ only by letter case.
- A `#` term that does not correspond to a tag produces no tag match; the interface explains the recognized AND/OR and tag syntax when a query is invalid.
- An empty or whitespace-only query means no text-search restriction; filters may still apply.
- “All current results” is resolved against the criteria at confirmation time so the stated count and affected set agree.
- If an item changes while selected and no longer matches the current view, the selection and displayed bulk-action count update before execution.
- A deleted bookmark disappears from active, archived, unread, favorite, search, and saved-search results, and its stored snapshot is also removed.
- If a live destination is unavailable, opening it may fail, but the bookmark record and any successful snapshot remain intact.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST let users create a bookmark by supplying a valid web address; a title MUST NOT be required before the initial retrieval attempt.
- **FR-002**: On creation, the app MUST attempt to retrieve the destination's title, short description, site icon, and preview image and MUST show which values could not be retrieved.
- **FR-003**: Users MUST be able to review and edit retrieved title, description, site icon, and preview image values, as well as add optional notes and tags.
- **FR-004**: The app MUST preserve user-edited metadata unless the user explicitly confirms a refresh that would replace it.
- **FR-005**: The app MUST attempt to create a dated page snapshot when a bookmark is saved and MUST identify successful, partial, pending, and failed capture states.
- **FR-006**: Users MUST be able to view the live destination and the saved snapshot as distinct actions and manually retry or refresh a failed or outdated snapshot.
- **FR-007**: The app MUST validate required values and show actionable messages without creating or overwriting a bookmark when address validation fails.
- **FR-008**: The app MUST display bookmarks with, at minimum, title, destination, available visual metadata, tags, favorite state, read state, snapshot status, and date saved.
- **FR-009**: Users MUST be able to mark a bookmark unread/read-later, mark it read, and return it to unread status.
- **FR-010**: The app MUST provide a dedicated unread view containing only active bookmarks currently marked unread.
- **FR-011**: Users MUST be able to mark and unmark bookmarks as favorites independently of read state.
- **FR-012**: Users MUST be able to edit a bookmark's address, descriptive fields, notes, tags, favorite state, and read state.
- **FR-013**: Users MUST be able to archive and restore bookmarks without losing their details, read state, or snapshot.
- **FR-014**: Users MUST be able to permanently delete bookmarks only after explicit confirmation; deleting a bookmark MUST also delete its stored snapshot.
- **FR-015**: The app MUST support case-insensitive partial-text searching across title, destination, description, notes, and tag names.
- **FR-016**: Search MUST recognize `#tag-name` as an exact tag term, whitespace-separated terms as AND, and the explicit `OR` operator as an alternative between its adjacent terms.
- **FR-017**: The app MUST explain valid search syntax and identify malformed expressions without silently changing their meaning.
- **FR-018**: Users MUST be able to filter results by tag, favorite state, read state, and active or archived state.
- **FR-019**: Users MUST be able to save a uniquely named view containing its search expression, filters, and sort order, and later open, rename, update, or delete that saved view.
- **FR-020**: Saved views MUST evaluate the current bookmark collection each time they are opened rather than preserve an obsolete result list.
- **FR-021**: When entering tags, users MUST receive case-insensitive suggestions from existing tags and be able to reuse a suggestion.
- **FR-022**: Users MUST be able to select individual visible bookmarks or select all bookmarks matching the current search and filters, including results beyond the currently displayed portion.
- **FR-023**: Users MUST be able to add a tag to, archive, or permanently delete a selected set; each action MUST state the affected count, and permanent deletion MUST require confirmation.
- **FR-024**: Bulk-action completion MUST report how many bookmarks succeeded and identify any bookmarks that could not be changed without undoing successful changes.
- **FR-025**: Users MUST be able to sort results by date saved, date updated, title, and destination, each in ascending or descending order; newest saved is the default.
- **FR-026**: Users MUST be able to choose light, dark, or device-matched appearance and comfortable or compact information density in a settings area.
- **FR-027**: The app MUST preserve bookmarks, snapshots, saved views, and display preferences between sessions on the same installation.
- **FR-028**: When a user attempts to save a duplicate destination, the app MUST identify the existing bookmark and offer a route to update it.
- **FR-029**: The app MUST provide distinct, understandable states for an empty collection, no matching results, metadata retrieval in progress or failed, and snapshot capture in progress, partial, or failed.

### Key Entities

- **Bookmark**: A saved web resource identified by its destination, with editable title, description, site icon, preview image, notes, tags, favorite status, read status, archive status, metadata status, snapshot status, creation date, and last-updated date.
- **Tag**: A reusable label associated with zero or more bookmarks; its name is unique without regard to letter case.
- **Page Snapshot**: A preserved, dated representation of a bookmark's page at capture time, associated with one bookmark and carrying capture status and any limitation notice.
- **Saved View**: A user-named, reusable definition containing a search expression, filters, and sort order; its results are calculated when opened.
- **Display Preferences**: The user's persisted appearance and information-density choices.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of first-time users can save a reachable page using only its address and reopen either the live page or snapshot without assistance in under one minute.
- **SC-002**: For a representative set of public pages that permit access and publish the relevant details, at least 95% of saves populate a title and at least 85% populate a description, site icon, and preview image without manual entry.
- **SC-003**: At least 95% of permitted, publicly reachable test pages produce a viewable snapshot or a clear partial-capture explanation within 30 seconds of saving.
- **SC-004**: Users can locate a known bookmark among 10,000 items using combined text, tag, and state criteria in under 10 seconds, with result updates visible within one second of an action.
- **SC-005**: At least 90% of first-time users can create and later reopen a saved view without assistance in under one minute.
- **SC-006**: In acceptance testing, bulk add-tag and archive actions correctly affect 100% of the confirmed selected or all-matching set; bulk deletion never proceeds without an accurate count and explicit confirmation.
- **SC-007**: In acceptance testing, 100% of valid metadata edits, read-state changes, organization changes, snapshots, saved views, sorting choices, and display preferences remain reflected after closing and reopening the app.
- **SC-008**: At least 95% of test participants can distinguish empty, no-results, retrieval-failure, and snapshot-failure states and identify the next available action without assistance.
- **SC-009**: In validation testing, 100% of malformed addresses and malformed search expressions are rejected or explained without corrupting or replacing existing bookmark data.

## Assumptions

- The first release is a personal, single-user application; accounts, sharing, teams, permissions, and cross-device synchronization remain outside scope.
- Browser extensions and bulk bookmark import/export remain outside scope.
- The app is intended for a modern web browser on desktop and mobile-sized screens.
- Page metadata is suggested from information the destination makes available. Users can always replace suggestions manually.
- A snapshot is a preserved view of accessible page content at capture time, not a guarantee that every interactive behavior, protected resource, video, or authenticated area will work offline.
- One current snapshot is retained per bookmark. Refreshing it replaces the previous snapshot after confirmation rather than creating version history.
- A bookmark has one read state: unread/read-later or read. New bookmarks default to read unless the user marks them for later.
- A bookmark may have any number of tags, while notes are optional plain text.
- Search evaluation applies AND before OR when both occur without explicit grouping; the search guidance makes this precedence visible.
- Saved data belongs to one installation. Backup, cross-device sync, link-health monitoring, and collaborative features are outside scope.
- Internet access is required to retrieve metadata, capture or refresh snapshots, and visit live destinations; already stored records and successful snapshots remain viewable without reaching the destination.
