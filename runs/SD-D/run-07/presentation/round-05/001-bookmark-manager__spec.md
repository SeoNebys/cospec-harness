# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`  
**Created**: 2026-09-18  
**Last Updated**: 2026-09-18  
**Status**: Approved  
**Input**: Build an app to save and manage bookmarks, including automatic page details, read-later tracking, notes, rich search, and bulk organization.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark with page details (Priority: P1)

As a user, I want to paste a web address and have the app retrieve the page title, description, and site icon so that saving a recognizable bookmark requires minimal typing.

**Why this priority**: Fast capture with useful details is the core value of the bookmark manager.

**Independent Test**: Paste a valid public web address, review and edit the retrieved details, save it, and reopen the destination.

**Acceptance Scenarios**:

1. **Given** the add-bookmark view, **When** the user enters a valid web address, **Then** the app retrieves and previews the page title, description, and site icon before saving.
2. **Given** retrieved details, **When** the user edits the title or description and saves, **Then** the edited values are retained.
3. **Given** details cannot be retrieved or are incomplete, **When** retrieval finishes, **Then** the app explains what is missing and permits manual entry before saving.
4. **Given** the normalized address already belongs to a saved bookmark, **When** the user attempts to add it, **Then** no duplicate is created and the app takes the user to the existing bookmark.
5. **Given** a saved bookmark, **When** the user selects its destination, **Then** the page opens without losing the bookmark collection.

---

### User Story 2 - Find bookmarks with precise searches (Priority: P2)

As a user, I want to search all useful bookmark text and combine exact phrases, tags, and Boolean conditions so that I can find a specific item in a large collection.

**Why this priority**: A growing collection remains valuable only when its contents can be retrieved precisely.

**Independent Test**: Create deliberately overlapping bookmarks, then verify plain text, tag-specific, quoted phrase, `AND`, `OR`, `NOT`, and grouped searches return the correct sets.

**Acceptance Scenarios**:

1. **Given** several bookmarks, **When** the user enters plain text, **Then** matching title, address, description, personal note, or tag text is returned without regard to case.
2. **Given** tagged bookmarks, **When** the user searches for a specific tag, **Then** only bookmarks carrying that tag are returned.
3. **Given** similar wording, **When** the user encloses a phrase in quotation marks, **Then** only bookmarks containing that exact phrase are returned.
4. **Given** several terms or tag conditions, **When** the user combines them with `AND`, `OR`, `NOT`, or parentheses, **Then** results reflect the expression and its active interpretation is visible.
5. **Given** a malformed expression, **When** it is submitted, **Then** the app identifies the problem, retains the query, and offers correction guidance.
6. **Given** no matches, **When** results appear, **Then** the app shows a clear empty state and a way to clear the query or filters.

---

### User Story 3 - Keep a read-later queue (Priority: P2)

As a user, I want to mark bookmarks unread or read and view only unread items so that I can maintain a distinct queue of material I still intend to read.

**Why this priority**: Read-later status represents unfinished reading, independently of lasting importance expressed by favorites.

**Independent Test**: Mark bookmarks unread, open the unread-only view, mark one read, and verify it leaves that view without changing its favorite or archive state.

**Acceptance Scenarios**:

1. **Given** an active bookmark, **When** the user marks it unread, **Then** it appears in the unread-only view.
2. **Given** an unread bookmark, **When** the user marks it read, **Then** it leaves the unread-only view but remains in the main collection.
3. **Given** a bookmark is unread and favorite, **When** either status changes, **Then** the other remains unchanged.
4. **Given** no unread items remain, **When** the unread-only view opens, **Then** the app shows a clear completed state.

---

### User Story 4 - Add and review personal notes (Priority: P2)

As a user, I want to attach my own notes to a bookmark and see them when viewing it so that I can preserve personal context.

**Why this priority**: Personal context makes saved material easier to understand and retrieve later.

**Independent Test**: Add and edit a note, reopen the bookmark, confirm the note is visible, and find it using text found only in that note.

**Acceptance Scenarios**:

1. **Given** a new or saved bookmark, **When** the user adds or edits a note, **Then** it is saved and displayed in the detailed view.
2. **Given** a personal note, **When** the user searches for text appearing only in it, **Then** that bookmark is returned.
3. **Given** both a page description and personal note, **When** the bookmark is viewed or edited, **Then** the fields remain visibly distinct.

---

### User Story 5 - Organize individual and multiple bookmarks (Priority: P3)

As a user, I want to edit, favorite, archive, tag, mark as read, or delete bookmarks individually or in groups so that maintenance is efficient.

**Why this priority**: Maintenance tools prevent a large collection from becoming outdated or overwhelming.

**Independent Test**: Perform each bulk action on selected bookmarks, then against all bookmarks matching a query, and verify only the intended items change.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user changes its title, address, description, note, or tags, **Then** the values are retained.
2. **Given** selected bookmarks, **When** the user chooses a bulk action, **Then** tags can be added, items archived, read status changed, or items deleted in one action.
3. **Given** an active query or filter, **When** the user selects all matches, **Then** the app states how many bookmarks will be affected and applies the action to the entire matching set, not only the visible portion.
4. **Given** a bulk permanent deletion, **When** it is initiated, **Then** the affected count is shown and explicit confirmation is required.
5. **Given** a bookmark, **When** its favorite state changes, **Then** it can be filtered by that state.
6. **Given** an active bookmark, **When** it is archived, **Then** it moves to an archived view where it can be restored.

### Edge Cases

- A slow, unavailable, restricted, redirected, or non-HTML destination may not yield page details; the user can continue with identified missing values and manual text.
- If the address changes during retrieval, results for the old address do not overwrite the current draft.
- Empty or excessively long retrieved text remains editable; a missing icon uses a consistent fallback and does not prevent saving.
- Duplicate detection ignores inconsequential variations such as fragments or a trailing slash while preserving meaningful query values.
- Titles, descriptions, notes, and tags containing punctuation, quotes, accented characters, or emoji remain readable and searchable.
- Whitespace is trimmed; tags differing only by case are treated as the same tag.
- A bookmark may omit description, notes, tags, or icon, but requires a valid address and non-empty title.
- Boolean operators inside quoted phrases are text; unmatched quotes or parentheses produce correction guidance.
- “Select all matching” includes matches beyond the visible page, and the affected count is shown before acting.
- Partial bulk failure reports successes and identifies unchanged items without reversing successful changes.
- Failed saves or updates show a clear error and preserve unsaved edits for retry.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST allow a bookmark to begin with a valid `http` or `https` address.
- **FR-002**: After a valid address is entered, the app MUST attempt to retrieve and preview the page title, description, and site icon before saving.
- **FR-003**: The user MUST be able to edit retrieved title and description before and after saving.
- **FR-004**: Failed or incomplete retrieval MUST identify missing details and permit manual entry; missing description or icon MUST NOT prevent saving.
- **FR-005**: A bookmark MUST have a valid address and non-empty title before saving.
- **FR-006**: Validation or save failure MUST preserve retrieved and manually entered values.
- **FR-007**: The app MUST detect an existing normalized address, MUST NOT create a duplicate, and MUST navigate to the existing bookmark.
- **FR-008**: Active bookmarks MUST display title, destination, icon or fallback, tags, favorite state, read status, and date saved.
- **FR-009**: Opening a destination MUST retain access to the bookmark collection.
- **FR-010**: Each bookmark MUST support an optional personal note stored and displayed separately from the page description.
- **FR-011**: Users MUST be able to edit title, address, description, note, and tags.
- **FR-012**: Users MUST be able to mark bookmarks unread or read and access an unread-only view.
- **FR-013**: Read and favorite status MUST be independent.
- **FR-014**: Users MUST be able to change favorite status and filter by it.
- **FR-015**: Users MUST be able to archive, separately view, and restore bookmarks.
- **FR-016**: Permanent individual deletion MUST require confirmation.
- **FR-017**: Case-insensitive plain-text search MUST cover titles, addresses, descriptions, notes, and tags.
- **FR-018**: Search MUST support tag-specific conditions, quoted exact phrases, `AND`, `OR`, `NOT`, and parentheses.
- **FR-019**: Unless parentheses override it, search precedence MUST be exact phrases and tag conditions, then `NOT`, `AND`, and `OR`.
- **FR-020**: The interpreted query MUST be visible, and invalid expressions MUST receive actionable correction guidance.
- **FR-021**: Users MUST be able to filter by one or more tags (matching every selected tag), favorite status, and read status.
- **FR-022**: Users MUST be able to sort by date saved, title, or most recently updated.
- **FR-023**: Users MUST be able to select multiple displayed bookmarks and add tags, archive, change read status, or permanently delete them in one action.
- **FR-024**: Users MUST be able to select all bookmarks matching the current query and filters, including undisplayed matches.
- **FR-025**: Before a bulk action, the app MUST show the action and affected count; permanent deletion MUST require explicit confirmation.
- **FR-026**: Bulk outcomes MUST report success and failure counts and identify unchanged bookmarks.
- **FR-027**: Clear empty states MUST exist for the collection, unread view, archive, and queries with no matches.
- **FR-028**: Bookmark details, notes, and organization state MUST persist between sessions on the same installation.
- **FR-029**: Creation and most recent update times MUST be recorded.
- **FR-030**: Primary bookmark, search, selection, and bulk-action workflows MUST support keyboard and pointer input.
- **FR-031**: Labels, focus states, and feedback MUST be readable and MUST NOT depend on color alone.

### Key Entities

- **Bookmark**: A saved resource with normalized address, editable title and description, optional note, icon or fallback, tags, favorite status, read status, archive status, and creation/update times.
- **Tag**: A normalized label related to one or more bookmarks; bookmarks may have multiple tags.
- **Bookmark Selection**: Explicitly selected bookmarks or all current matches, plus their count and intended bulk action.
- **Search Expression**: Plain text, exact phrases, tag conditions, Boolean operators, and grouping that determine the current result set.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For at least 90% of reachable public pages providing title and description, those details and any available icon are previewed within 5 seconds.
- **SC-002**: At least 90% of first-time test users save and reopen a bookmark without typing its title or description, without assistance, in under 45 seconds.
- **SC-003**: Users locate a known bookmark among 10,000 items with a tag, exact phrase, or combined search in under 10 seconds.
- **SC-004**: Search, filtering, sorting, saving, read-status, and individual updates visibly resolve within 1 second for 10,000 bookmarks under normal conditions.
- **SC-005**: A bulk action on 1,000 matching bookmarks produces a visible outcome summary within 5 seconds under normal conditions.
- **SC-006**: Acceptance testing confirms 100% of valid details, notes, read states, and organization changes persist after reopening the app.
- **SC-007**: At least 90% of usability participants create a read-later queue, use a combined search, add a note, and complete a bulk action on their first attempt without assistance.
- **SC-008**: All primary bookmark and bulk-management workflows can be completed using only a keyboard with the current target visually identifiable.

## Assumptions

- The first release is personal and single-user; accounts, collaboration, sharing, and permissions are outside scope.
- Page details and icons are retrieved when a bookmark is created; automatic later monitoring or refresh is outside scope.
- A bookmark starts as read unless explicitly marked unread during or after creation.
- Personal notes are plain text in the first release.
- Import/export, browser extensions, offline copies, and link-health monitoring are outside scope.
- Data remains on the installation where it was created; cross-device synchronization is outside scope.
- Permanent deletion is irreversible after confirmation.
