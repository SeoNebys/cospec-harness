# Feature Specification: Bookmark Manager

**Feature Branch**: `001-manage-bookmarks`

**Created**: 2026-09-27

**Updated**: 2026-09-27

**Status**: Approved on 2026-09-27

**Input**: User description: "I want to build an app to save and manage bookmarks." Refinement: saving must require only a web address and automatically retrieve the page title, plus its description and icon when available.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save and Revisit Bookmarks (Priority: P1)

As a user, I can paste a web address and save it without typing a title; the app fills in the page title and available descriptive details so that saving useful content is quick.

**Why this priority**: Saving and revisiting links is the core value of the product; without it, the app is not a bookmark manager.

**Independent Test**: Submit only the address of a publicly accessible page that provides standard page details, verify that the resulting bookmark displays its retrieved title and any available description and icon, then reopen the page from the library.

**Acceptance Scenarios**:

1. **Given** an authenticated user viewing the save form, **When** they submit only a valid address for a publicly accessible page, **Then** the bookmark is saved and its page title is filled in automatically.
2. **Given** a bookmark in the user's library, **When** the user selects it, **Then** the saved web address opens.
3. **Given** a submitted address that omits a scheme but is otherwise recognizable as a web address, **When** the user saves it, **Then** the app normalizes it to a secure web address and shows the normalized value for confirmation.
4. **Given** an invalid or unsupported address, **When** the user attempts to save it, **Then** the bookmark is not created and the user receives a clear correction message.
5. **Given** a valid page that publishes a description or icon, **When** its bookmark is saved, **Then** the available description and icon are added automatically.
6. **Given** a valid address whose page is unavailable or does not provide a usable title, **When** the user saves it, **Then** the bookmark is still saved with a readable title derived from its address and the user is told that page details could not be retrieved.

---

### User Story 2 - Find and Organize Bookmarks (Priority: P2)

As a user, I can assign tags, mark favorites, search my library, and filter it so that I can quickly recover a link as the collection grows.

**Why this priority**: A growing unorganized list becomes difficult to use; retrieval and lightweight organization preserve the app's value over time.

**Independent Test**: Create several bookmarks with distinct titles, addresses, notes, tags, and favorite states, then confirm that search and each filter return only the matching bookmarks.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user adds one or more tags, **Then** those tags are displayed on the bookmark and are available as library filters.
2. **Given** bookmarks with different titles, addresses, notes, and tags, **When** the user searches with a matching word or phrase, **Then** the library shows bookmarks matching any of those fields.
3. **Given** a library containing tagged and favorited bookmarks, **When** the user applies a tag or favorites filter, **Then** only matching bookmarks are shown and the active filter is visible.
4. **Given** an active search or filter with no matches, **When** results are evaluated, **Then** the user sees an empty-result message and can clear the search or filters.

---

### User Story 3 - Maintain the Library (Priority: P3)

As a user, I can update bookmark details, archive bookmarks I do not currently need, restore archived bookmarks, and permanently delete unwanted bookmarks so that my library remains accurate and useful.

**Why this priority**: Maintenance prevents stale information and clutter, but the product remains useful before these controls are added.

**Independent Test**: Edit a bookmark, archive and restore it, then delete it with confirmation; verify the expected state after every action.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user changes its automatically supplied title, address, notes, or tags with valid values, **Then** the updated values are retained and shown in the library.
2. **Given** an active bookmark, **When** the user archives it, **Then** it leaves the default library view and appears in an archived view.
3. **Given** an archived bookmark, **When** the user restores it, **Then** it returns to the default library view with its details intact.
4. **Given** an existing bookmark, **When** the user chooses permanent deletion, **Then** the app asks for confirmation before deleting it.
5. **Given** a deletion confirmation, **When** the user confirms, **Then** the bookmark is removed from all library views and is no longer returned by search.

### Edge Cases

- Saving the same normalized web address more than once warns the user and lets them either keep the existing bookmark or explicitly save another copy.
- Pages that are unavailable, redirect repeatedly, respond too slowly, or block retrieval do not prevent a valid address from being bookmarked; the app uses a readable title derived from the address and explains that page details were unavailable.
- A missing or unusable page title falls back to a readable title derived from the address; a missing description or icon leaves that optional detail absent.
- An icon that cannot be displayed does not prevent the title, address, or other bookmark details from appearing.
- A title edited by the user is not overwritten by later automatic page-detail retrieval.
- Titles and notes that contain leading or trailing whitespace are trimmed; meaningful internal whitespace is preserved.
- Tags are compared without regard to capitalization so variants such as `Design` and `design` do not create separate filters.
- Search terms containing punctuation or mixed capitalization return consistent, case-insensitive matches.
- Very long titles, notes, addresses, or tag lists are rejected at documented limits with a clear message and without losing the user's entered content.
- If a save or edit operation fails, the app reports that the change was not saved and retains the entered values so the user can retry.
- A newly registered user and a user whose filters have no matches receive distinct empty states with an appropriate next action.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST require a user account and authentication before a personal bookmark library can be viewed or changed.
- **FR-002**: The system MUST keep each user's bookmarks private from other users.
- **FR-003**: Users MUST be able to create a bookmark by submitting only a valid HTTP or HTTPS web address; manually entering a title MUST NOT be required.
- **FR-004**: The system MUST normalize recognizable web addresses that omit a scheme to HTTPS and MUST reject addresses using unsupported schemes.
- **FR-005**: When a bookmark address is submitted, the system MUST attempt to retrieve and use the page's published title automatically.
- **FR-006**: The system MUST also retrieve and display the page's published description and representative icon when they are available and usable.
- **FR-007**: If the page is unavailable or has no usable title, the system MUST still save the bookmark with a readable fallback title derived from its address and MUST disclose that page details could not be retrieved.
- **FR-008**: Automatic page-detail retrieval MUST access only publicly reachable web pages and MUST NOT expose or access private or internal resources.
- **FR-009**: Users MUST be able to edit an automatically supplied or fallback title, and a user-edited title MUST take precedence over subsequently retrieved page details.
- **FR-010**: Users MUST be able to optionally record notes and assign zero or more tags when creating or editing a bookmark.
- **FR-011**: The system MUST record and display when each bookmark was created and last updated.
- **FR-012**: Users MUST be able to open a saved bookmark at its stored web address.
- **FR-013**: The system MUST warn users when they attempt to save a web address that already exists in their own library, while allowing an explicit decision to save a duplicate.
- **FR-014**: Users MUST be able to view their active bookmarks ordered with the most recently created first by default.
- **FR-015**: Users MUST be able to search active bookmarks by title, web address, retrieved description, notes, or tags using case-insensitive text matching.
- **FR-016**: Users MUST be able to filter active bookmarks by one or more tags and by favorite status.
- **FR-017**: The system MUST clearly display active search terms and filters and MUST provide a single action to clear them.
- **FR-018**: Users MUST be able to mark and unmark a bookmark as a favorite.
- **FR-019**: Users MUST be able to edit a bookmark's title, web address, notes, and tags, subject to the same validation used when creating it.
- **FR-020**: Users MUST be able to archive an active bookmark and view archived bookmarks separately from the default library.
- **FR-021**: Users MUST be able to restore an archived bookmark without losing its details, tags, or favorite status.
- **FR-022**: Users MUST be able to permanently delete a bookmark only after an explicit confirmation step.
- **FR-023**: The system MUST present distinct, actionable messages for an empty library, no search or filter matches, invalid input, unavailable page details, and an unsuccessful save or edit.
- **FR-024**: The system MUST preserve a user's entered bookmark details when validation or a save attempt fails, except when preserving a field would create a security risk.
- **FR-025**: The system MUST support at least 10,000 bookmarks and 500 distinct tags per user without removing or combining user data.

### Key Entities

- **User**: The owner of a private bookmark library; has an identity used to authenticate and separate their data from other users.
- **Bookmark**: A saved web resource owned by one user; includes a web address, automatically supplied or user-edited title, optional retrieved description and icon, optional user notes, favorite state, lifecycle state (active or archived), creation time, update time, and associated tags.
- **Tag**: A user-owned organizational label that can be associated with multiple bookmarks; has a display name that is unique for that user when capitalization is ignored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of first-time users can save and reopen their first valid bookmark by entering only its address, without assistance, in under 45 seconds.
- **SC-002**: For at least 95% of publicly accessible test pages that publish a standard title, the correct page title appears on the bookmark within 5 seconds of submission.
- **SC-003**: Users with a library of 10,000 bookmarks see search or filter results within 2 seconds for at least 95% of attempts under normal operating conditions.
- **SC-004**: At least 95% of users can locate a known bookmark by search or filtering within 30 seconds on their first attempt.
- **SC-005**: 100% of tested attempts to access another user's bookmarks are denied.
- **SC-006**: In acceptance testing, 100% of create, edit, archive, restore, favorite, and delete actions either produce the requested persisted result or clearly report that no change was saved.
- **SC-007**: At least 90% of usability-test participants rate the save-and-find experience as easy or very easy.

## Assumptions

- The first release is a responsive web experience for individual users with separate accounts and private libraries.
- Account registration, sign-in, sign-out, and account recovery use standard secure behavior; advanced organization-managed identity and roles are outside this feature.
- The app stores references to web pages, not offline copies of their content, and does not guarantee that external pages remain available.
- Automatic page details are limited to the title, description, and representative icon published by a publicly accessible page; richer previews and stored page content remain outside the first release.
- Page details are retrieved when a bookmark is first saved. Ongoing automatic refresh of page details and broken-link monitoring are outside the first release.
- Search uses straightforward text matching rather than semantic or full-page-content search.
- Tag filters match all selected tags when more than one tag is selected.
- Import, export, sharing, collaboration, public collections, browser extensions, bulk editing, broken-link checking, and third-party bookmark-service synchronization are outside the first release.
- Exact field-length limits will be defined during planning, must accommodate ordinary web addresses and notes, and must be communicated before submission.
