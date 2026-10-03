# Feature Specification: Bookmark Manager

**Feature Branch**: `[001-bookmark-manager]`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "I want to build an app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save and Revisit Bookmarks (Priority: P1)

As a user, I want to save a web address with a recognizable title so I can return to useful content later, and I want to open any saved bookmark directly from my library.

**Why this priority**: Saving and reopening links is the core value of a bookmark manager and forms a useful minimum product by itself.

**Independent Test**: Sign in, save a valid web address, leave and return to the library, and open the saved bookmark. The bookmark remains available and leads to the saved destination.

**Acceptance Scenarios**:

1. **Given** a signed-in user and a valid web address, **When** the user saves it with a title, **Then** the bookmark appears in that user's library with the title and address.
2. **Given** a valid web address and no title supplied by the user, **When** the bookmark is saved, **Then** the system assigns a recognizable fallback title and the user can edit it later.
3. **Given** an existing bookmark, **When** the user chooses to open it, **Then** the saved destination opens without removing the user from the bookmark library.
4. **Given** an invalid or unsupported address, **When** the user tries to save it, **Then** the bookmark is not created and the user receives a clear correction message.

---

### User Story 2 - Organize and Maintain a Library (Priority: P2)

As a user, I want to edit, favorite, tag, group, and remove saved bookmarks so my library stays useful as it grows.

**Why this priority**: A saved list quickly becomes difficult to use unless people can correct details, add lightweight structure, highlight important links, and remove obsolete items.

**Independent Test**: Starting with several bookmarks, create a collection and tags, organize the bookmarks, favorite one, edit another, and delete a third. Each change is visible after returning to the library.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user edits its title, address, description, collection, or tags, **Then** the updated details replace the prior values.
2. **Given** an existing bookmark, **When** the user marks or unmarks it as a favorite, **Then** its favorite status updates immediately and persists.
3. **Given** a user's library, **When** the user creates or renames a collection and assigns bookmarks to it, **Then** the collection and its assigned bookmarks are displayed together.
4. **Given** an existing bookmark, **When** the user confirms deletion, **Then** it is removed from the library; if the user cancels, no change is made.
5. **Given** two saved bookmarks with the same normalized destination, **When** the user attempts to save the destination again, **Then** the system warns that it already exists and offers a route to the existing bookmark without creating a duplicate by default.

---

### User Story 3 - Find Bookmarks Quickly (Priority: P3)

As a user, I want to search, filter, and sort my library so I can find a saved item without manually scanning every bookmark.

**Why this priority**: Retrieval speed determines whether a bookmark collection remains valuable at larger sizes, but it depends on bookmarks already existing.

**Independent Test**: Populate a library with varied titles, addresses, descriptions, tags, collections, favorites, and save dates; then verify that each search, filter, and sort option returns the expected ordered subset.

**Acceptance Scenarios**:

1. **Given** a populated library, **When** the user searches for text found in a bookmark's title, address, description, or tag, **Then** matching bookmarks are shown and non-matches are excluded.
2. **Given** a populated library, **When** the user filters by collection, tag, or favorite status, **Then** only bookmarks satisfying all active filters are shown.
3. **Given** a populated library, **When** the user sorts by newest saved, oldest saved, or title, **Then** the visible bookmarks appear in the selected order.
4. **Given** search or filters with no matches, **When** results are displayed, **Then** the user sees an informative empty state and can clear the active criteria.

---

### User Story 4 - Access a Private Library Across Sessions (Priority: P4)

As a user, I want to sign in and see only my own saved bookmarks so my library is private and remains available when I return.

**Why this priority**: Persistent, private ownership is necessary for a dependable personal library, though the core bookmark workflow can be evaluated with a prepared account.

**Independent Test**: Save different bookmarks in two user accounts, sign out and back in, and verify that each account sees its own unchanged library and cannot access the other account's content.

**Acceptance Scenarios**:

1. **Given** a valid user account, **When** the user signs in, **Then** that user's bookmark library is displayed.
2. **Given** a signed-in user with saved bookmarks, **When** the user signs out and later signs back in, **Then** the saved bookmarks and organization are preserved.
3. **Given** two different user accounts, **When** either user views or modifies their library, **Then** the other user's bookmarks, collections, and tags are not visible or changeable.

### Edge Cases

- Leading and trailing spaces in an address are ignored before validation and duplicate comparison.
- Addresses that differ only by a URL fragment or common presentation differences are treated consistently according to the same documented normalization rules; the original saved address remains editable.
- Very long titles, descriptions, addresses, collection names, and tag names produce clear length guidance and never silently lose user-entered text.
- A bookmark remains manageable when its destination is temporarily unavailable; destination availability does not block editing or deletion.
- Removing a collection does not remove its bookmarks. Affected bookmarks return to the unfiled state after confirmation.
- Renaming a tag to the name of an existing tag merges the two tags only after user confirmation.
- Search is case-insensitive, ignores accidental surrounding whitespace, and clearly distinguishes no matches from an empty library.
- If a save or edit operation fails, the prior persisted state remains intact and the user receives an actionable message.
- Concurrent changes from two sessions must not silently overwrite a newer saved version; the user is told that the item changed and can reload the latest version.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let a user create an account, sign in, sign out, and regain access to their account through a secure recovery flow.
- **FR-002**: The system MUST restrict bookmarks, collections, and tags to their owning user.
- **FR-003**: A signed-in user MUST be able to save a bookmark with a valid `http` or `https` address and an optional title, description, collection, and set of tags.
- **FR-004**: When the user omits a title, the system MUST provide a recognizable fallback title derived from available destination information and MUST allow the user to change it.
- **FR-005**: The system MUST record and display each bookmark's title, destination address, optional description, tags, collection, favorite status, creation time, and last-updated time.
- **FR-006**: The system MUST reject empty, malformed, or unsupported addresses with a correction message and without creating or altering a bookmark.
- **FR-007**: The system MUST detect an attempted duplicate within the same user's library using consistent normalized-address rules, warn the user, and link to the existing bookmark rather than create a duplicate by default.
- **FR-008**: A user MUST be able to open a saved bookmark's destination while retaining access to the bookmark library.
- **FR-009**: A user MUST be able to edit the title, address, description, collection, and tags of a bookmark.
- **FR-010**: A user MUST be able to mark and unmark a bookmark as a favorite.
- **FR-011**: A user MUST be able to delete a bookmark only after an explicit confirmation and MUST be able to cancel that action without loss.
- **FR-012**: A user MUST be able to create, rename, and delete collections and assign at most one collection to each bookmark.
- **FR-013**: Deleting a collection MUST retain its bookmarks and place them in an unfiled state after confirmation.
- **FR-014**: A user MUST be able to create and reuse tags, assign multiple tags to a bookmark, remove tags from a bookmark, and rename or delete tags.
- **FR-015**: Renaming a tag to an existing tag name MUST require confirmation to merge the tags, and deleting a tag MUST retain the associated bookmarks.
- **FR-016**: A user MUST be able to browse all bookmarks and separately view unfiled bookmarks and favorites.
- **FR-017**: A user MUST be able to search their bookmarks by title, destination address, description, or tag using case-insensitive text matching.
- **FR-018**: A user MUST be able to filter visible bookmarks by collection, tag, and favorite status, with active filters combined so that every displayed bookmark satisfies all of them.
- **FR-019**: A user MUST be able to sort visible bookmarks by newest saved, oldest saved, or title, with newest saved as the default.
- **FR-020**: The system MUST preserve the user's bookmarks and organization across sign-out, sign-in, and normal service restarts.
- **FR-021**: The system MUST show distinct, actionable states for an empty library, no search or filter matches, invalid input, and an operation that could not be completed.
- **FR-022**: The primary save, browse, organize, and search workflows MUST remain usable on both phone-sized and desktop-sized screens.
- **FR-023**: The system MUST communicate conflicting concurrent updates and prevent an older edit from silently replacing a newer saved version.

### Key Entities

- **User**: The owner of a private bookmark library and its organizational data; identified by account credentials and profile details required for access and recovery.
- **Bookmark**: A saved web destination owned by one user, including title, address, optional description, favorite state, creation and update timestamps, zero or more tags, and zero or one collection.
- **Collection**: A user-owned named grouping that may contain many bookmarks; removing it does not remove those bookmarks.
- **Tag**: A reusable user-owned label that may be associated with many bookmarks, while each bookmark may have many tags.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of first-time users can save and then reopen a valid bookmark without assistance in under 60 seconds.
- **SC-002**: For a library containing 10,000 bookmarks, 95% of search, filter, and sort actions show the updated visible result within 1 second under expected operating conditions.
- **SC-003**: At least 90% of users can organize an existing bookmark into a collection and apply a tag in under 45 seconds without assistance.
- **SC-004**: Returning users can locate and open a known bookmark from a library of at least 1,000 items in under 30 seconds using search or filters.
- **SC-005**: In acceptance testing, 100% of attempts to access another user's bookmark, collection, or tag are denied without revealing its private content.
- **SC-006**: In acceptance testing, every confirmed successful save, edit, favorite, organization, and deletion action remains correct after signing out and signing back in.
- **SC-007**: At least 90% of representative participants rate the save-and-find experience as easy or very easy after completing the core scenarios.

## Assumptions

- The first release is a responsive web application for individual users with private libraries.
- Email-based account access and recovery are sufficient for the first release; enterprise identity, teams, roles, and shared libraries are outside scope.
- A bookmark belongs to at most one collection but may have multiple tags.
- The application attempts to derive a fallback title from the destination when practical and otherwise uses the destination's host or address; saving does not depend on the remote site being reachable.
- Search covers the current user's saved metadata; full-text search inside destination pages is outside scope.
- Duplicate detection warns and avoids accidental duplicates by default; an explicit force-duplicate workflow is outside scope for the first release.
- Importing or exporting browser bookmarks, browser extensions, offline access, automated link-health checks, content archiving, sharing, public profiles, and collaborative curation are outside the first release.
- Users are expected to have network access while using the application.

