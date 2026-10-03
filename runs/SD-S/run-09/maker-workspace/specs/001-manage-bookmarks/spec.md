# Feature Specification: Personal Bookmark Manager

**Feature Branch**: `001-manage-bookmarks`

**Created**: 2026-09-18

**Status**: Approved on 2026-09-18

**Input**: User description: "Build an app to save and manage bookmarks. Saving should require only a web address; the app automatically captures the page title and site icon, while allowing the title to be edited."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save and Revisit Bookmarks (Priority: P1)

As a user, I can paste a web address and have the page title and site icon filled in automatically, then later open it from my personal bookmark library, so that saving useful pages is quick and effortless.

**Why this priority**: Saving and reopening links is the core value of a bookmark manager and forms a useful minimum product by itself.

**Independent Test**: Sign in, paste a valid address for a publicly reachable page, and save without typing a title. Verify that the captured title and site icon appear, that the title can be changed, and that the bookmark remains available and opens the intended address after a new session.

**Acceptance Scenarios**:

1. **Given** a signed-in user and a valid address for a publicly reachable page with an identifiable title and site icon, **When** the user enters the address, **Then** the app fills in the page title and site icon without requiring the user to type a title.
2. **Given** an automatically filled title, **When** the user changes it before or after saving, **Then** the user's title is retained instead of being overwritten by later automatic capture.
3. **Given** a valid address whose title or site icon cannot be retrieved, **When** the user saves it, **Then** the bookmark is still created with a readable fallback title and a generic icon, and the title remains editable.
4. **Given** a saved bookmark, **When** the user selects it, **Then** the destination opens without removing or changing the saved bookmark.
5. **Given** a bookmark saved in an earlier session, **When** the user signs in again, **Then** the bookmark, its title, and its site icon remain in the library.
6. **Given** an invalid or unsupported address, **When** the user attempts to save it, **Then** the bookmark is not created and the user receives a clear correction message.

---

### User Story 2 - Find and Organize Bookmarks (Priority: P2)

As a user, I can search, filter, sort, tag, and place bookmarks into folders so that I can quickly find a saved page as my library grows.

**Why this priority**: A saved library becomes less useful without reliable retrieval and lightweight organization.

**Independent Test**: Create bookmarks with different titles, addresses, folders, and tags, then verify that searches, filters, and sorting return the expected subset and order.

**Acceptance Scenarios**:

1. **Given** bookmarks with distinct titles, addresses, and tags, **When** the user searches for matching text, **Then** only bookmarks matching at least one of those fields are shown.
2. **Given** bookmarks organized into folders or tags, **When** the user chooses a folder or tag filter, **Then** only bookmarks assigned to that selection are shown.
3. **Given** multiple bookmarks, **When** the user sorts by newest, oldest, or title, **Then** the visible results appear in the selected order.
4. **Given** a bookmark and an existing or new tag or folder, **When** the user assigns the organization, **Then** it is retained and available for subsequent filtering.
5. **Given** filters with no matching bookmarks, **When** results are displayed, **Then** the user sees a useful empty state and a way to clear the filters.

---

### User Story 3 - Maintain the Library (Priority: P3)

As a user, I can edit, favorite, and remove bookmarks so that the library stays accurate and highlights important links.

**Why this priority**: Maintenance improves the long-term quality of the library after the save-and-find flows are usable.

**Independent Test**: Edit a bookmark's details, toggle its favorite status, delete it with confirmation, and verify each change persists after returning to the library.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user changes its title, address, notes, folder, or tags with valid values, **Then** the updated values replace the previous values.
2. **Given** a saved bookmark, **When** the user marks or unmarks it as a favorite, **Then** the new favorite state is retained and can be filtered.
3. **Given** a saved bookmark, **When** the user requests deletion, **Then** the app asks for confirmation before permanently removing it.
4. **Given** a deletion confirmation, **When** the user confirms, **Then** the bookmark no longer appears in search, filters, folders, tags, or the full library.

### Edge Cases

- If a user saves an address already in their library, the app warns that it is a duplicate and lets the user either view the existing bookmark or save another copy.
- If a page redirects to another public address, the app uses the destination page's title and site icon while retaining the address the user chose to save.
- If a page has no usable title, the app derives a readable fallback title from the page's address.
- If a site icon is missing, unreadable, or cannot be retrieved, the app displays a consistent generic icon rather than a broken image.
- If automatic metadata retrieval is slow or fails, the user can still save the bookmark and edit its fallback title; the save flow does not remain blocked indefinitely.
- The app does not retrieve metadata from local, private-network, or otherwise non-public destinations; those addresses may be saved with fallback metadata when they otherwise use a supported web-address format.
- Leading and trailing spaces in entered titles, addresses, tags, folder names, and notes are ignored when validating the entry.
- Search and filtering must remain understandable when a folder, tag, or bookmark was renamed or removed.
- Removing a folder or tag does not delete the bookmarks that used it; those bookmarks remain in the library without that organization.
- A bookmark destination may later become unavailable; the saved bookmark remains editable or removable because destination availability is not guaranteed.
- Long titles, addresses, and notes must not obscure the controls needed to open or manage a bookmark.
- If saving or editing fails, the user's current input remains visible and the app explains that the change was not saved.
- Each user can access only their own bookmarks, folders, and tags, including through search and direct navigation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST require a user to sign in before viewing or changing a bookmark library.
- **FR-002**: The system MUST keep each user's bookmarks, folders, and tags private from every other user.
- **FR-003**: Users MUST be able to create a bookmark by supplying only a valid web address; manual title entry MUST NOT be required.
- **FR-004**: For an eligible publicly reachable page, the system MUST attempt to capture its page title and site icon automatically when the address is entered.
- **FR-005**: When a page title cannot be captured, the system MUST create a readable, non-empty fallback title derived from the address rather than preventing the bookmark from being saved.
- **FR-006**: When a site icon cannot be captured, the system MUST display a generic icon rather than a missing or broken image.
- **FR-007**: Users MUST be able to edit an automatically captured or fallback title before and after saving, and the system MUST retain the user's edited title unless the user explicitly replaces it.
- **FR-008**: The system MUST NOT attempt metadata retrieval from local, private-network, or otherwise non-public destinations.
- **FR-009**: Users MUST be able to optionally add notes, one folder, and multiple tags to a bookmark.
- **FR-010**: The system MUST record and display when each bookmark was created and last updated.
- **FR-011**: Users MUST be able to open a saved bookmark's destination while retaining the bookmark in their library.
- **FR-012**: The system MUST preserve saved bookmarks, captured site icons, titles, and organization across user sessions.
- **FR-013**: The system MUST reject addresses that do not use the `http` or `https` scheme and explain how the user can correct the value.
- **FR-014**: When an address already exists in the same user's library, the system MUST warn the user and offer choices to view the existing bookmark or intentionally save another copy.
- **FR-015**: Users MUST be able to search their library by partial, case-insensitive text found in bookmark titles, addresses, or tags.
- **FR-016**: Users MUST be able to filter bookmarks by folder, tag, and favorite status, including combining these filters.
- **FR-017**: Users MUST be able to sort the current bookmark results by newest created, oldest created, or title.
- **FR-018**: Users MUST be able to create, rename, and remove folders and tags.
- **FR-019**: Removing a folder or tag MUST retain its bookmarks and remove only that folder or tag association.
- **FR-020**: Users MUST be able to edit a bookmark's title, address, notes, folder, and tags, subject to the same validation used when saving it.
- **FR-021**: Users MUST be able to mark and unmark a bookmark as a favorite.
- **FR-022**: Users MUST be able to delete a bookmark only after confirming the deletion.
- **FR-023**: The system MUST provide clear empty states for a new library and for searches or filters with no matches.
- **FR-024**: If a create or edit operation fails, the system MUST preserve the user's entered values, identify that the change was not saved, and allow another attempt.
- **FR-025**: The system MUST support a personal library containing at least 10,000 bookmarks without removing or hiding valid saved items.

### Key Entities

- **User**: A person with a private bookmark library and an authenticated session.
- **Bookmark**: A saved web resource belonging to one user; includes address, captured or user-edited title, captured or generic site icon, optional notes, favorite state, creation date, update date, an optional folder, and zero or more tags.
- **Folder**: A user-owned named grouping that may contain many bookmarks; a bookmark may belong to at most one folder.
- **Tag**: A user-owned reusable label that may be associated with many bookmarks; a bookmark may have multiple tags.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of first-time users can save and reopen a bookmark by entering only its address, without assistance, on their first attempt.
- **SC-002**: Users can save a bookmark by pasting its address in under 15 seconds without typing a title.
- **SC-003**: For at least 95% of tested public pages that expose a usable title and site icon, the correct title and icon appear automatically within 5 seconds of entering the address.
- **SC-004**: In acceptance testing, 100% of valid bookmarks whose metadata cannot be retrieved can still be saved with a readable fallback title and usable generic icon.
- **SC-005**: Users can locate and open a known bookmark from a library of 10,000 items in under 15 seconds using search or organization controls.
- **SC-006**: For at least 95% of user actions in a 10,000-bookmark library, visible results or confirmation appear within 2 seconds.
- **SC-007**: In acceptance testing, 100% of attempts to access another user's bookmark data are denied.
- **SC-008**: In acceptance testing, all successful create, edit, organize, favorite, and delete changes remain correct after signing out and returning in a new session.
- **SC-009**: At least 90% of usability-test participants rate saving, finding, and maintaining bookmarks as easy or very easy.

## Assumptions

- The first release is a responsive personal web application for individual users rather than shared teams or public collections.
- Standard account registration, sign-in, sign-out, and account recovery are supporting capabilities; advanced identity administration is outside this feature.
- A bookmark requires only an address from the user. The app attempts to retrieve its page title and site icon automatically; automatic preview images, descriptions, and page-content archiving remain outside the first release.
- Automatic metadata capture depends on the destination being publicly reachable and exposing usable metadata. Retrieval failure does not prevent saving.
- A bookmark can belong to at most one folder and can have multiple tags.
- Search covers the user's saved data only; the app does not search the public web or the content inside linked pages.
- Bulk import/export, browser extensions, offline use, collaboration, public sharing, broken-link monitoring, and automatic content archiving are outside the first release.
- Deletion is permanent after confirmation; recycle-bin recovery and version history are outside the first release.
- Users ordinarily have network access, but failed changes are reported without discarding their current input.
- No project-specific constitution has been established beyond the Spec-Driven Development workflow supplied for this workspace.
