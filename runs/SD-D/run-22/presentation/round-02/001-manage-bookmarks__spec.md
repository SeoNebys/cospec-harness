# Feature Specification: Personal Bookmark Manager

**Feature Branch**: `[001-manage-bookmarks]`

**Created**: 2026-09-25

**Status**: Draft

**Input**: User description: "Build an app to save and manage bookmarks, automatically retrieve page details, support precise and combinable search, and provide a read-later workflow."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a Bookmark with Page Details (Priority: P1)

As a user, I can paste a web address and have the app retrieve its page title, description, and site icon so that saving a useful bookmark usually requires no manual typing. I can review and adjust the retrieved title or description before or after saving.

**Why this priority**: Capturing and revisiting links is the core value of a bookmark manager.

**Independent Test**: Paste a valid public web address, verify that available page details appear for review, save without typing a title, and open the resulting bookmark from the library.

**Acceptance Scenarios**:

1. **Given** a valid public web address whose page provides a title, description, and site icon, **When** the user pastes it for saving, **Then** those details are retrieved and shown in editable form before the user confirms the save.
2. **Given** retrieved page details, **When** the user changes the title or description and saves, **Then** the bookmark contains the user's revised values rather than the original retrieved values.
3. **Given** a valid web address whose details cannot be fully retrieved, **When** retrieval finishes or times out, **Then** the user can still save the bookmark using a sensible title fallback and is told which details were unavailable.
4. **Given** a saved bookmark, **When** the user selects its web address, **Then** the destination opens without removing or changing the bookmark.
5. **Given** an invalid or unsupported web address, **When** the user tries to retrieve or save it, **Then** the bookmark is not saved and the user sees guidance for correcting the address.

---

### User Story 2 - Find and Organize Bookmarks (Priority: P2)

As a user, I can search broadly, search exact phrases, target tags, combine text and tag conditions, filter, and sort my bookmarks so that a growing library remains useful.

**Why this priority**: Organization and retrieval distinguish a bookmark manager from a simple list of links.

**Independent Test**: Create bookmarks with overlapping words and different tags, then verify broad text, quoted phrases, tag-specific searches, combined conditions, filters, and sort choices return the expected ordered subset.

**Acceptance Scenarios**:

1. **Given** bookmarks with different titles, web addresses, descriptions, notes, and tags, **When** the user enters unquoted search terms, **Then** only bookmarks containing all entered terms across searchable fields are shown, regardless of term order or letter case.
2. **Given** bookmarks containing the same words in different arrangements, **When** the user encloses words in quotation marks, **Then** only bookmarks containing that exact phrase in a searchable text field are shown.
3. **Given** bookmarks with different tags, **When** the user performs a tag-specific search, **Then** only bookmarks with a matching tag are shown and matches in non-tag fields do not qualify.
4. **Given** bookmarks about Rome with varied tags, **When** the user combines the text term `Rome` with a tag condition for either `article` or `book`, **Then** results contain Rome and have at least one of those tags.
5. **Given** multiple bookmarks, **When** the user chooses to sort by date saved or title, **Then** the visible bookmarks appear in the selected order.
6. **Given** an active search or filter with no matches, **When** results are displayed, **Then** the user sees a clear empty result state and can reset the active criteria.

---

### User Story 3 - Manage a Read-Later List (Priority: P3)

As a user, I can mark a bookmark to read later, view only unread read-later bookmarks, and mark one as read so that I can work through saved material deliberately.

**Why this priority**: A focused unread queue turns saved links into an actionable reading list.

**Independent Test**: Mark bookmarks for later, display the unread read-later view, mark one as read, and confirm it leaves that view while retaining its bookmark and reading status.

**Acceptance Scenarios**:

1. **Given** a new or existing bookmark, **When** the user marks it to read later, **Then** it is recorded as unread in the read-later collection.
2. **Given** a mixture of ordinary, unread read-later, and read bookmarks, **When** the user opens the unread read-later view, **Then** only unread bookmarks marked for later are shown.
3. **Given** an unread read-later bookmark, **When** the user marks it as read, **Then** it leaves the unread read-later view but remains saved and can still be found elsewhere.
4. **Given** a bookmark marked as read, **When** the user marks it unread again, **Then** it returns to the unread read-later view.

---

### User Story 4 - Maintain Bookmark Details (Priority: P4)

As a user, I can update or remove saved bookmarks so that the library stays accurate and uncluttered.

**Why this priority**: Long-term usefulness depends on correcting stale details and removing unwanted items.

**Independent Test**: Edit every user-controlled field of a saved bookmark and then delete it, confirming both actions persist.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user changes its title, web address, description, notes, or tags with valid values, **Then** the updated details replace the previous details and persist.
2. **Given** a saved bookmark, **When** the user requests deletion, **Then** the app asks for confirmation before permanently removing it.
3. **Given** a deletion confirmation, **When** the user cancels, **Then** the bookmark remains unchanged.

### Edge Cases

- When the same normalized web address is already saved, the app warns the user and offers to open or edit the existing bookmark rather than silently creating a duplicate.
- When page-detail retrieval is slow, blocked, or returns incomplete or malformed information, the app identifies the unavailable details, stops waiting within a reasonable period, and still lets the user save the valid web address.
- When a user manually changes retrieved details, later viewing or opening the bookmark does not silently overwrite those changes.
- Web addresses containing paths, query parameters, fragments, international characters, or long values remain intact when saved and opened.
- Search and tag matching ignore letter case and unnecessary surrounding whitespace while preserving quoted phrase boundaries.
- Unmatched quotation marks or incomplete search conditions produce understandable guidance rather than silently changing the intended meaning.
- Repeated search terms and repeated tag alternatives do not duplicate a bookmark in the results.
- A bookmark may have no description, notes, tags, or site icon, but it must always have a valid web address and a non-empty title or generated title fallback.
- When stored bookmarks cannot be loaded or a change cannot be saved, the app preserves the user's current input where possible and explains that the action did not complete.
- Long titles, notes, and tag lists remain readable without preventing access to bookmark actions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST let the user begin saving a bookmark by providing only a valid HTTP or HTTPS web address.
- **FR-002**: For a valid web address, the app MUST attempt to retrieve the destination page's title, description, and site icon and show the available details before save confirmation.
- **FR-003**: The user MUST be able to edit a retrieved title and description before saving and edit them again after saving.
- **FR-004**: If a title cannot be retrieved, the app MUST supply an editable, non-empty fallback derived from the destination so the bookmark can be saved without requiring the user to type a title.
- **FR-005**: Failure to retrieve some or all page details MUST NOT prevent saving an otherwise valid web address; the app MUST identify unavailable details and preserve any values already entered by the user.
- **FR-006**: The app MUST let the user optionally add plain-text personal notes and zero or more tags to a bookmark.
- **FR-007**: The app MUST preserve saved bookmarks between visits from the same user in the same app environment.
- **FR-008**: The app MUST display saved bookmarks as a browsable library showing, at minimum, title, web address, available site icon, tags, read-later status, and date saved.
- **FR-009**: The user MUST be able to open a saved bookmark's destination from the library.
- **FR-010**: The user MUST be able to edit the title, web address, description, notes, and tags of a saved bookmark, subject to the same validation used when creating it.
- **FR-011**: The user MUST be able to delete a bookmark only after an explicit confirmation step.
- **FR-012**: The app MUST support case-insensitive text search across bookmark titles, web addresses, descriptions, personal notes, and tags.
- **FR-013**: An unquoted multi-term search MUST match bookmarks containing every entered term across searchable fields; the terms need not occur in the same field or order.
- **FR-014**: Text enclosed in quotation marks MUST be treated as one exact, case-insensitive phrase that must occur within a single searchable text field.
- **FR-015**: The app MUST support tag-specific search conditions that match tags only and MUST support multiple tag alternatives where matching any listed tag satisfies that condition.
- **FR-016**: The app MUST allow general text terms, exact phrases, and tag-specific conditions to be combined in one search, with every distinct condition required for a result except alternatives explicitly grouped within a condition.
- **FR-017**: The app MUST communicate the active search conditions in understandable terms and provide clear guidance for malformed or incomplete conditions.
- **FR-018**: The app MUST let the user filter the library by one or more selected tags and clear those filters.
- **FR-019**: The app MUST let the user sort the visible library by title and by date saved, with both ascending and descending choices.
- **FR-020**: The app MUST let the user add or remove any bookmark from the read-later collection and mark a read-later bookmark as read or unread.
- **FR-021**: The app MUST provide a dedicated view containing only unread bookmarks currently marked for later.
- **FR-022**: Marking a bookmark as read MUST retain the bookmark and its read-later association unless the user separately removes it from read later.
- **FR-023**: The app MUST clearly distinguish an entirely empty library from a search, filter, or read-later view that has no matches and provide an appropriate next action in each state.
- **FR-024**: The app MUST reject malformed web addresses and explain how the user can correct them without discarding other entered details.
- **FR-025**: Before creating a bookmark whose normalized web address already exists, the app MUST warn the user and direct them to the existing bookmark rather than silently creating a duplicate.
- **FR-026**: The app MUST provide clear success or failure feedback after metadata retrieval, create, update, read-status, and delete actions.
- **FR-027**: All core bookmark actions MUST be usable with keyboard-only navigation and expose understandable labels and status messages to assistive technology.

### Key Entities

- **Bookmark**: A saved web resource with a unique identity, web address, title, optional description, optional site icon, optional personal notes, zero or more tags, read-later membership, read/unread status, date saved, and date last updated. Its descriptive details may originate from the destination page and be overridden by the user.
- **Tag**: A user-defined organizational label associated with one or more bookmarks; tags are compared without regard to letter case while retaining a consistent display label.
- **Search Condition**: A general text term, exact phrase, or tag-specific condition. Conditions can be combined, including alternatives within a tag condition, to express a precise query.
- **Library View**: The current presentation of bookmarks, including search conditions, selected tag filters, read-later scope, and sort order. It does not change the underlying bookmarks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For at least 90% of tested public pages that publish a title, description, and site icon, all published details are available for review within 5 seconds of entering the web address under normal operating conditions.
- **SC-002**: At least 90% of first-time test participants can save and then reopen a bookmark without typing a title and without assistance in under 45 seconds.
- **SC-003**: A user can find a known bookmark within 10 seconds in a library of 1,000 bookmarks using general terms, an exact phrase, tag conditions, or a combination of them.
- **SC-004**: For a library of 1,000 bookmarks, search, filtering, sorting, and opening the unread read-later view show the completed result within 1 second for at least 95% of attempts under normal operating conditions.
- **SC-005**: All tested create, edit, read-status, and delete outcomes remain correct after leaving and returning to the app.
- **SC-006**: In usability testing, at least 90% of participants complete the save, combined-search, read-later, edit, and delete journeys without a critical error.
- **SC-007**: Every core journey can be completed using only a keyboard, and all controls and action outcomes are announced meaningfully by commonly used assistive technology.

## Assumptions

- The first release is a personal, single-user bookmark library; accounts, sign-in, multi-user permissions, and sharing are outside its scope.
- The app is intended for modern desktop and mobile web browsers with a stable connection to its chosen runtime environment.
- Page titles, descriptions, and site icons are retrieved when destinations make them available; other preview imagery and ongoing automatic refresh of page details are outside the first release.
- User edits take precedence over retrieved page details and are not silently replaced.
- Search combinations use an understandable structured query entered in one search experience; visual query-building controls and natural-language interpretation are not required in the first release.
- A bookmark added to read later starts as unread. Reading status is changed explicitly by the user rather than inferred merely from opening the destination.
- Browser extensions, browser bookmark synchronization, bulk import/export, folders, favorites, archived states, and link-health monitoring are outside the first release.
- Deletion is permanent after confirmation; recovery and version history are outside the first release.
- Only HTTP and HTTPS destinations are supported in the first release.
- Tags are free-form labels rather than a nested hierarchy.
