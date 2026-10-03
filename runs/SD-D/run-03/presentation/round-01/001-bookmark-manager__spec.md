# Feature Specification: Personal Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-17

**Status**: Draft — awaiting client approval

**Input**: User description: "I want to build an app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save and Revisit Bookmarks (Priority: P1)

As a user, I can save a web address with a meaningful title and later browse my saved bookmarks so I do not have to remember or rediscover useful pages.

**Why this priority**: Capturing and reopening links is the smallest complete experience that delivers the app's core value.

**Independent Test**: Start with an empty collection, save one valid bookmark, leave and return to the app, and open the saved destination from the collection.

**Acceptance Scenarios**:

1. **Given** the collection is empty, **When** the user saves a valid web address and title, **Then** the bookmark appears in the active collection with its title, address, and creation date.
2. **Given** a bookmark has been saved, **When** the user returns in a later session, **Then** the bookmark remains available.
3. **Given** a saved bookmark is visible, **When** the user chooses to open it, **Then** the destination opens without replacing the bookmark manager.
4. **Given** the user enters a missing title or an unsupported or malformed address, **When** they try to save, **Then** the bookmark is not saved and the relevant field displays an actionable correction message.

---

### User Story 2 - Find a Saved Bookmark (Priority: P2)

As a user with a growing collection, I can search, filter, and sort bookmarks so I can quickly locate the page I need.

**Why this priority**: A collection stops being useful if previously saved items are difficult to retrieve.

**Independent Test**: Seed bookmarks with distinct titles, addresses, notes, tags, favorite states, and dates; then verify that each search, filter, and sort produces the expected collection.

**Acceptance Scenarios**:

1. **Given** matching bookmarks exist, **When** the user enters part of a title, address, note, or tag without regard to letter case, **Then** only matching bookmarks are shown.
2. **Given** bookmarks have different tags and favorite states, **When** the user applies a tag or favorites filter, **Then** only bookmarks meeting all active filters are shown.
3. **Given** multiple bookmarks are visible, **When** the user sorts by newest, oldest, or title, **Then** all visible bookmarks are ordered accordingly.
4. **Given** no bookmark matches the current search and filters, **When** results are evaluated, **Then** a clear no-results state is shown with a way to clear the active criteria.

---

### User Story 3 - Organize the Collection (Priority: P3)

As a user, I can add notes and tags, mark important bookmarks as favorites, and archive inactive bookmarks so the collection reflects how I use it.

**Why this priority**: Lightweight organization keeps the collection understandable without making capture burdensome.

**Independent Test**: Save a bookmark, add notes and multiple tags, favorite it, archive it, and verify its details and visibility in active, favorite, tagged, and archived views.

**Acceptance Scenarios**:

1. **Given** a bookmark exists, **When** the user adds or removes notes and tags, **Then** the updated details are retained and immediately reflected in relevant search and filter results.
2. **Given** a bookmark exists, **When** the user marks or unmarks it as a favorite, **Then** its favorite state changes and the favorites filter reflects the change.
3. **Given** an active bookmark exists, **When** the user archives it, **Then** it is removed from the default active collection and appears in the archived view.
4. **Given** an archived bookmark exists, **When** the user restores it, **Then** it returns to the active collection with its other details unchanged.

---

### User Story 4 - Correct or Remove Bookmarks (Priority: P4)

As a user, I can edit outdated bookmark details and permanently delete bookmarks I no longer want so the collection remains accurate.

**Why this priority**: Maintenance is necessary over time but is less urgent than capture, retrieval, and organization.

**Independent Test**: Edit every editable field of a saved bookmark, confirm the changes survive a later session, then delete it and verify it no longer appears in any view.

**Acceptance Scenarios**:

1. **Given** a bookmark exists, **When** the user changes its title, address, notes, or tags with valid values, **Then** the updated values replace the previous values and the modification date is refreshed.
2. **Given** the user introduces an invalid required value while editing, **When** they try to save, **Then** the existing bookmark remains unchanged and the relevant field displays an actionable correction message.
3. **Given** a bookmark exists, **When** the user requests deletion, **Then** the app asks for confirmation before permanently removing it.
4. **Given** the user confirms deletion, **When** deletion completes, **Then** the bookmark no longer appears in active, favorite, tagged, search, or archived views.

### Edge Cases

- An entered address may contain accidental leading or trailing spaces; these are ignored before validation and saving.
- If an entered address exactly matches an existing bookmark after surrounding spaces are removed, the user is warned and may either view the existing item, cancel, or deliberately save another copy.
- Empty titles, addresses containing only spaces, and addresses other than `http://` or `https://` are rejected with a field-specific message.
- Repeated tags that differ only by capitalization or surrounding spaces are treated as one tag on the same bookmark.
- Search text with no matches and a collection with no bookmarks have distinct empty states and recovery actions.
- Clearing search or filters restores the applicable full collection without changing any bookmark.
- Very long titles, addresses, and notes remain readable without obscuring controls or breaking the collection layout.
- A bookmark can be archived while favorited; it is hidden from the default active collection and active favorites results until restored, but retains its favorite state.
- Cancelling an edit or deletion leaves the bookmark unchanged.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST let the user create a bookmark with a required title and required web address, plus optional notes and zero or more tags.
- **FR-002**: The app MUST accept only non-empty titles and valid `http://` or `https://` addresses, ignore surrounding whitespace, and show field-specific guidance when validation fails.
- **FR-003**: The app MUST warn before saving an address that exactly matches an existing bookmark after surrounding whitespace is removed, and MUST let the user view the existing bookmark, cancel, or intentionally continue.
- **FR-004**: The app MUST display active bookmarks as a browsable collection that shows, at minimum, title, destination address, tags, favorite state, and creation date.
- **FR-005**: The user MUST be able to open a bookmark's destination without losing their current place in the bookmark manager.
- **FR-006**: The app MUST retain saved bookmarks and all changes between user sessions until the user deletes them.
- **FR-007**: The user MUST be able to edit a bookmark's title, address, notes, and tags, subject to the same validation used at creation.
- **FR-008**: The user MUST be able to permanently delete a bookmark only after an explicit confirmation step.
- **FR-009**: The user MUST be able to add and remove tags; within a bookmark, tags that differ only by capitalization or surrounding whitespace MUST be treated as the same tag.
- **FR-010**: The user MUST be able to mark or unmark a bookmark as a favorite.
- **FR-011**: The user MUST be able to archive and restore a bookmark; archived bookmarks MUST be excluded from the default active collection while retaining their details and favorite state.
- **FR-012**: The user MUST be able to search active bookmarks using case-insensitive partial text matching across title, destination address, notes, and tags.
- **FR-013**: The user MUST be able to filter active bookmarks by favorite state, one tag, or both, and combine those filters with search text.
- **FR-014**: The user MUST be able to sort the current collection by newest created, oldest created, or title; newest created MUST be the default order.
- **FR-015**: The app MUST provide separate views for active and archived bookmarks and clearly identify which view is open.
- **FR-016**: The app MUST show helpful empty states for an empty collection and for search or filter criteria with no matches, including an appropriate next action.
- **FR-017**: The app MUST record when each bookmark was created and most recently modified and make both dates available to the user when viewing the bookmark's details.
- **FR-018**: All bookmark creation, retrieval, editing, organization, and deletion actions MUST be operable by keyboard with visible focus and programmatically identifiable controls and validation messages.
- **FR-019**: The primary collection and bookmark forms MUST remain usable on common phone and desktop screen sizes without requiring horizontal page scrolling.

### Key Entities

- **Bookmark**: A saved web destination. It has a title, destination address, optional notes, zero or more tags, favorite state, archive state, creation date, and modification date.
- **Tag**: A user-defined label used to organize and filter bookmarks. A tag may be associated with multiple bookmarks.
- **Collection View State**: The user's current context for viewing bookmarks, including active or archived scope, search text, tag or favorite filter, and sort order. It changes what is visible but does not alter bookmarks.

## Scope Boundaries

### Included in This Feature

- A personal, single-user bookmark collection.
- Bookmark capture, browsing, opening, editing, permanent deletion, search, filtering, sorting, tagging, favoriting, archiving, and restoring.
- Persistent use across sessions on the same app installation.
- Responsive and keyboard-accessible core workflows.

### Out of Scope for This Feature

- User accounts, authentication, multiple users, shared collections, and collaboration.
- Cross-device synchronization or cloud backup.
- Browser extensions, automatic browser-history capture, and native mobile applications.
- Import from or export to browser bookmark files or other services.
- Automatic page-title, preview-image, favicon, or page-content retrieval.
- Link-health monitoring, reminders, bulk actions, nested folders, and tag administration outside individual bookmarks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a usability test, at least 90% of first-time users can save a valid bookmark and reopen it without assistance.
- **SC-002**: Given a title and address to save, at least 90% of first-time users can complete bookmark capture within 30 seconds.
- **SC-003**: With a collection of 10,000 bookmarks, at least 95% of search, filter, and sort actions visibly update the collection within 1 second under normal operating conditions.
- **SC-004**: All valid bookmark changes made in a completed session are present when the user starts a later session, and no cancelled or invalid change is applied.
- **SC-005**: In accessibility verification, 100% of the core workflows—create, browse, open, search, filter, sort, edit, favorite, archive, restore, and delete—can be completed using only a keyboard.
- **SC-006**: The core workflows can be completed at screen widths from 320 pixels through standard desktop sizes without horizontal page scrolling.
- **SC-007**: In acceptance testing, search returns every seeded bookmark that contains the query in its title, address, notes, or tags and excludes every seeded non-match.

## Assumptions

- The initial release serves one person per app installation; identity and access control are unnecessary within this scope.
- Data is expected to persist on the same app installation, but synchronization and backup across devices are separate future capabilities.
- Users provide bookmark titles themselves; automatic page metadata retrieval is not required.
- Bookmark destinations are ordinary web pages using `http://` or `https://` addresses.
- A flat tag system is sufficient for the initial release; folders and tag hierarchies are not required.
- Deletion is permanent after confirmation; recovery from a trash area is not included.
- Users may intentionally save the same destination more than once after acknowledging the duplicate warning.
- The user has a modern browser and a stable local operating environment.
