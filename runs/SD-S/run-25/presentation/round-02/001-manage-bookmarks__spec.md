# Feature Specification: Personal Bookmark Manager

**Feature Branch**: `not created (no branch hook configured)`

**Created**: 2026-09-26

**Status**: Draft — awaiting client approval

**Input**: User description: "I want to build an app to save and manage bookmarks," amended to include automatic page-title and description retrieval plus a read-later workflow.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Quickly save and revisit bookmarks (Priority: P1)

As a user, I can paste a web address and have its page title and description filled in automatically before saving, so that capturing useful resources is quick while I retain control over their details.

**Why this priority**: Saving and reopening links is the core value of a bookmark manager; without it, the product is not useful.

**Independent Test**: Paste a publicly accessible web address that supplies a title and description, confirm those details are filled in and editable, save the bookmark, then return in a later session and open the saved destination. Repeat with a page whose information cannot be retrieved and confirm that manual entry remains possible.

**Acceptance Scenarios**:

1. **Given** the user enters a valid, publicly accessible web address whose page supplies a title and description, **When** the address is accepted, **Then** the title and description are automatically filled in for review before saving.
2. **Given** automatically retrieved information is displayed, **When** the user changes the title or description, **Then** the user's changes are retained and saved instead of the retrieved values.
3. **Given** page information cannot be retrieved or is incomplete, **When** retrieval finishes, **Then** the user sees a non-blocking explanation and can supply any required information manually.
4. **Given** the library contains no bookmarks, **When** the user saves a valid web address with a populated or manually entered title, **Then** the new bookmark appears in the library with its title, web address, and saved date.
5. **Given** a bookmark has been saved, **When** the user returns in a later session, **Then** the bookmark is still present.
6. **Given** a saved bookmark is visible, **When** the user chooses to open it, **Then** the saved destination opens without losing the library view.
7. **Given** the user enters an invalid or unsupported web address, **When** they try to save it, **Then** the bookmark is not saved and the user sees a clear explanation of how to correct it.

---

### User Story 2 - Manage a read-later queue (Priority: P2)

As a user, I can mark selected bookmarks as To Read, see all pending reading in one dedicated view, and mark items as Read so that I can track what I still intend to revisit.

**Why this priority**: Returning to unfinished material is a primary reason to save bookmarks, and an explicit queue turns a passive library into an actionable reading list.

**Independent Test**: Mark several bookmarks as To Read, confirm they appear in the dedicated Read Later view, mark one as Read, and verify that it leaves the pending view while remaining in the full library with its completed status.

**Acceptance Scenarios**:

1. **Given** the user is saving, editing, or viewing a bookmark, **When** they mark it as To Read, **Then** its reading status is saved and it appears in the Read Later view.
2. **Given** bookmarks have different reading states, **When** the user opens the Read Later view, **Then** only bookmarks currently marked To Read are shown.
3. **Given** a bookmark is shown in the Read Later view, **When** the user marks it as Read, **Then** it leaves that view but remains in the full library with a Read status.
4. **Given** a bookmark is marked Read or has no reading status, **When** the user marks it To Read, **Then** it returns to the Read Later view.
5. **Given** search, tag filters, or sorting are used in the Read Later view, **When** their criteria change, **Then** they operate only on the bookmarks currently marked To Read.

---

### User Story 3 - Find and organize bookmarks (Priority: P3)

As a user with a growing library, I can search, tag, filter, and sort bookmarks so that I can quickly find the resource I need.

**Why this priority**: A library becomes difficult to use as it grows unless bookmarks can be organized and retrieved efficiently.

**Independent Test**: Create bookmarks with different titles, web addresses, descriptions, tags, and saved dates; verify that search, tag filtering, and each sort option return the expected ordered set.

**Acceptance Scenarios**:

1. **Given** bookmarks with different titles, web addresses, descriptions, and tags, **When** the user enters a search term, **Then** only bookmarks matching that term in at least one of those fields are shown.
2. **Given** bookmarks assigned to different tags, **When** the user selects one or more tags, **Then** only bookmarks containing every selected tag are shown.
3. **Given** multiple bookmarks, **When** the user selects a supported sort order, **Then** the visible bookmarks are ordered by newest saved, oldest saved, or title.
4. **Given** active search, filter, or sort settings, **When** no bookmarks match, **Then** the user sees a clear empty result with a way to clear the active criteria.

---

### User Story 4 - Maintain bookmark details (Priority: P4)

As a user, I can update or remove saved bookmarks so that my library remains accurate and relevant.

**Why this priority**: Editing and removal are necessary for long-term maintenance but are secondary to saving and finding bookmarks.

**Independent Test**: Edit every editable field on a saved bookmark, confirm the changes persist, then delete the bookmark and confirm it no longer appears.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user changes its title, web address, description, or tags with valid values, **Then** the updated details are shown and remain after a later session.
2. **Given** an existing bookmark, **When** the user chooses to delete it, **Then** the user must confirm before deletion and can cancel without losing the bookmark.
3. **Given** the user confirms deletion, **When** deletion completes, **Then** the bookmark no longer appears in the library or its search and filter results.

### Edge Cases

- A web address that omits a scheme, contains only whitespace, or uses an unsupported scheme is rejected with corrective guidance; secure and standard web addresses are supported.
- Leading and trailing whitespace is removed from user-entered titles, web addresses, descriptions, and tags before validation.
- A title that becomes empty after trimming is rejected.
- If page information cannot be retrieved because a destination is unavailable, protected, slow to respond, or does not provide the information, saving remains possible after the user supplies a title manually.
- Automatically retrieved information never overwrites title or description text that the user has changed while retrieval is in progress.
- When a web address is already saved, the user is warned and can either open the existing bookmark or intentionally save another entry.
- Tag comparison is case-insensitive, so visually equivalent tags such as `Design` and `design` do not create separate filters.
- Empty tags are discarded, duplicate tags on one bookmark are consolidated, and tag names longer than 40 characters are rejected.
- Search is case-insensitive and updates the visible result set without changing or deleting saved data.
- Marking a bookmark Read while it is the last item in the Read Later view produces a purposeful empty state and does not delete the bookmark from the full library.
- If saved bookmarks cannot be loaded or a change cannot be persisted, the user sees an error and existing bookmark data is not silently discarded.
- Very long titles and descriptions remain readable without obscuring actions or breaking the library layout.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow the user to save a bookmark with a valid web address, a required title supplied automatically or manually, an optional description, zero or more tags, and an optional reading status.
- **FR-002**: The system MUST support standard web addresses using `http` or `https` and MUST reject empty, malformed, or unsupported addresses before saving.
- **FR-003**: The system MUST preserve saved bookmarks and their details across user sessions on the same installation.
- **FR-004**: The system MUST display the bookmark library with each bookmark's title, destination, tags, and saved date.
- **FR-005**: The user MUST be able to open a saved destination while retaining access to the bookmark library.
- **FR-006**: The user MUST be able to edit a bookmark's title, web address, description, and tags, subject to the same validation rules used when saving.
- **FR-007**: The user MUST be able to request deletion of a bookmark, cancel the request, or confirm permanent deletion.
- **FR-008**: The system MUST search bookmarks case-insensitively across title, web address, description, and tags.
- **FR-009**: The system MUST let the user filter the library by one or more tags, with a bookmark required to contain every selected tag.
- **FR-010**: The system MUST let the user sort visible bookmarks by newest saved, oldest saved, or title in ascending alphabetical order.
- **FR-011**: The system MUST provide distinct empty states for a library with no bookmarks and for search or filter criteria with no matches.
- **FR-012**: The system MUST warn the user when the submitted web address already exists in the library and MUST allow the user to open the existing bookmark or intentionally continue saving a duplicate.
- **FR-013**: The system MUST normalize tags for case-insensitive comparison, remove duplicate tags from a bookmark, and enforce a maximum tag length of 40 characters.
- **FR-014**: The system MUST show clear, actionable feedback for validation failures and unsuccessful save, update, load, or delete operations.
- **FR-015**: The system MUST make all core bookmark actions usable with keyboard-only navigation and expose understandable labels for interactive controls.
- **FR-016**: The system MUST preserve the user's active search, tag filters, and sort choice while the app remains open, including after saving or editing a bookmark.
- **FR-017**: After the user provides a valid web address, the system MUST automatically attempt to retrieve the destination page's title and short description.
- **FR-018**: The system MUST fill empty title and description fields with successfully retrieved information while keeping both fields editable and preserving any changes made by the user.
- **FR-019**: The system MUST visibly communicate when page information is being retrieved, when retrieval succeeds, and when it fails or returns incomplete information; failure MUST NOT prevent saving once the user provides a valid address and title.
- **FR-020**: The user MUST be able to set a bookmark's reading state to Untracked, To Read, or Read while creating or editing it and from the bookmark's available library actions.
- **FR-021**: The system MUST provide a dedicated Read Later view containing only bookmarks whose current reading state is To Read.
- **FR-022**: The user MUST be able to mark a To Read bookmark as Read directly from the Read Later view; doing so MUST remove it from that view without removing it from the full library.
- **FR-023**: The system MUST allow a Read or Untracked bookmark to be marked To Read again.
- **FR-024**: The system MUST preserve each bookmark's reading state across user sessions.
- **FR-025**: Search, tag filtering, and sorting MUST remain available in the Read Later view and MUST operate only on bookmarks currently marked To Read.

### Key Entities

- **Bookmark**: A saved web resource with a unique internal identity, required title, required web address, optional description, zero or more tags, a reading state of Untracked, To Read, or Read, saved date, and last-updated date. Its title and description may originate from the destination page or from the user.
- **Tag**: A user-created organizational label associated with one or more bookmarks and compared without regard to letter case.
- **Library View State**: The user's current library context (full library or Read Later), search term, selected tag filters, and sort order; this affects presentation only and does not modify bookmarks.

### Scope Boundaries

**Included in this release**:

- A private bookmark library for one user on one installation.
- Creating, viewing, opening, editing, and deleting bookmarks.
- Automatic retrieval of page titles and short descriptions, with editable values and a manual fallback.
- A Read Later view and persistent Untracked, To Read, and Read states.
- Search, tag-based organization and filtering, duplicate warnings, and basic sorting.
- A responsive experience suitable for desktop and mobile-sized screens.

**Excluded from this release**:

- User accounts, shared libraries, multiple roles, and collaboration.
- Synchronization between installations or devices.
- Browser extensions, link health checking, and offline copies of bookmarked pages.
- Import from or export to browsers, files, or third-party bookmark services.
- Folders, nested collections, favorites, archiving, and bulk actions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of first-time users can save and reopen their first bookmark without assistance in under 45 seconds when page information is available.
- **SC-002**: A user can find a known bookmark in a library of 1,000 entries using search or tags in under 10 seconds.
- **SC-003**: Search, filtering, and sorting visibly update within 1 second for a library of 1,000 bookmarks under normal operating conditions.
- **SC-004**: In acceptance testing, 100% of valid create, edit, and delete actions remain reflected after closing and reopening the app.
- **SC-005**: In acceptance testing, 100% of invalid or incomplete bookmark submissions are blocked with a specific corrective message and without corrupting existing data.
- **SC-006**: All core flows—save, search, filter, sort, edit, open, delete, add to Read Later, and mark Read—can be completed using only a keyboard.
- **SC-007**: For at least 95% of publicly accessible acceptance-test pages that provide a title and short description, both fields are populated for review within 5 seconds of entering the address.
- **SC-008**: At least 90% of first-time users can add a bookmark to Read Later, locate it in the dedicated view, and mark it Read without assistance in under 45 seconds.
- **SC-009**: In acceptance testing, 100% of reading-state changes remain reflected after closing and reopening the app, and marking an item Read never removes it from the full library.

## Assumptions

- The first release is a personal, single-user product and does not require authentication or authorization.
- The user's bookmark collection is private to the installation where it is created; cross-device synchronization is not expected.
- The destination page is queried only to obtain a page title and short description; images, full page content, and offline copies are not collected.
- Automatic page information retrieval is best-effort because some destinations may be unavailable, protected, slow to respond, or may not expose useful information; the user can always review, replace, or manually supply the title and description.
- New bookmarks begin with an Untracked reading state unless the user explicitly marks them To Read; marking a To Read bookmark as complete changes its state to Read rather than deleting or archiving it.
- The product is designed for libraries of up to 1,000 bookmarks in the first release.
- Deletion is permanent after explicit confirmation; recovery and trash management are outside the initial scope.
- Bookmarks may intentionally share the same web address after the user acknowledges the duplicate warning.
- The user has an active connection when opening a bookmark, but previously saved bookmark details remain manageable when a destination is unavailable.
