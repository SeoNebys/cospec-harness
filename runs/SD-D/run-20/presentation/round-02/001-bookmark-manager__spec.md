# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-25

**Status**: Revised draft — awaiting client approval

**Input**: User description: "Build an app to save and manage bookmarks, including automatic page details and previews, a read-later workflow, advanced search, bulk organization, sorting, and formatted notes."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark with automatic page details (Priority: P1)

As a user, I can paste a web address and have the app retrieve a useful title, description, site icon, and preview image so saving a recognizable bookmark requires minimal typing.

**Why this priority**: Automatic page details are central to the expected saving experience and make the product meaningfully faster than recording links manually.

**Independent Test**: Paste the address of a publicly accessible page with recognizable page details, review the retrieved preview, optionally edit the title or description, save it, and reopen the bookmark from the library.

**Acceptance Scenarios**:

1. **Given** a valid public web address, **When** the user pastes it into the save form, **Then** the app automatically attempts to retrieve the page title, description, site icon, and representative image and shows the available details before saving.
2. **Given** retrieved page details, **When** the user changes the title or description and saves, **Then** the edited values are stored while the available site icon and preview image remain associated with the bookmark.
3. **Given** a page for which some or all details cannot be retrieved, **When** retrieval finishes or times out, **Then** the app explains that the preview is incomplete, supplies a usable title derived from the address, and still allows the bookmark to be saved.
4. **Given** a saved bookmark, **When** the user returns in a later session, **Then** the bookmark and its captured details remain available.
5. **Given** a saved bookmark, **When** the user selects its open action, **Then** the stored web address opens without changing its bookmark details or reading state.

---

### User Story 2 - Maintain a read-later queue (Priority: P2)

As a user, I can mark a bookmark to read later, view only unread items, and mark an item read when I finish it so I always know what remains.

**Why this priority**: A dedicated reading queue turns the library into an actionable list rather than passive storage.

**Independent Test**: Save one ordinary bookmark and two read-later bookmarks, mark one read, and verify that the unread view shows only the remaining unread bookmark; then mark the read item unread again.

**Acceptance Scenarios**:

1. **Given** a new or existing bookmark, **When** the user marks it to read later, **Then** it receives an unread reading state and appears in the unread view.
2. **Given** an unread bookmark, **When** the user marks it read, **Then** it leaves the unread view but remains saved in the library with a read state.
3. **Given** a read bookmark, **When** the user marks it unread, **Then** it returns to the unread view.
4. **Given** an unread bookmark, **When** the user merely opens its destination, **Then** it remains unread until the user explicitly marks it read.

---

### User Story 3 - Find and sort bookmarks precisely (Priority: P3)

As a user, I can use tag shortcuts, exact phrases, Boolean operators, filters, and sorting to locate the right bookmark in a large library.

**Why this priority**: Precise retrieval becomes essential as the library grows and reduces time spent manually scanning results.

**Independent Test**: Create bookmarks with overlapping titles, descriptions, notes, and tags, then verify searches using `#tag`, quoted phrases, `AND`, `OR`, `NOT`, and parentheses; combine a search with the unread filter and change the result order.

**Acceptance Scenarios**:

1. **Given** bookmarks with different tags, **When** the user searches with `#research`, **Then** only bookmarks tagged `research` are returned, regardless of tag capitalization.
2. **Given** bookmarks containing similar words, **When** the user searches for a quoted phrase, **Then** only bookmarks containing those words together in that order are returned.
3. **Given** a query using `AND`, `OR`, `NOT`, and parentheses, **When** the query is valid, **Then** the results follow the stated grouping, with `NOT` evaluated before `AND`, and `AND` before `OR` when parentheses are absent.
4. **Given** a search query and active view or reading-state filters, **When** results are shown, **Then** a bookmark must satisfy both the query and the selected filters.
5. **Given** a set of results, **When** the user chooses title or saved-date sorting and a direction, **Then** all matching results appear in that order.
6. **Given** an invalid query, **When** the user submits it, **Then** the app identifies the part that cannot be understood and preserves the query for correction.

---

### User Story 4 - Add context with formatted notes (Priority: P4)

As a user, I can edit page details, tags, and personal notes with basic formatting so saved material remains recognizable and useful.

**Why this priority**: Personal context and readable notes improve long-term organization after links have been saved.

**Independent Test**: Edit an existing bookmark, change its title and description, add and remove tags, and create a note using each supported format; confirm the saved note renders as intended and its readable text can be searched.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user changes its title, description, valid address, notes, or tags and saves, **Then** the library displays the updated details.
2. **Given** a bookmark note, **When** the user applies bold, italic, hyperlink, bulleted-list, or numbered-list formatting, **Then** the saved note displays that formatting without showing editing notation.
3. **Given** a formatted note, **When** the user searches for its readable text, **Then** the bookmark can be found without requiring formatting characters in the query.
4. **Given** an existing bookmark, **When** the user cancels an edit, **Then** none of the pending changes are applied.

---

### User Story 5 - Organize several bookmarks at once (Priority: P5)

As a user, I can select multiple bookmarks and apply a single organizational action so routine cleanup does not require editing each item separately.

**Why this priority**: Bulk actions make a large library practical to maintain while building on the individual organization workflows.

**Independent Test**: Select several visible bookmarks, add and remove a tag in bulk, change their reading state, archive them together, and verify the result and affected-item count after every action.

**Acceptance Scenarios**:

1. **Given** a list of bookmarks, **When** the user selects multiple items, **Then** the app shows how many are selected and offers actions valid for that selection.
2. **Given** multiple selected bookmarks, **When** the user adds or removes tags, **Then** the change is applied to every selected bookmark without removing unrelated tags.
3. **Given** multiple selected bookmarks, **When** the user marks them read or unread, **Then** every selected bookmark receives that reading state.
4. **Given** multiple selected active bookmarks, **When** the user archives them, **Then** they leave the active view and appear in the archived view.
5. **Given** a completed bulk action, **When** some items could not be changed, **Then** the app identifies the number changed and the items that still require attention.

---

### User Story 6 - Remove clutter safely (Priority: P6)

As a user, I can archive bookmarks I may want later and permanently delete archived bookmarks I no longer need, individually or in a group, so the active library stays relevant without accidental loss.

**Why this priority**: Cleanup matters over time, while archive-first deletion protects saved information.

**Independent Test**: Archive an active bookmark, restore it, archive it again, and permanently delete it after confirming; repeat restore and deletion with a multi-item selection and verify visibility at each stage.

**Acceptance Scenarios**:

1. **Given** an active bookmark, **When** the user archives it, **Then** it leaves the active library and appears in the archived view.
2. **Given** one or more archived bookmarks, **When** the user restores them, **Then** they return to the active library with their prior reading states, details, and tags intact.
3. **Given** one or more archived bookmarks, **When** the user initiates permanent deletion, **Then** the app asks for confirmation, states how many bookmarks will be deleted, and explains that the action cannot be undone.
4. **Given** the permanent-deletion confirmation, **When** the user confirms, **Then** the selected bookmarks are removed; **When** the user cancels, **Then** they remain archived.

### Edge Cases

- Saving an address that already exists creates no second bookmark; the user is directed to the existing entry and may update it.
- Addresses with leading or trailing spaces are normalized before validation; only `http` and `https` web addresses are accepted in this release.
- A slow, unreachable, sign-in-protected, or metadata-poor page does not block saving; the app indicates which preview details are unavailable and generates a title from the address.
- Metadata returned by a page may be excessively long or unsafe to display; it is constrained to the bookmark field limits and presented only as safe, non-executable content.
- A title cannot be blank after retrieval or editing. If no page title can be retrieved, the app supplies a domain- or address-derived title so the user is not required to type one.
- Tags that differ only by capitalization or surrounding whitespace are treated as the same tag.
- Titles over 200 characters, addresses over 2,048 characters, descriptions over 500 characters, notes over 5,000 readable characters, tag names over 30 characters, and attempts to add more than 20 tags are rejected or safely constrained with an actionable explanation rather than silently losing user-entered content.
- Search terms and operators are case-insensitive, except that text inside a quoted phrase retains its literal characters; an empty search shows every bookmark allowed by the current view and filters.
- A leading `#` denotes an exact tag name. Tag names containing spaces can be searched with a quoted tag expression such as `#"product design"`.
- A Boolean operator written inside quotation marks is treated as searchable text rather than as an operator.
- Bulk actions apply only to explicitly selected bookmarks in the current result set; changing views or starting a different search clears the selection to avoid acting on hidden items.
- If saving or editing fails, the user's entered values remain available whenever they are safe to display so the action can be retried.
- Empty active, archived, and unread views, and searches with no matches, each present an appropriate next action.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST provide distinct active, archived, and unread bookmark views, with active bookmarks shown by default.
- **FR-002**: Users MUST be able to begin creating a bookmark by entering only a web address; title, description, notes, tags, and read-later selection MUST remain editable before saving.
- **FR-003**: For a valid public web address, the app MUST automatically attempt to retrieve the page title, description, site icon, and representative image and MUST show every available result in a preview before the bookmark is saved.
- **FR-004**: Automatic detail retrieval MUST have a visible in-progress state, MUST finish or present a recoverable timeout within 10 seconds, and MUST NOT prevent saving when any detail is unavailable.
- **FR-005**: When no usable title is retrieved, the app MUST generate a non-empty title from the address so the user can save without manually entering a title.
- **FR-006**: Users MUST be able to edit the retrieved or generated title and description before or after saving without being required to keep the automatically retrieved text.
- **FR-007**: The app MUST accept only valid `http` or `https` web addresses; MUST NOT retrieve metadata from loopback, link-local, private-network, or reserved addresses; and MUST explain rejected input or skipped retrieval in a user-actionable way without preventing an otherwise valid address from being saved with generated details.
- **FR-008**: The app MUST preserve saved bookmarks and their captured details across user sessions until the user permanently deletes them.
- **FR-009**: The app MUST record and display when each bookmark was saved and most recently updated.
- **FR-010**: Users MUST be able to open a saved bookmark at its stored web address; opening it MUST NOT automatically mark it read.
- **FR-011**: The app MUST prevent duplicate active or archived bookmarks with the same normalized web address and MUST direct the user to the existing bookmark.
- **FR-012**: Users MUST be able to mark a new or existing bookmark as unread, mark an unread bookmark as read, and return a read bookmark to unread status.
- **FR-013**: The unread view MUST show only active bookmarks whose reading state is unread; archiving MUST preserve the reading state but remove the bookmark from the unread view until restored.
- **FR-014**: Users MUST be able to search case-insensitively across title, web address, retrieved description, readable note text, and tags.
- **FR-015**: Search MUST support exact phrases in quotation marks, exact tag references prefixed with `#`, the Boolean operators `AND`, `OR`, and `NOT`, and parentheses for explicit grouping; an exact phrase MUST match contiguous text within one searchable field.
- **FR-016**: Search evaluation MUST apply parentheses first and otherwise use the precedence `NOT`, then `AND`, then `OR`; adjacent terms without an operator MUST behave as if joined by `AND`.
- **FR-017**: The app MUST identify invalid search syntax without discarding the user's query and MUST provide a concise, accessible explanation of the supported syntax.
- **FR-018**: Users MUST be able to combine a search query with the current active or archived view, reading-state filtering where applicable, and tag filters; a result MUST satisfy all active filters.
- **FR-019**: Users MUST be able to clear the current search and filters in one action.
- **FR-020**: Users MUST be able to sort the current results by title in either alphabetical direction or by saved date in either chronological direction; newest-saved-first MUST be the default.
- **FR-021**: Users MUST be able to edit a bookmark's title, description, valid web address, formatted notes, tags, and reading state, subject to the same validation and duplicate rules used when creating it.
- **FR-022**: Bookmark notes MUST support bold, italic, hyperlink, bulleted-list, and numbered-list formatting and MUST display saved formatting as rendered content.
- **FR-023**: Formatted notes and retrieved page details MUST be presented as safe, non-executable content, including when a bookmark contains text supplied by an external page.
- **FR-024**: Users MUST be able to cancel creating or editing without applying pending changes to the library.
- **FR-025**: The app MUST normalize tag capitalization and surrounding whitespace so equivalent tag labels are not duplicated.
- **FR-026**: Users MUST be able to explicitly select multiple bookmarks from the current result set and see the number selected.
- **FR-027**: For a multi-bookmark selection, users MUST be able to add tags, remove tags, mark read, mark unread, archive active items, restore archived items, and permanently delete archived items.
- **FR-028**: After a bulk action, the app MUST report how many bookmarks changed and identify any selected items that were not changed.
- **FR-029**: Changing the current view or starting a different search MUST clear the current selection and notify the user that no items remain selected.
- **FR-030**: Users MUST be able to archive active bookmarks and restore archived bookmarks without losing bookmark details, tags, or reading state.
- **FR-031**: Users MUST be able to permanently delete bookmarks only from the archived view and only after an explicit confirmation that communicates irreversibility and the number of affected bookmarks.
- **FR-032**: The app MUST provide distinct, actionable empty states for an empty library, archived view, unread view, and search or filter criteria with no matches.
- **FR-033**: The app MUST retain entered form values after a failed save or edit attempt whenever those values remain safe to display.
- **FR-034**: All core bookmark operations, advanced search help, selection controls, formatted-note controls, and confirmation dialogs MUST be usable with keyboard-only navigation, visible focus, programmatically associated labels, and status feedback that does not rely on color alone.
- **FR-035**: The app MUST enforce these per-bookmark limits: 200 characters for the title, 2,048 for the web address, 500 for the description, 5,000 readable characters for notes, 30 per tag name, and 20 tags; validation MUST occur before saving and MUST NOT silently truncate user-entered content.

### Key Entities

- **Bookmark**: A saved web resource with a unique normalized web address, non-empty title, optional retrieved or edited description, optional site icon and preview image, optional formatted note, zero or more tags, lifecycle status (active or archived), reading state (not designated, unread, or read), creation date, and last-updated date.
- **Tag**: A normalized user-defined label used to organize, search, and filter bookmarks; a tag can belong to many bookmarks and a bookmark can have many tags.
- **Selection**: The current set of explicitly chosen bookmarks within one result view, used as the target for a bulk action and cleared when its result context changes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For at least 95% of responsive public pages containing a recognizable title, users see that title and every other available preview detail within 5 seconds of pasting the address under normal operating conditions.
- **SC-002**: In usability testing, at least 90% of first-time users can paste a valid address, review or adjust its automatic details, save it, and reopen it without assistance in under 45 seconds.
- **SC-003**: At least 90% of first-time users can add an item to read later, find it in the unread view, and mark it read without assistance in under 30 seconds.
- **SC-004**: Users can locate a known bookmark in a library of 10,000 entries using a tag, exact phrase, or Boolean query in under 10 seconds in at least 95% of test attempts.
- **SC-005**: Search, filter, and sort results become visible within 1 second for a library of 10,000 bookmarks in at least 95% of measured interactions.
- **SC-006**: Users can select and apply a valid tag, reading-state, archive, or restore action to 100 bookmarks in under 30 seconds, with an accurate completion summary.
- **SC-007**: At least 95% of save, edit, read-state, bulk-action, archive, restore, and delete test attempts produce the expected visible library state on the first attempt.
- **SC-008**: All core workflows can be completed using only a keyboard, and accessibility evaluation reports no critical barriers on the library, save/edit, unread, archived, advanced-search-help, and confirmation experiences.
- **SC-009**: No bookmark is permanently removed without an explicit user confirmation during acceptance testing.

## Assumptions

- The initial release is a private, single-user bookmark library on one device; accounts, multi-user permissions, synchronization across devices, sharing, and collaboration are outside scope.
- Public pages commonly expose some recognizable page details, but any individual title, description, icon, or preview image may be unavailable. Metadata retrieval is best-effort and bookmark saving remains available through a generated title.
- Automatic page details are retrieved when the address is first entered. Automatic periodic refresh and a manual refresh command are outside scope; the user may edit stored text at any time.
- Marking a bookmark read is an explicit action; simply opening its destination does not imply completion.
- Basic formatted notes include bold, italic, hyperlinks, bulleted lists, and numbered lists. Attachments, embedded media, tables, headings, and collaborative editing are outside scope.
- The user explicitly selects each bookmark included in a bulk action; selecting every result across multiple unseen result pages is outside scope.
- Saving offline copies of pages, saving reusable searches, and importing or exporting browser bookmarks are valuable follow-up capabilities but are deferred from this release.
- Browser extensions, folders, favorites, custom drag-and-drop ordering, automatic link-availability monitoring, and page screenshots beyond the page-provided representative image are outside scope.
- The app may open saved destinations, but it does not control or guarantee the safety, availability, or content of external websites.
