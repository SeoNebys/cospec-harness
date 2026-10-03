# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-27

**Status**: Draft — awaiting client approval

**Input**: User description: "I want to build an app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save and Revisit Bookmarks (Priority: P1)

As a user, I can save a web address with useful context and see it in my bookmark library so I can return to it later.

**Why this priority**: Saving and revisiting links is the core value of a bookmark manager. This story alone provides a usable first increment.

**Independent Test**: Save a valid web address, close and reopen the app, locate the saved bookmark, and open its destination.

**Acceptance Scenarios**:

1. **Given** an empty library, **When** the user saves a valid web address with a title, **Then** the bookmark appears in the library with its title, address, and saved date.
2. **Given** the user provides a valid web address without a title, **When** the user saves it, **Then** the bookmark is stored and the address is used as its display label.
3. **Given** a saved bookmark, **When** the user selects its open action, **Then** the destination opens without losing the user's place in the bookmark library.
4. **Given** existing bookmarks, **When** the user leaves and later returns to the app, **Then** the saved bookmarks remain available.

---

### User Story 2 - Find and Organize Bookmarks (Priority: P2)

As a user, I can add tags and notes, search my library, and filter by tag so I can quickly find a bookmark even when the library is large.

**Why this priority**: A growing collection only remains useful when its contents can be organized and retrieved efficiently.

**Independent Test**: Create bookmarks with distinct titles, addresses, notes, and tags; verify that search and tag filtering return only the matching bookmarks and can be cleared.

**Acceptance Scenarios**:

1. **Given** bookmarks with different titles, addresses, notes, and tags, **When** the user enters a search term, **Then** matching bookmarks are shown based on all four fields without regard to letter case.
2. **Given** bookmarks assigned to different tags, **When** the user filters by one tag, **Then** only bookmarks carrying that tag are shown.
3. **Given** an active search or tag filter, **When** the user clears it, **Then** the full bookmark library is shown again.
4. **Given** no bookmarks match the current search or filter, **When** results are displayed, **Then** the app explains that no matches were found and provides a way to clear the criteria.

---

### User Story 3 - Maintain the Library (Priority: P3)

As a user, I can correct, enrich, or remove saved bookmarks so my library stays accurate and useful.

**Why this priority**: Maintenance prevents stale or mistaken entries from reducing the value of the collection, but it depends on the core save-and-view flow.

**Independent Test**: Edit every bookmark field, verify the updates survive reopening the app, then delete the bookmark after confirming the destructive action.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user changes its title, address, note, or tags and saves the changes, **Then** the updated values appear in the library and persist on return.
2. **Given** a saved bookmark, **When** the user requests deletion, **Then** the app asks for confirmation before removing it.
3. **Given** a deletion confirmation, **When** the user cancels, **Then** the bookmark remains unchanged.
4. **Given** a deletion confirmation, **When** the user confirms, **Then** the bookmark is removed from the library and from search and filter results.

### Edge Cases

- An empty library shows a clear empty state and an action to save the first bookmark.
- A malformed address or an address using a scheme other than HTTP or HTTPS is rejected with a specific correction message, and the user's other entered values are preserved.
- Saving an address that exactly matches an existing bookmark is prevented, and the existing bookmark is identified so the user can edit it instead.
- Leading and trailing whitespace in entered values does not create accidental differences or empty tags.
- Tag names that differ only in capitalization are treated as the same tag.
- A bookmark may still be saved when its well-formed destination is temporarily unreachable; destination availability is not inferred from a failed visit.
- A very long title, note, or address remains readable without obscuring the bookmark's primary actions.
- Removing the final use of a tag removes that tag from the available filter choices.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST let the user save a bookmark with a required HTTP or HTTPS address and optional title, note, and tags.
- **FR-002**: The app MUST reject missing, malformed, or unsupported addresses before saving and MUST explain how the user can correct the entry.
- **FR-003**: The app MUST preserve valid values already entered when a save attempt fails validation.
- **FR-004**: When no title is supplied, the app MUST use the bookmark address as its display label.
- **FR-005**: The app MUST prevent more than one bookmark with the exact same address and MUST direct the user to the existing bookmark.
- **FR-006**: The app MUST show all saved bookmarks in a library with enough information to distinguish them, including display label, address, tags, and saved date.
- **FR-007**: The app MUST order the library by most recently saved or updated by default and MUST let the user alternatively sort it by title.
- **FR-008**: The user MUST be able to open a bookmark's destination while retaining the current library state.
- **FR-009**: The app MUST provide case-insensitive search across bookmark titles, addresses, notes, and tag names.
- **FR-010**: The app MUST let the user filter the library by a single tag and clearly show the active filter.
- **FR-011**: The app MUST let the user clear active search and filter criteria and return to the full library.
- **FR-012**: The user MUST be able to create tags while saving or editing a bookmark.
- **FR-013**: The app MUST ignore empty tags and MUST treat tag names that differ only by capitalization as one tag.
- **FR-014**: The user MUST be able to edit a bookmark's address, title, note, and tags, subject to the same validation and duplicate rules as creation.
- **FR-015**: The user MUST be able to request deletion of a bookmark, and the app MUST require explicit confirmation before permanent removal.
- **FR-016**: The app MUST provide meaningful empty states for an empty library and for search or filter criteria with no matches.
- **FR-017**: The app MUST persist bookmarks and their organization between app sessions on the same deployment.
- **FR-018**: The app MUST make a bookmark's save date and most recent update date available to the user.
- **FR-019**: The app MUST keep the user's private bookmark collection inaccessible to unrelated visitors to the deployment.
- **FR-020**: The app MUST support keyboard operation for saving, searching, filtering, editing, opening, and deleting bookmarks, with visible focus and understandable control labels.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved web destination. It has an address, optional user-provided title, optional note, zero or more tags, a creation date, and a most recent update date. Its display label is the title when present and otherwise the address.
- **Tag**: A user-defined organizational label. A tag has a name and can be associated with many bookmarks; a bookmark can have many tags. Tag identity is case-insensitive.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user can save a valid bookmark and reopen it in under 30 seconds without instructions.
- **SC-002**: At least 90% of representative users complete the save, find, edit, and delete journeys successfully on their first attempt.
- **SC-003**: With a library of 10,000 bookmarks, search, filtering, and sorting each show the resulting collection within 2 seconds of the user's action.
- **SC-004**: Across persistence tests covering at least 1,000 bookmarks and 100 leave-and-return cycles, 100% of confirmed bookmark changes remain intact.
- **SC-005**: In validation tests, 100% of missing, malformed, unsupported, and exact-duplicate addresses are prevented from creating invalid or duplicate bookmarks and receive an actionable message.
- **SC-006**: All primary bookmark-management journeys can be completed using only a keyboard and retain a visible indication of the currently focused control.

## Assumptions

- The first release is a private, single-user bookmark manager; multiple user accounts, shared collections, roles, and collaboration are outside this feature.
- The experience is intended for modern desktop and mobile web browsers with ordinary internet connectivity.
- Bookmarks persist for the life of the deployment unless the user explicitly deletes them; automated expiration is not required.
- Checking destination availability and automatically retrieving page titles, descriptions, favicons, or previews are outside this feature.
- Import, export, browser extensions, nested folders, favorites, archiving, and bulk operations are outside this feature.
- Search is text matching rather than semantic or full-web search.
- The app manages bookmark records but does not control or guarantee the safety, content, or availability of external destinations.
