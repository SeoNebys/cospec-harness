# Feature Specification: Bookmark Manager

**Feature Directory**: `001-manage-bookmarks`

**Created**: 2026-09-23

**Status**: Approved on 2026-09-23

**Input**: User description: "I want to build an app to save and manage bookmarks. Saving should be quick: after I paste a web address, automatically fill an editable page title and short description."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save and revisit a bookmark (Priority: P1)

As a user, I can paste a web address and have the app fill in an editable page title and short description before I save it, so useful pages can be captured quickly and revisited later.

**Why this priority**: Saving and revisiting links is the minimum useful bookmark-management experience.

**Independent Test**: Paste a valid address for a publicly accessible page, verify that its title and available description are filled in, optionally edit those details, save the bookmark, leave and return to the app, and open its destination.

**Acceptance Scenarios**:

1. **Given** the bookmark library is available, **When** the user pastes a valid address for a publicly accessible page, **Then** the app automatically fills in the page title and, when the page provides one, a short description.
2. **Given** automatically filled page details, **When** the user edits the title or description and saves, **Then** the bookmark retains the user's edited values rather than replacing them with the retrieved values.
3. **Given** a valid address whose page details cannot be retrieved, **When** retrieval finishes or times out, **Then** the app explains the limitation, supplies an editable title based on the address, leaves the description blank, and still allows the bookmark to be saved.
4. **Given** a bookmark was saved in an earlier session, **When** the user returns to the library, **Then** the bookmark remains available.
5. **Given** a saved bookmark, **When** the user activates it, **Then** its web address opens without removing or changing the bookmark.
6. **Given** an invalid or unsupported address, **When** the user attempts to save it, **Then** the bookmark is not created and the user sees a clear explanation.

---

### User Story 2 - Find and organize bookmarks (Priority: P2)

As a user, I can add tags and optional notes, mark important bookmarks as favorites, and search or filter my library, so I can quickly recover the right page as the collection grows.

**Why this priority**: Organization and retrieval turn a link list into a useful long-term library.

**Independent Test**: Create bookmarks with different titles, addresses, descriptions, notes, tags, and favorite states; then confirm search and each filter return the expected subset.

**Acceptance Scenarios**:

1. **Given** the user is creating or editing a bookmark, **When** they add notes, tags, or a favorite status and save, **Then** those details are retained and displayed with the bookmark.
2. **Given** a library containing multiple bookmarks, **When** the user searches for text found in a title, address, description, note, or tag, **Then** only matching bookmarks are shown.
3. **Given** bookmarks with different tags and favorite states, **When** the user filters by a tag or favorites, **Then** only bookmarks satisfying the active filters are shown.
4. **Given** an active query or filter with no matches, **When** results are displayed, **Then** the user sees a clear empty state and can reset the query or filters.

---

### User Story 3 - Maintain the library (Priority: P3)

As a user, I can update outdated bookmark details, remove bookmarks I no longer need, and choose a useful display order, so the library stays accurate and manageable.

**Why this priority**: Maintenance preserves the value of the library but depends on bookmarks already existing.

**Independent Test**: Edit a bookmark, reorder the list using each supported sort option, and delete the bookmark after confirming the action.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user changes its title, address, description, notes, tags, or favorite status with valid values, **Then** the updated details replace the previous details.
2. **Given** an existing bookmark, **When** the user requests deletion, **Then** the app asks for confirmation before permanently removing it.
3. **Given** multiple bookmarks, **When** the user selects newest, oldest, or alphabetical order, **Then** the visible list follows that order.

### Edge Cases

- Saving an address already present in the library warns the user and points to the existing bookmark instead of silently creating a duplicate; the user may explicitly choose to save another copy.
- Addresses that omit a web scheme but otherwise resemble a valid website are normalized to a secure web address before saving; non-web schemes are rejected.
- If a page redirects to another public web address, page details are taken from the final destination and the user can see the destination address before saving.
- If a page is unavailable, access-controlled, blocks retrieval, lacks a title or description, or takes too long to respond, the user can still save it using editable fallback details and is not left in a perpetual loading state.
- If the user changes the address after page details were filled in, those details are treated as stale and are refreshed for the new address; user edits are not silently overwritten.
- Automatically retrieved page details are treated as text and cannot introduce interactive page content into the bookmark library.
- Titles and tags containing leading or trailing whitespace are trimmed; blank titles and blank tags are not accepted.
- Repeated tags on one bookmark are treated as one tag without regard to letter case.
- Very long titles, addresses, notes, or tag lists are rejected at documented limits with an explanation that preserves the user's unsaved input.
- If a destination page is unavailable, the saved bookmark remains intact; opening failures do not delete or alter it.
- Search is case-insensitive and handles punctuation and partial words without producing an error.
- An empty library presents a clear invitation to add the first bookmark rather than an unexplained blank screen.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow the user to begin creating a bookmark by entering only a web address.
- **FR-002**: After the user enters a valid public web address, the system MUST attempt to retrieve and prefill the page's title and short description without requiring a separate user action.
- **FR-003**: The system MUST show the retrieval status and MUST allow the user to review and edit the retrieved title and description before saving.
- **FR-004**: User edits to a retrieved title or description MUST take precedence and MUST NOT be silently overwritten.
- **FR-005**: When a title or description is unavailable or retrieval fails, the system MUST explain the outcome, provide an editable title derived from the address, leave an unavailable description blank, and allow the bookmark to be saved.
- **FR-006**: The system MUST allow optional notes, zero or more tags, and a favorite status on each bookmark.
- **FR-007**: The system MUST accept only public web addresses using secure or standard web protocols and MUST explain validation failures without discarding entered values.
- **FR-008**: The system MUST normalize a website address that omits its protocol to use a secure web protocol before saving it.
- **FR-009**: The system MUST retain saved bookmarks and their details across user sessions.
- **FR-010**: The system MUST display all saved bookmarks with, at minimum, title, destination address, description when present, tags, favorite status, and creation date.
- **FR-011**: The user MUST be able to open a bookmark's destination from the library.
- **FR-012**: The user MUST be able to edit the address, title, description, notes, tags, and favorite status of an existing bookmark.
- **FR-013**: Changing a bookmark's address MUST allow the user to retrieve page details for the new address, and the system MUST identify existing details as stale until the user chooses whether to replace them.
- **FR-014**: The user MUST be able to request deletion of a bookmark, and the system MUST require confirmation before permanent deletion.
- **FR-015**: The system MUST support case-insensitive search across bookmark titles, addresses, descriptions, notes, and tags.
- **FR-016**: The system MUST support filtering by one tag and by favorite status, including use of both filters together.
- **FR-017**: The system MUST allow the visible bookmarks to be sorted by newest created, oldest created, or title in alphabetical order.
- **FR-018**: The system MUST warn when a submitted address already exists in the library, identify the existing bookmark, and require explicit confirmation before saving a duplicate.
- **FR-019**: The system MUST provide clear empty states for a library with no bookmarks and for a search or filter with no matches.
- **FR-020**: The system MUST make core create, browse, search, edit, and delete tasks usable on both small-screen and large-screen devices.
- **FR-021**: Bookmark data MUST remain private to the app's single user and MUST not be published or shared by the app.
- **FR-022**: Automatically retrieved page details MUST be presented as non-interactive text and MUST NOT introduce executable or interactive page content into the library.
- **FR-023**: The system MUST enforce and communicate these input limits: title up to 200 characters, address up to 2,048 characters, description up to 500 characters, notes up to 2,000 characters, up to 20 tags per bookmark, and each tag up to 40 characters.

### Key Entities

- **Bookmark**: A saved web destination with a required address and editable title; an optional editable page description, personal notes, and tags; a favorite status; and created and last-updated timestamps.
- **Tag**: A normalized label used to organize bookmarks. A tag can belong to many bookmarks, and a bookmark can have up to 20 distinct tags.
- **Library View**: The user's current search text, active tag and favorite filters, and selected sort order. It controls presentation but does not alter bookmark contents.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of first-time test participants can save their first valid bookmark by pasting its address and reopen it without assistance in under 30 seconds.
- **SC-002**: For at least 95% of normally responsive public pages tested, an available page title and description are visible for review within 5 seconds of entering the address.
- **SC-003**: For 100% of tested pages whose details cannot be retrieved, the user receives an explanation and can save with editable fallback details within 10 seconds.
- **SC-004**: At least 95% of test participants can find a known bookmark in a library of 1,000 items using search or filters in under 10 seconds.
- **SC-005**: For a library of up to 10,000 bookmarks, 95% of user-initiated searches, filters, and sorts visibly update within 1 second under normal operating conditions.
- **SC-006**: In acceptance testing, 100% of saved bookmarks remain available with unchanged user-entered details after leaving and returning to the app.
- **SC-007**: At least 90% of test participants can edit and delete a bookmark on both small-screen and large-screen layouts without assistance on their first attempt.
- **SC-008**: All invalid-address, unavailable-page-detail, duplicate-address, empty-library, and no-result scenarios provide an actionable explanation rather than a blank or failed state.

## Assumptions

- The first release serves one user in a private library; account registration, multi-user permissions, sharing, and collaboration are outside scope.
- The app manages ordinary web links only. File links and other address schemes are outside scope.
- Automatic page details consist of a page-provided title and short description when available; images, screenshots, full page previews, and generated summaries are outside scope.
- When page details are unavailable, a title derived from the destination's domain or address is an acceptable fallback that the user can edit before or after saving.
- Tags are free-form labels. Nested folders, tag hierarchies, and smart collections are outside scope.
- Search covers the user's saved bookmark data; full-text indexing of destination-page contents is outside scope.
- Browser extensions, bulk import/export, link-health monitoring, offline copies of pages, and synchronization with third-party bookmark services are outside scope for this feature.
- Permanent deletion after confirmation is acceptable for the first release; trash recovery and version history are outside scope.
- Users have access to a modern web-capable device and a network connection when opening bookmark destinations.
