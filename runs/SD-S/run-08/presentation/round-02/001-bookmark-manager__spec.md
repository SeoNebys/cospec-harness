# Feature Specification: Bookmark Manager

**Feature Branch**: `[001-bookmark-manager]`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "I want to build an app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save and Revisit Bookmarks (Priority: P1)

As a user, I want to paste a web address and have the app identify the page for me so I can save it with minimal typing, return to it later, edit its details, and remove it when it is no longer useful.

**Why this priority**: Saving and maintaining links is the core value of a bookmark manager and constitutes a useful first release on its own.

**Independent Test**: Starting with an empty collection, paste a valid web address, confirm the saved bookmark uses the page's actual title and available site icon, open it, edit its title, and delete it.

**Acceptance Scenarios**:

1. **Given** the user is viewing their collection, **When** they submit a valid web address, **Then** the app retrieves the page's actual title and available site icon and saves the bookmark with them.
2. **Given** a bookmark exists, **When** the user selects it, **Then** its destination opens without changing the stored bookmark.
3. **Given** a bookmark exists, **When** the user changes its title, web address, or notes with valid values, **Then** the updated details appear in the collection.
4. **Given** a bookmark exists, **When** the user confirms its deletion, **Then** it no longer appears in the collection.
5. **Given** a valid page cannot provide a title or its details cannot be retrieved, **When** the save attempt completes, **Then** the user can enter or confirm a fallback title and still save the bookmark.

---

### User Story 2 - Organize with Tags (Priority: P2)

As a user, I want to assign reusable tags to bookmarks so I can group links by topic or purpose.

**Why this priority**: Organization becomes important as the collection grows, but the app remains useful without it.

**Independent Test**: Add two tags to a bookmark, reuse one tag on another bookmark, filter by that tag, then remove a tag without deleting either bookmark.

**Acceptance Scenarios**:

1. **Given** a bookmark exists, **When** the user assigns one or more tags, **Then** those tags are displayed with the bookmark.
2. **Given** multiple bookmarks share a tag, **When** the user filters by that tag, **Then** every matching bookmark and no non-matching bookmark is shown.
3. **Given** a bookmark has a tag, **When** the user removes that tag from the bookmark, **Then** the bookmark remains saved and the tag is no longer associated with it.

---

### User Story 3 - Find Saved Bookmarks (Priority: P3)

As a user, I want to search and sort my bookmark collection so I can quickly find a saved link.

**Why this priority**: Retrieval improves the experience for larger collections after saving and basic organization are available.

**Independent Test**: Populate a collection with varied titles, web addresses, notes, tags, and save dates; search for a matching term and switch between the available sort orders.

**Acceptance Scenarios**:

1. **Given** the collection contains bookmarks, **When** the user searches for text found in a title, web address, note, or tag, **Then** matching bookmarks are shown.
2. **Given** a search has no matches, **When** results are displayed, **Then** the user sees a clear empty result and can reset the search.
3. **Given** multiple bookmarks are visible, **When** the user chooses newest, oldest, or alphabetical order, **Then** the visible bookmarks appear in that order.

### Edge Cases

- An empty collection presents guidance for saving the first bookmark rather than a blank screen.
- A web address that omits a scheme but otherwise resembles a valid public address is normalized to a secure web address; malformed or unsupported addresses are rejected with an actionable message.
- Saving a web address that already exists in the collection warns the user and offers to view or update the existing bookmark instead of silently creating a duplicate.
- Titles, notes, searches, and tags containing punctuation, non-Latin characters, or emoji remain usable and display correctly.
- Removing a tag from its final bookmark removes it from the available tag filters.
- Search and tag filters can be cleared independently and together.
- A failed save, edit, or delete leaves the prior collection intact and explains that the action did not complete.
- If the destination is temporarily unreachable, blocks detail retrieval, or has no usable page title, the app explains the issue and lets the user save using an editable fallback title.
- If no usable site icon is available, the bookmark displays a consistent generic icon and remains fully usable.
- Very long titles and web addresses remain readable without breaking the collection layout.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to save a bookmark by providing a valid web address, with an optional note and an optional title override.
- **FR-002**: When a valid web address is submitted without a title override, the system MUST attempt to retrieve the page's published title automatically and use it as the bookmark title.
- **FR-003**: The system MUST attempt to retrieve and display the destination's site icon; when no usable icon is available, it MUST display a consistent generic icon without preventing the bookmark from being saved.
- **FR-004**: Users MUST be able to edit an automatically retrieved title before or after saving the bookmark.
- **FR-005**: If the page title cannot be retrieved or is missing, the system MUST show an editable fallback title, explain that automatic retrieval was unsuccessful, and allow the user to save the bookmark.
- **FR-006**: The system MUST validate submitted web addresses, accept standard HTTP and HTTPS destinations, normalize recognizable addresses that omit a scheme, and reject malformed or unsupported destinations with an actionable explanation.
- **FR-007**: The system MUST warn users when a submitted web address is already saved and MUST prevent silent duplicate creation.
- **FR-008**: Users MUST be able to view their complete bookmark collection, including each bookmark's title, destination, site icon or generic icon, tags, and saved date.
- **FR-009**: Users MUST be able to open a saved bookmark's destination.
- **FR-010**: Users MUST be able to edit a bookmark's title, web address, and note.
- **FR-011**: Users MUST be able to delete a bookmark only after an explicit confirmation.
- **FR-012**: Users MUST be able to assign multiple reusable tags to a bookmark and remove tags from it without deleting the bookmark.
- **FR-013**: Users MUST be able to filter the collection by a selected tag.
- **FR-014**: Users MUST be able to search bookmarks by title, web address, note, or tag using a case-insensitive text query.
- **FR-015**: Users MUST be able to sort visible bookmarks by newest saved, oldest saved, and title in alphabetical order.
- **FR-016**: The system MUST show informative empty states for an empty collection and for searches or filters with no matches.
- **FR-017**: The system MUST preserve the collection between user sessions on the same installation.
- **FR-018**: The system MUST provide clear success or failure feedback for save, edit, and delete actions without discarding previously saved data when an action fails.
- **FR-019**: Core save, browse, edit, delete, search, filter, and sort actions MUST be usable with a keyboard and expose understandable labels to assistive technologies.

### Key Entities

- **Bookmark**: A saved destination with a unique identifier, web address, editable display title, optional site icon, optional note, creation date, last-updated date, and zero or more tags.
- **Tag**: A reusable organizational label identified by its name and associated with zero or more bookmarks while in active use.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of first-time users can paste a valid web address and save a bookmark carrying the page's actual title within 30 seconds without typing a title or receiving assistance.
- **SC-002**: At least 95% of users can locate a known bookmark in a collection of 1,000 items within 15 seconds by using search, a tag filter, or sorting.
- **SC-003**: Collections of up to 10,000 bookmarks remain usable, with search, filter, and sort results visible within 2 seconds for at least 95% of attempts under normal operating conditions.
- **SC-004**: All tested save, edit, delete, tag, search, filter, and sort scenarios produce the expected result with no loss or unintended duplication of saved bookmarks.
- **SC-005**: All core bookmark-management journeys can be completed using only a keyboard and have no critical accessibility violations in an agreed accessibility review.

## Assumptions

- The first release serves one user per installation; accounts, sharing, collaboration, and role-based permissions are outside its scope.
- The first release is an online, responsive experience usable on common desktop and mobile screen sizes.
- Bookmarks are entered manually. Browser extensions, browser-history capture, bulk import/export, preview images beyond the site icon, and broken-link monitoring are outside the first release.
- Page titles are retrieved when a bookmark is first saved; later changes made by the destination do not automatically overwrite a title the user may have edited.
- Site icons are a best-effort enhancement: inability to retrieve one never blocks saving, editing, opening, or finding a bookmark.
- A bookmark may have any number of tags, and tag names are matched without regard to letter case to avoid near-duplicate labels.
- Search matches partial text in titles, web addresses, notes, and tags.
- Opening a bookmark follows normal browser behavior and does not alter the saved record.
- Saved bookmarks persist until the user deletes them; no automatic expiration is required.
