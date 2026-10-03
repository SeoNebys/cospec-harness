# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-27

**Status**: Approved

**Input**: User description: "I want to build an app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save and Revisit Enriched Bookmarks (Priority: P1)

As a user, I can paste a web address and have the app fill in useful page details so that saving a recognizable bookmark takes little effort.

**Why this priority**: Saving and reopening links is the core value of a bookmark manager and forms the smallest useful product.

**Independent Test**: Paste a valid web address for an accessible page, verify that the page title and available visual metadata are suggested, edit the title, save the bookmark, leave and return to the list, and open the saved destination.

**Acceptance Scenarios**:

1. **Given** a valid address for an accessible page, **When** the user submits it for saving, **Then** the app retrieves and suggests the page title and any available site icon or preview image before the user confirms the save.
2. **Given** retrieved page details, **When** the user changes the suggested title before saving, **Then** the user's title is saved instead of the retrieved title.
3. **Given** page details cannot be fully retrieved, **When** retrieval finishes or fails, **Then** the user can enter or edit a title and save the bookmark without an icon or preview image.
4. **Given** a bookmark has been saved, **When** the user returns in a later session, **Then** the bookmark and its saved page details are still present.
5. **Given** a saved bookmark, **When** the user chooses to open it, **Then** the destination opens without replacing or losing the bookmark collection.
6. **Given** an invalid or unsupported address, **When** the user tries to save it, **Then** the app explains the problem and preserves the entered details for correction.
7. **Given** the submitted address matches an existing active or archived bookmark, **When** the user tries to save it, **Then** the app opens that existing bookmark for editing and does not create another bookmark.

---

### User Story 2 - Find and Organize Bookmarks (Priority: P2)

As a user with a growing collection, I can add tags and search or filter my bookmarks so that I can quickly locate a relevant link.

**Why this priority**: A collection becomes useful over time only if saved items remain easy to retrieve.

**Independent Test**: Create bookmarks with overlapping titles, addresses, formatted notes, and tags; verify ordinary terms, `#tag`, quoted phrases, `OR`, and `NOT` queries show all and only the expected matches.

**Acceptance Scenarios**:

1. **Given** a bookmark is being created or edited, **When** the user assigns one or more tags, **Then** those tags are shown with the bookmark and are available as filters.
2. **Given** multiple saved bookmarks, **When** the user searches using ordinary words contained in a title, address, note, or tag, **Then** bookmarks containing all entered words are shown.
3. **Given** bookmarks with different tags, **When** the user searches for `#research`, **Then** only bookmarks tagged `research` are shown, regardless of tag letter case.
4. **Given** bookmarks containing different terms, **When** the user joins terms or phrases with `OR`, **Then** bookmarks matching either side are shown.
5. **Given** bookmarks containing different terms, **When** the user precedes a term or phrase with `NOT`, **Then** matching bookmarks that contain the excluded value are omitted.
6. **Given** bookmarks with similar wording, **When** the user encloses words in quotation marks, **Then** only bookmarks containing that exact phrase are shown.
7. **Given** bookmarks with different tags, **When** the user selects a tag filter, **Then** only bookmarks carrying that tag are shown.
8. **Given** a malformed advanced query, **When** the user submits it, **Then** the app identifies the query problem without clearing the entered search.
9. **Given** a search or filter with no matches, **When** results are evaluated, **Then** the app shows a clear empty state and a way to clear the search or filter.

---

### User Story 3 - Keep a Read-Later Queue (Priority: P2)

As a user, I can mark bookmarks to read later and track whether I have read them so that unfinished reading remains separate from favorites.

**Why this priority**: A dedicated reading state supports the user's recurring consumption workflow and has meaning distinct from liking or prioritizing an item.

**Independent Test**: Mark a bookmark to read later, confirm it appears in the unread read-later view, mark it as read, and confirm it no longer appears among unread items while retaining its bookmark and read status.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user adds it to read later, **Then** it is marked unread and appears in the read-later view.
2. **Given** an unread read-later bookmark, **When** the user marks it as read, **Then** it leaves the unread view and remains available in the collection with its read status.
3. **Given** a read bookmark, **When** the user marks it unread, **Then** it returns to the unread read-later view.
4. **Given** a bookmarked favorite, **When** its read-later state changes, **Then** its favorite state remains unchanged.

---

### User Story 4 - Add and Read Formatted Notes (Priority: P3)

As a user, I can add lightweight formatting to bookmark notes and read the rendered result so that my context is structured and easy to scan.

**Why this priority**: Structured notes improve the long-term value of saved bookmarks without blocking the core save and retrieval flows.

**Independent Test**: Add a note containing a heading, link, and list; save it; then verify each supported element is rendered clearly and can be edited again without losing content.

**Acceptance Scenarios**:

1. **Given** a bookmark is being created or edited, **When** the user adds headings, links, or lists to its note, **Then** the app preserves those supported elements.
2. **Given** a bookmark with a formatted note, **When** the user views the bookmark, **Then** the note is rendered as formatted content rather than displayed as formatting notation.
3. **Given** a rendered note, **When** the user returns to edit it, **Then** all supported content remains available for editing.
4. **Given** note content that could execute active or unsafe content, **When** the note is rendered, **Then** that content is displayed or removed safely and is not executed.

---

### User Story 5 - Maintain the Collection (Priority: P3)

As a user, I can update, favorite, archive, and delete bookmarks so that my collection remains accurate and manageable.

**Why this priority**: Maintenance controls keep the collection useful but depend on the core save-and-find flows.

**Independent Test**: Change a bookmark's title, address, formatted note, or tags; favorite it, archive it, restore it, and delete it; verify the list reflects every action and asks for confirmation before permanent removal.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user edits its title, address, formatted note, or tags, **Then** the updated details replace the previous details.
2. **Given** a saved bookmark, **When** the user marks or unmarks it as a favorite, **Then** its favorite status changes and it can be filtered by that status.
3. **Given** an active bookmark, **When** the user archives it, **Then** it leaves the default active list and remains available in an archived view.
4. **Given** an archived bookmark, **When** the user restores it, **Then** it returns to the active list with its details intact.
5. **Given** a saved bookmark, **When** the user requests deletion, **Then** the app requires confirmation before permanently removing it.

### Edge Cases

- Saving an address already present in the active or archived collection opens the existing bookmark for editing and never creates a duplicate.
- Duplicate comparison ignores surrounding whitespace and differences in scheme or host letter case, but treats different paths, query values, and fragments as different destinations.
- Addresses with surrounding whitespace are normalized before validation; only web addresses using `http` or `https` are accepted in this version.
- Titles, notes, and tags that exceed their stated limits are rejected with a clear message before saving.
- If page details are unavailable, incomplete, slow to arrive, or blocked by the destination, the user can continue with a manually entered title and a neutral visual placeholder.
- If a retrieved preview image later becomes unavailable, the bookmark remains usable and shows its site icon or a neutral placeholder.
- Search terms and operators are case-insensitive and tolerate leading or trailing whitespace; quoted phrase content retains its literal word order.
- A `#` token that does not name an existing tag produces an empty result rather than falling back to ordinary text search.
- `NOT` without an included search term is accepted and searches the whole current bookmark view while excluding matches.
- Removing a tag from its last bookmark removes it from the available tag filters.
- A failed save or edit does not discard the user's unsaved input.
- An empty collection and an empty filtered result are presented as distinct states with appropriate next actions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow users to initiate saving a bookmark by entering a valid `http` or `https` address.
- **FR-002**: For a valid address, the system MUST attempt to retrieve the page title and any available site icon or preview image and present the retrieved details before save confirmation.
- **FR-003**: Users MUST be able to edit a retrieved title before saving and edit the title again after saving.
- **FR-004**: If a page title cannot be retrieved, the system MUST allow the user to enter a title manually and continue saving; failure to retrieve an icon or preview image MUST NOT prevent saving.
- **FR-005**: The system MUST allow an optional formatted note and zero or more tags on each bookmark.
- **FR-006**: Formatted notes MUST support headings, links, ordered lists, and unordered lists, and MUST render those elements when the bookmark is viewed.
- **FR-007**: The system MUST prevent active or unsafe content in notes from executing when notes are rendered.
- **FR-008**: When a submitted address matches an existing active or archived bookmark, the system MUST open that bookmark for editing and MUST NOT create another bookmark.
- **FR-009**: Duplicate comparison MUST ignore surrounding whitespace and scheme or host letter case while preserving path, query, and fragment distinctions.
- **FR-010**: The system MUST limit titles to 200 characters, notes to 2,000 characters, individual tags to 40 characters, and tags per bookmark to 20, and MUST explain any violated limit.
- **FR-011**: The system MUST retain saved bookmarks and their management state across user sessions.
- **FR-012**: The system MUST display active bookmarks in a browsable list showing, at minimum, title, destination host, available site icon or preview, tags, favorite state, read-later state, and save date.
- **FR-013**: Users MUST be able to open a saved bookmark's destination while retaining access to their collection.
- **FR-014**: Users MUST be able to edit a bookmark's title, address, formatted note, and tags.
- **FR-015**: Users MUST be able to permanently delete a bookmark only after confirming the action.
- **FR-016**: Users MUST be able to mark and unmark bookmarks as favorites and view only favorites.
- **FR-017**: Users MUST be able to add a bookmark to read later, mark it read or unread, and view unread read-later bookmarks separately from favorites.
- **FR-018**: Changing a bookmark's read-later state MUST NOT change its favorite state, and changing its favorite state MUST NOT change its read-later state.
- **FR-019**: Users MUST be able to archive and restore bookmarks; archived bookmarks MUST be excluded from the default active list and unread read-later view.
- **FR-020**: Users MUST be able to search bookmarks by title, address, rendered note text, or tag using case-insensitive matching.
- **FR-021**: A search containing multiple ordinary words MUST require all words to match unless an explicit `OR` operator separates them.
- **FR-022**: Search MUST support exact phrases in quotation marks, direct tag matching with `#tag`, alternatives joined by `OR`, and exclusions introduced by `NOT`.
- **FR-023**: The system MUST explain malformed searches, including unmatched quotation marks or an operator missing a required value, without clearing the entered query.
- **FR-024**: Users MUST be able to filter bookmarks by tag and clear active search and filter criteria.
- **FR-025**: Users MUST be able to sort the currently viewed bookmarks by newest saved, oldest saved, or title.
- **FR-026**: The system MUST preserve valid existing bookmark data and entered changes when an add or edit attempt fails validation.
- **FR-027**: The system MUST distinguish between an entirely empty collection and a search or filter that has no matches, and MUST offer a relevant recovery action for each.
- **FR-028**: All core bookmark actions MUST be operable using keyboard-only navigation and MUST expose clear text labels or accessible names.

### Key Entities

- **Bookmark**: A saved web destination with a unique identity, address, editable title, optional formatted note, optional site icon or preview image reference, zero or more tags, favorite status, read-later status, read/unread status, archive status, creation time, and last-updated time.
- **Tag**: A user-defined organizational label. A tag may be assigned to many bookmarks and is available as a filter while at least one bookmark uses it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of first-time users can paste an address, review or edit the retrieved title, save the bookmark, and reopen it without assistance in under 45 seconds.
- **SC-002**: For at least 95% of tested publicly accessible pages that expose a title, the correct page title is offered without manual entry; unavailable optional imagery never blocks saving.
- **SC-003**: Users can locate a known bookmark in a collection of 1,000 items using words, `#tag`, quoted phrases, `OR`, or `NOT` in under 10 seconds.
- **SC-004**: Search, filtering, sorting, read-status changes, archiving, favoriting, and editing show their completed result within 1 second for collections of up to 10,000 bookmarks under normal operating conditions.
- **SC-005**: In acceptance testing, 100% of duplicate-address submissions open the existing item and create no additional bookmark.
- **SC-006**: In acceptance testing, 100% of valid add, edit, archive, restore, favorite, read-later, read-status, and confirmed-delete actions remain correct after leaving and returning to the app.
- **SC-007**: At least 95% of representative users complete the save, advanced find, edit, read-later, archive, and delete journeys on their first attempt without external guidance.
- **SC-008**: All supported headings, links, and list styles survive save and edit cycles and render correctly in acceptance testing, with no active note content executing.
- **SC-009**: All primary bookmark-management journeys can be completed using keyboard-only navigation, with no critical accessibility barriers in an agreed accessibility review.

## Assumptions

- The first release is a personal, single-user bookmark manager; accounts, sharing, collaboration, and role-based access are outside this feature's scope.
- The app manages bookmarks entered by the user and does not import browser bookmark files or synchronize with browser bookmark stores in the first release.
- The app does not guarantee that a destination page is safe, reachable, or unchanged; opening a bookmark uses the saved address.
- Page metadata retrieval covers the title and any site-provided icon or preview image; generated screenshots, page summaries, folders, bulk actions, and link-health monitoring remain outside the first-release scope.
- Users may proceed with a manual title when the destination is unreachable, blocks retrieval, requires sign-in, or does not provide usable metadata.
- Advanced search supports ordinary terms, `#tag`, quoted phrases, `OR`, and `NOT`; grouping with parentheses, fuzzy matching, and field-specific prefixes beyond tags are outside the first release.
- Notes use a constrained set of formatting limited to headings, links, ordered lists, and unordered lists in the first release.
- English is the initial interface language, while bookmark text may contain Unicode characters.
