# Feature Specification: Bookmark Manager

**Feature Branch**: `N/A (no branch hook configured)`

**Created**: 2026-09-25

**Status**: Draft — awaiting client approval

**Input**: User description: "I want to build an app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a Bookmark (Priority: P1)

As a user, I can save a web address with useful details so I can return to it later.

**Why this priority**: Capturing a bookmark is the core value of the product; without it, no bookmark library exists to manage.

**Independent Test**: Save a valid web address, then reopen the bookmark library and verify that the saved item and its details are present.

**Acceptance Scenarios**:

1. **Given** the user is viewing their bookmark library, **When** they enter a valid web address and save it, **Then** a bookmark is created and displayed with its web address, title, and creation date.
2. **Given** the user is creating a bookmark, **When** they provide a custom title, description, tags, or collection, **Then** those details are stored with the bookmark.
3. **Given** the submitted web address is missing a scheme but is otherwise recognizable, **When** the user saves it, **Then** the app normalizes it into a usable web address and shows the normalized value.
4. **Given** the submitted value is not a usable web address, **When** the user tries to save it, **Then** the app explains the problem and does not create a bookmark.
5. **Given** a bookmark with the same normalized web address already exists, **When** the user attempts to save it again, **Then** the app identifies the existing bookmark and lets the user open or update it instead of silently creating a duplicate.

---

### User Story 2 - Find and Open Bookmarks (Priority: P2)

As a user, I can browse, search, filter, and sort my saved bookmarks so I can quickly find and open the resource I need.

**Why this priority**: Saved links are useful only when the user can retrieve them efficiently as the library grows.

**Independent Test**: Populate a library with bookmarks across several tags and collections, then verify that a bookmark can be found by text search and narrowed by filters.

**Acceptance Scenarios**:

1. **Given** the user has saved bookmarks, **When** they view the library, **Then** each result shows enough information to identify it, including title, web address, tags, collection, and save date when present.
2. **Given** matching bookmarks exist, **When** the user searches by words found in a title, web address, or description, **Then** only relevant matches are shown.
3. **Given** bookmarks have tags or collections, **When** the user applies one or more available filters, **Then** the displayed results satisfy all selected filters.
4. **Given** the library contains multiple bookmarks, **When** the user chooses a supported sort order, **Then** results are ordered by newest saved, oldest saved, or title.
5. **Given** a bookmark is visible, **When** the user chooses to open it, **Then** its saved web address opens without losing the user's place in the library.
6. **Given** no bookmarks match the current query or filters, **When** results are displayed, **Then** the app shows a clear empty state and offers a way to clear the active criteria.

---

### User Story 3 - Organize Bookmarks (Priority: P3)

As a user, I can use tags and collections to organize bookmarks in ways that make sense to me.

**Why this priority**: Lightweight organization makes a growing library manageable while remaining optional for users who only want to save links.

**Independent Test**: Create collections and tags, assign them to bookmarks, rename a collection or tag, and verify that the changes are reflected everywhere they are used.

**Acceptance Scenarios**:

1. **Given** a bookmark exists, **When** the user assigns zero or more tags and optionally one collection, **Then** the bookmark appears under those organizational labels.
2. **Given** the user creates or renames a tag or collection, **When** the change is saved, **Then** the updated label appears on every associated bookmark.
3. **Given** a tag or collection is in use, **When** the user requests its deletion, **Then** the app explains how many bookmarks are affected and requires confirmation before removing the label without deleting the bookmarks.
4. **Given** a tag or collection name differs from an existing one only by capitalization or surrounding spaces, **When** the user tries to create it, **Then** the app reuses the existing label instead of creating a visually duplicate label.

---

### User Story 4 - Maintain the Library (Priority: P4)

As a user, I can update or remove saved bookmarks so the library remains accurate and useful.

**Why this priority**: Maintenance prevents stale or unwanted entries from reducing the usefulness of the library.

**Independent Test**: Edit every user-managed field of a bookmark, verify the changes persist, then delete the bookmark and verify it no longer appears in searches or filters.

**Acceptance Scenarios**:

1. **Given** a bookmark exists, **When** the user edits its web address, title, description, tags, or collection with valid values, **Then** the updated details are saved and immediately reflected throughout the library.
2. **Given** a bookmark exists, **When** the user requests deletion, **Then** the app identifies the bookmark and requires confirmation before permanently removing it.
3. **Given** the user cancels a deletion, **When** they return to the library, **Then** the bookmark and all its details remain unchanged.

### Edge Cases

- Saving the same destination with superficial differences such as letter casing in the host, a missing scheme, or a trailing slash uses the normalized address for duplicate detection.
- Very long titles, descriptions, web addresses, tag names, or collection names are rejected at documented limits with a message that preserves the user's entered content for correction.
- Bookmarks containing accented characters, emoji, query strings, fragments, or internationalized web addresses remain identifiable and open the intended destination.
- Search ignores letter casing and safely handles punctuation or characters that have special meaning in query languages.
- Removing a tag or collection never removes its associated bookmarks.
- If a save, edit, or delete operation fails, the app reports that the change was not completed and avoids showing an unconfirmed result as saved.
- An empty library clearly explains how to add the first bookmark.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide each user with a private bookmark library that is not visible to other users.
- **FR-002**: Users MUST be able to create a bookmark from a valid HTTP or HTTPS web address.
- **FR-003**: The system MUST store a normalized web address, a title, and creation and last-updated dates for every bookmark.
- **FR-004**: Users MUST be able to optionally provide a description, zero or more tags, and one collection for a bookmark.
- **FR-005**: The system MUST normalize recognizable web addresses before saving them and MUST show the final normalized address to the user.
- **FR-006**: The system MUST reject values that cannot be interpreted as valid HTTP or HTTPS web addresses and MUST explain how to correct the error.
- **FR-007**: The system MUST prevent silent duplicate bookmarks within the same user's library by detecting an existing normalized web address and directing the user to that bookmark for opening or updating.
- **FR-008**: Users MUST be able to view their bookmarks as a browsable library with each item's identifying details.
- **FR-009**: Users MUST be able to open a saved bookmark while retaining their current library view.
- **FR-010**: Users MUST be able to search bookmarks by title, web address, and description using case-insensitive text matching.
- **FR-011**: Users MUST be able to filter bookmarks by tag and collection, including combining tag and collection filters.
- **FR-012**: Users MUST be able to sort bookmarks by newest saved, oldest saved, and title.
- **FR-013**: The system MUST clearly identify active search and filter criteria and MUST provide a single action to clear them.
- **FR-014**: Users MUST be able to create, rename, and delete tags and collections.
- **FR-015**: Tag and collection names MUST be unique per user after ignoring capitalization and surrounding spaces.
- **FR-016**: Before deleting a tag or collection, the system MUST show the number of affected bookmarks and require confirmation; deleting the label MUST NOT delete those bookmarks.
- **FR-017**: Users MUST be able to edit the web address, title, description, tags, and collection of an existing bookmark.
- **FR-018**: Users MUST be able to permanently delete a bookmark only after confirming an action that identifies the bookmark being deleted.
- **FR-019**: The system MUST preserve confirmed bookmark, tag, and collection changes across user sessions.
- **FR-020**: The system MUST present helpful empty states for both an empty library and a search or filter with no results.
- **FR-021**: The system MUST communicate whether create, edit, and delete operations succeeded or failed and MUST not present failed changes as confirmed.
- **FR-022**: User-entered titles and descriptions MUST support common international characters and emoji.
- **FR-023**: User-managed text MUST be limited to 200 characters for bookmark titles, 2,000 characters for descriptions, and 50 characters for tag and collection names, with clear validation before submission.

### Key Entities

- **User**: The owner of a private bookmark library; has access only to their own bookmarks, tags, and collections.
- **Bookmark**: A saved web resource owned by one user, with a normalized web address, title, optional description, optional tags, optional collection, creation date, and last-updated date.
- **Tag**: A reusable user-owned label that can be associated with many bookmarks; a bookmark can have many tags.
- **Collection**: A reusable user-owned grouping that can contain many bookmarks; a bookmark belongs to at most one collection.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of first-time users can save their first valid bookmark without assistance in under 60 seconds.
- **SC-002**: At least 95% of searches or filter changes show the resulting library state within 1 second for libraries containing up to 10,000 bookmarks.
- **SC-003**: At least 90% of users can locate and open a known bookmark from a 500-item library in under 30 seconds.
- **SC-004**: In acceptance testing, 100% of confirmed create, edit, and delete operations remain accurate after ending and starting a new session.
- **SC-005**: In acceptance testing, duplicate attempts covering all documented normalization cases result in no unintended duplicate bookmarks.
- **SC-006**: At least 90% of test participants complete the core flows—save, find, organize, edit, and delete—without instruction or critical error.
- **SC-007**: Every destructive action in acceptance testing identifies its impact and requires explicit confirmation before data is permanently removed.

## Assumptions

- The first release is a responsive web application for individual users rather than a shared or collaborative workspace.
- Users have an account and an authenticated session; account registration, sign-in, password recovery, and identity-provider choices are supporting capabilities outside this feature's scope.
- A bookmark has at most one collection but may have multiple tags; organization is optional.
- The first release supports manually adding bookmarks. Browser extensions, automatic browser-history capture, bulk import/export, sharing, link-health checks, offline copies, and automatic metadata retrieval are outside scope.
- Deletion is permanent after confirmation; a recycle bin and version history are outside scope.
- Search covers the user's saved text and does not search page contents on the destination website.
- Users are responsible for the content and safety of external destinations they save and open.

