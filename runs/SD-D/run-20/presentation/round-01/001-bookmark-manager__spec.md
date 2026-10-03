# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-25

**Status**: Draft — awaiting client approval

**Input**: User description: "I want to build an app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save and revisit a bookmark (Priority: P1)

As a user, I can save a web address with a recognizable title and later open it from my bookmark library, so useful pages do not get lost.

**Why this priority**: Saving and reopening links is the core value of a bookmark manager and forms a useful first release by itself.

**Independent Test**: Save a valid web address with a title, leave and return to the library, and open the saved bookmark. The bookmark remains available and points to the saved address.

**Acceptance Scenarios**:

1. **Given** an empty bookmark library, **When** the user enters a valid web address and title and saves it, **Then** the bookmark appears in the library with its title, address, and saved date.
2. **Given** a saved bookmark, **When** the user selects its open action, **Then** the saved web address opens without changing the bookmark.
3. **Given** an invalid or unsupported address, **When** the user attempts to save it, **Then** the bookmark is not created and the user sees how to correct the address.
4. **Given** a bookmark has been saved, **When** the user returns in a later session, **Then** the bookmark is still present.

---

### User Story 2 - Find bookmarks quickly (Priority: P2)

As a user, I can search and filter my bookmark library so I can find a saved page without manually scanning every item.

**Why this priority**: A growing collection is only useful when its contents can be retrieved quickly.

**Independent Test**: Create bookmarks with varied titles, addresses, notes, and tags; search for matching text and filter by tags; verify that only matching active bookmarks are shown and that clearing controls restores the full active library.

**Acceptance Scenarios**:

1. **Given** multiple active bookmarks, **When** the user searches for text found in a bookmark's title, address, notes, or tags, **Then** matching bookmarks are shown and non-matching bookmarks are excluded.
2. **Given** bookmarks with different tags, **When** the user filters by one or more tags, **Then** only bookmarks carrying every selected tag are shown.
3. **Given** active search or tag filters, **When** the user clears them, **Then** the complete active bookmark library is shown.
4. **Given** no bookmarks match the current search or filters, **When** results are displayed, **Then** the user sees a clear empty result state and can reset the criteria.

---

### User Story 3 - Organize and update bookmarks (Priority: P3)

As a user, I can edit bookmark details and use tags and notes so my library remains understandable as my needs change.

**Why this priority**: User-supplied context makes links easier to recognize and group, but the core save-and-find workflow can work without it.

**Independent Test**: Edit an existing bookmark's title, address, notes, and tags, then confirm the changes appear in its library entry and affect subsequent search and filtering.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user changes its title, valid address, notes, or tags and saves, **Then** the library displays the updated details.
2. **Given** a bookmark with tags, **When** the user removes or adds tags, **Then** the available tag filters and filter results reflect the changes.
3. **Given** an existing bookmark, **When** the user cancels an edit, **Then** none of the pending changes are applied.

---

### User Story 4 - Remove clutter safely (Priority: P4)

As a user, I can archive bookmarks I may want later and permanently delete bookmarks I no longer need, so the active library stays relevant.

**Why this priority**: Cleanup matters over time, while safe archiving reduces the risk of accidental loss.

**Independent Test**: Archive an active bookmark, restore it, archive it again, and permanently delete it after confirming the destructive action. Verify its visibility at each stage.

**Acceptance Scenarios**:

1. **Given** an active bookmark, **When** the user archives it, **Then** it leaves the active library and appears in the archived view.
2. **Given** an archived bookmark, **When** the user restores it, **Then** it returns to the active library.
3. **Given** an archived bookmark, **When** the user initiates permanent deletion, **Then** the system asks for confirmation and explains that the action cannot be undone.
4. **Given** the permanent-deletion confirmation, **When** the user confirms, **Then** the bookmark is removed from the library; **When** the user cancels, **Then** it remains archived.

### Edge Cases

- Saving an address that already exists creates no second bookmark; the user is directed to the existing entry and may update it.
- Addresses with leading or trailing spaces are normalized before validation; only `http` and `https` web addresses are accepted in this release.
- A title is required and cannot consist only of whitespace; notes are optional.
- Tags that differ only by capitalization or surrounding whitespace are treated as the same tag.
- Titles over 200 characters, addresses over 2,048 characters, notes over 5,000 characters, tag names over 30 characters, and attempts to add more than 20 tags are rejected with an actionable message rather than truncated silently.
- Search is case-insensitive and treats punctuation and empty input predictably; empty search text shows all bookmarks allowed by the current view and filters.
- If saving or editing cannot be completed, the user's entered values remain available so the action can be retried.
- An empty active or archived library presents a useful empty state with the next relevant action.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide separate views for active and archived bookmarks, with active bookmarks shown by default.
- **FR-002**: Users MUST be able to create a bookmark with a required title and web address plus optional notes and tags.
- **FR-003**: The system MUST accept only valid `http` or `https` web addresses and MUST explain rejected input in a user-actionable way.
- **FR-004**: The system MUST preserve saved bookmarks across user sessions until the user permanently deletes them.
- **FR-005**: The system MUST record and display when each bookmark was saved and most recently updated.
- **FR-006**: Users MUST be able to open a saved bookmark at its stored web address.
- **FR-007**: The system MUST prevent duplicate active or archived bookmarks with the same normalized web address and MUST direct the user to the existing bookmark.
- **FR-008**: Users MUST be able to search bookmarks by title, web address, notes, and tags using case-insensitive text matching.
- **FR-009**: Users MUST be able to filter bookmarks by one or more tags; a bookmark MUST contain every selected tag to match.
- **FR-010**: Users MUST be able to clear search and tag filters in one action.
- **FR-011**: Users MUST be able to edit a bookmark's title, web address, notes, and tags, subject to the same validation and duplicate rules used when creating it.
- **FR-012**: Users MUST be able to cancel editing without changing the saved bookmark.
- **FR-013**: The system MUST normalize tag capitalization and surrounding whitespace so equivalent tag labels are not duplicated.
- **FR-014**: Users MUST be able to archive active bookmarks and restore archived bookmarks.
- **FR-015**: Users MUST be able to permanently delete an archived bookmark only after an explicit confirmation that communicates the irreversible result.
- **FR-016**: The system MUST provide distinct, actionable empty states for an empty library and for search or filter criteria with no matches.
- **FR-017**: The system MUST retain entered form values after a failed save or edit attempt whenever those values remain safe to display.
- **FR-018**: All core bookmark operations MUST be usable with keyboard-only navigation, visible focus, programmatically associated labels, and status feedback that does not rely on color alone.
- **FR-019**: The system MUST enforce these per-bookmark limits: 200 characters for the title, 2,048 for the web address, 5,000 for notes, 30 per tag name, and 20 tags; validation MUST occur before saving and MUST NOT silently truncate input.

### Key Entities

- **Bookmark**: A saved web resource with a unique normalized web address, required title, optional notes, zero or more tags, lifecycle status (active or archived), creation date, and last-updated date.
- **Tag**: A normalized user-defined label used to organize and filter bookmarks; a tag can belong to many bookmarks and a bookmark can have many tags.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In usability testing, at least 90% of first-time users can save a valid bookmark and reopen it without assistance in under 60 seconds.
- **SC-002**: Users can locate a known bookmark in a library of 1,000 entries through search or tag filtering in under 10 seconds in at least 95% of test attempts.
- **SC-003**: At least 95% of save, edit, archive, restore, and delete test attempts produce the expected visible library state on the first attempt.
- **SC-004**: Active-library search and filter results become visible within 1 second for a library of 10,000 bookmarks in at least 95% of measured interactions.
- **SC-005**: All core workflows can be completed using only a keyboard, and automated accessibility checks report no critical violations on the library, create/edit, and archived views.
- **SC-006**: No bookmark is permanently removed without an explicit user confirmation during acceptance testing.

## Assumptions

- The initial release is a private, single-user bookmark library on one device; accounts, multi-user permissions, synchronization across devices, sharing, and collaboration are outside scope.
- The user enters the bookmark title and optional notes and tags; automatic metadata, page previews, screenshots, and availability checks are outside scope.
- Browser extensions, bulk import/export, folders, favorites, custom sorting, and drag-and-drop organization are outside scope for the initial release.
- The application may open saved destinations, but it does not control or guarantee the safety, availability, or content of external websites.
- The active library uses newest-saved-first ordering by default; custom ordering is outside scope.
