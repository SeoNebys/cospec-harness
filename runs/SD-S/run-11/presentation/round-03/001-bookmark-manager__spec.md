# Feature Specification: Bookmark Manager

**Feature Branch**: `[001-bookmark-manager]`

**Created**: 2026-09-18

**Status**: Approved on 2026-09-18

**Input**: User description: "Build an app to save and manage bookmarks. When a web address is entered, automatically fill the page name and a short description when available; keep both editable and allow saving when the destination cannot be reached."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save and Open Bookmarks (Priority: P1)

As a user, I want to paste a web address and have the app fill in a recognizable page title and short description when available, so I can save useful entries without typing those details myself.

**Why this priority**: Fast, low-effort saving and reopening of recognizable links is the core value of a bookmark manager and forms the smallest useful product.

**Independent Test**: Paste an address for an accessible page that publishes a title and description, verify those details are filled in and remain editable, save and reopen the bookmark, then repeat with an unavailable page and verify that saving still succeeds with a useful fallback.

**Acceptance Scenarios**:

1. **Given** the user pastes or enters a valid web address for an accessible page that provides a page title and description, **When** the address is accepted, **Then** the title and description fields are automatically filled with those page-provided details for the user to review before saving.
2. **Given** an accessible page provides a title but no description, **When** its address is entered, **Then** the title is automatically filled and the description remains optional and editable.
3. **Given** the destination cannot be reached, responds too slowly, or provides no usable title, **When** the user saves the bookmark, **Then** saving remains available, the web address is used as the fallback title, and the app explains that page details could not be filled in.
4. **Given** page details have been automatically filled, **When** the user edits the title or description before saving, **Then** the user's values are saved and are not replaced by a later automatic result.
5. **Given** a bookmark is in the library, **When** the user opens it, **Then** the destination opens without losing the user's current place in the library.
6. **Given** the user has saved bookmarks, **When** they leave and later return to the app, **Then** their saved bookmarks are still available.

---

### User Story 2 - Find and Organize Bookmarks (Priority: P2)

As a user, I want to describe, tag, search, filter, and sort bookmarks so I can quickly find a link as my collection grows.

**Why this priority**: A bookmark collection becomes useful over time only if users can retrieve items without scanning the entire library.

**Independent Test**: Create bookmarks with different titles, descriptions, tags, favorite states, and archive states; verify that searches, filters, and sorting return the expected entries.

**Acceptance Scenarios**:

1. **Given** bookmarks contain different titles, web addresses, descriptions, and tags, **When** the user searches for text found in any of those fields, **Then** only matching active bookmarks are shown.
2. **Given** bookmarks use multiple tags, **When** the user selects a tag filter, **Then** only active bookmarks with that tag are shown and the active filter is visible.
3. **Given** some bookmarks are marked as favorites, **When** the user filters to favorites, **Then** only active favorite bookmarks are shown.
4. **Given** the library contains multiple bookmarks, **When** the user selects a supported sort order, **Then** the visible results are reordered by newest, oldest, or title.
5. **Given** an active search or filter has no matches, **When** results are evaluated, **Then** the user sees a clear no-results state and a way to clear the search and filters.

---

### User Story 3 - Maintain the Collection (Priority: P3)

As a user, I want to edit, archive, restore, and delete bookmarks so the collection stays accurate and uncluttered.

**Why this priority**: Maintenance prevents outdated or unwanted entries from reducing the value of the library, while archiving provides a safer alternative to deletion.

**Independent Test**: Update a bookmark, archive and restore it, then permanently delete it after confirming the destructive action.

**Acceptance Scenarios**:

1. **Given** a bookmark exists, **When** the user changes its web address, title, description, tags, or favorite state and saves, **Then** the updated values appear everywhere that bookmark is shown.
2. **Given** an active bookmark exists, **When** the user archives it, **Then** it leaves the active library and appears in the archived view.
3. **Given** an archived bookmark exists, **When** the user restores it, **Then** it returns to the active library with its details unchanged.
4. **Given** a bookmark exists, **When** the user chooses delete, **Then** the system asks for confirmation before permanently removing it.
5. **Given** a delete confirmation is shown, **When** the user cancels, **Then** the bookmark remains unchanged.

### Edge Cases

- Empty libraries show a helpful first-use state with a clear action for saving the first bookmark.
- Blank or malformed web addresses are rejected with an actionable message, without discarding other entered details.
- Web addresses without a scheme are accepted when they can be interpreted unambiguously as a website address.
- Page-detail retrieval failures, access restrictions, redirects, missing details, and slow responses do not prevent or indefinitely delay saving.
- Page-provided titles or descriptions containing unusable formatting are presented as readable plain text before saving.
- A late page-detail result does not overwrite a title or description the user has already entered or edited.
- Saving a web address that already exists in the same library warns the user and offers to view or update the existing bookmark instead of silently creating a duplicate.
- Very long titles, descriptions, web addresses, and tag names remain readable and do not prevent the user from accessing controls.
- Searches ignore letter case and incidental leading or trailing spaces.
- Removing the last bookmark from a filtered view produces the correct empty state rather than leaving stale content visible.
- If a destination is unavailable, the saved bookmark remains in the library and can still be edited, archived, or deleted.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let the user save a bookmark with a valid web address, an automatically filled or user-entered title and description, and zero or more tags.
- **FR-002**: The system MUST require a web address, reject addresses that cannot be interpreted as web destinations, and preserve the user's other entered values after a validation error.
- **FR-003**: After the user supplies a valid web address, the system MUST automatically attempt to fill the title and description from basic details published by the destination page.
- **FR-004**: The system MUST show automatically filled details for review and MUST let the user change or remove them before saving.
- **FR-005**: Automatic page-detail results MUST NOT overwrite a title or description after the user has entered or edited that field.
- **FR-006**: If the destination cannot be reached promptly or does not provide a usable title or description, the system MUST explain the outcome without blocking save; it MUST use the web address as the fallback title when no title is available and allow the description to remain blank.
- **FR-007**: The system MUST persist bookmarks between visits, including their web address, title, description, tags, favorite state, archive state, creation date, and last-updated date.
- **FR-008**: The active library MUST show each bookmark's title, destination, tags, favorite state, and enough description and date information to distinguish and manage the item.
- **FR-009**: The user MUST be able to open a saved destination without losing the current library state.
- **FR-010**: The user MUST be able to edit the web address, title, description, and tags of a bookmark and toggle its favorite state.
- **FR-011**: The user MUST be able to search active bookmarks by title, web address, description, or tag using case-insensitive text matching.
- **FR-012**: The user MUST be able to filter active bookmarks by tag and favorite state, combine those filters with search, see which constraints are active, and clear them.
- **FR-013**: The user MUST be able to sort the visible collection by newest created, oldest created, or title in alphabetical order.
- **FR-014**: The system MUST warn when a saved web address already exists in the user's library and MUST direct the user to the existing entry rather than silently creating a duplicate.
- **FR-015**: The user MUST be able to archive an active bookmark, view archived bookmarks separately, and restore an archived bookmark without losing its details.
- **FR-016**: The user MUST be able to permanently delete an active or archived bookmark only after an explicit confirmation step.
- **FR-017**: The system MUST provide distinct, actionable empty states for an empty library, an empty archive, and search or filter criteria with no matches.
- **FR-018**: Search terms, selected filters, and sort order MUST remain in effect while the user opens and closes bookmark details during the same visit.
- **FR-019**: The primary save, search, filter, edit, archive, restore, and delete actions MUST be operable on common desktop and mobile screen sizes.
- **FR-020**: The primary workflows MUST be usable with keyboard-only navigation and MUST expose meaningful names and status information to assistive technology.

### Key Entities

- **Bookmark**: A saved web destination. It has a web address, display title, optional description, zero or more tags, favorite state, archive state, creation date, and last-updated date. Its title and description may originate from the destination page or from the user, but remain user-editable.
- **Tag**: A user-created label used to group and filter bookmarks. A tag may belong to many bookmarks, and a bookmark may have multiple tags.
- **Library View State**: The user's current search term, tag and favorite filters, active-versus-archived view, and sort choice during a visit.

### Scope Boundaries

In scope for this feature:

- A personal bookmark library with save, browse, open, search, filter, sort, edit, favorite, archive, restore, and delete capabilities.
- Automatic retrieval of a destination page's published title and short description, with editable values and a non-blocking fallback when details are unavailable.
- Responsive use on desktop and mobile web screens.

Out of scope for this feature:

- Shared collections, teams, comments, public profiles, or other collaboration features.
- Browser extensions, automatic browser-history capture, and synchronization with a browser's native bookmarks.
- Bulk import or export, offline access, generated content summaries beyond the destination's published description, broken-link monitoring, and captured page copies.
- Nested folders or tag hierarchies; organization uses flat tags for the initial release.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of first-time users can paste a valid web address, save a recognizable bookmark without typing a title, and reopen it without assistance in under one minute.
- **SC-002**: A user with 1,000 saved bookmarks can search, filter, or change the sort order and see the resulting list within one second in at least 95% of attempts under normal operating conditions.
- **SC-003**: At least 90% of users can find a known bookmark within 30 seconds when they remember any part of its title, web address, description, or tag.
- **SC-004**: In acceptance testing, 100% of canceled deletions preserve the bookmark and 100% of confirmed deletions remove it from active and archived views.
- **SC-005**: All primary workflows can be completed at viewport widths from 320 pixels through standard desktop sizes without horizontal page scrolling.
- **SC-006**: All primary workflows can be completed using only a keyboard, with a visible current focus and understandable control names.
- **SC-007**: At least 90% of representative users rate saving, finding, and maintaining bookmarks as easy or very easy during usability testing.
- **SC-008**: For at least 95% of tested, publicly accessible pages that publish a usable title and description, users see those details filled in within five seconds of entering the address under normal operating conditions.
- **SC-009**: For 100% of tested unreachable, slow, restricted, or metadata-free destinations, users can still save a bookmark without supplying a title manually, and no retrieval attempt prevents them from choosing to save immediately.

## Assumptions

- The initial release serves one person's private library. Account creation, sign-in, cross-account separation, and sharing are not included in this feature.
- Users generally have an internet connection when using the app; previously saved metadata remains manageable even if a destination website is temporarily unavailable.
- The app stores bookmark metadata entered by the user or retrieved from the destination, but does not copy or preserve destination-page content.
- Tags are optional, reusable, flat labels. Tag names are compared without regard to letter case to avoid accidental duplicates.
- Newest-created is the default sort order, and the active library is the default view.
- Duplicate detection compares normalized web addresses so superficial differences such as an omitted scheme do not silently produce duplicate entries.
- Automatic retrieval is limited to basic details the destination publishes for identification: its page title and short description. The app does not generate summaries from page content.
- Saving never depends on successfully retrieving page details. If retrieval is unavailable, the web address is an acceptable fallback title and the description may remain blank.
