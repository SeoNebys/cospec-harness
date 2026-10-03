# Feature Specification: Bookmark Management

**Feature Branch**: `001-bookmark-management`

**Created**: 2026-09-26

**Updated**: 2026-09-26

**Status**: Draft — revised after stakeholder review

**Input**: User description: "Build an app to save and manage bookmarks, with automatic page details, read-later tracking, rich personal notes, advanced search, bulk actions, and reversible archiving."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a Bookmark with Page Details (Priority: P1)

As a user, I can paste a web address and have the app fill in recognizable page details for me, so saving a useful page is quick and does not require me to type its title.

**Why this priority**: Fast, low-effort capture is the foundation of the bookmark-management experience.

**Independent Test**: Enter one public web address, review the fetched title, description, and site icon, optionally edit the title or description, save it, return in a later session, and open it.

**Acceptance Scenarios**:

1. **Given** an authenticated user viewing their collection, **When** they enter a valid public web address, **Then** the app attempts to retrieve the page title, a short page description, and the site's icon and shows the result before saving.
2. **Given** retrieved page details, **When** the user changes the proposed title or description before saving, **Then** the bookmark is saved with the user's text and the retrieved site icon.
3. **Given** a page whose details cannot be retrieved, **When** retrieval finishes or times out, **Then** the user sees which details are unavailable, receives an automatically derived title, and can still edit and save the bookmark.
4. **Given** a saved bookmark, **When** the user returns in a later session, **Then** its address, page details, personal notes, tags, reading state, and archive state remain available.
5. **Given** a saved bookmark, **When** the user chooses to open it, **Then** the destination opens without replacing the bookmark collection.
6. **Given** an address already saved in the user's active or archived collection, **When** the user tries to save it again, **Then** the app warns them and takes them to the existing bookmark instead of creating a duplicate.

---

### User Story 2 - Find Bookmarks with Precise Search (Priority: P2)

As a user with a growing collection, I can search across bookmark content, target tags, combine conditions, and filter or sort the results so that I can quickly locate a specific saved page.

**Why this priority**: A large collection is useful only when a user can retrieve the right bookmark reliably.

**Independent Test**: Create bookmarks with overlapping titles, addresses, page descriptions, notes, and tags; verify ordinary terms, a tag qualifier, an exact phrase, Boolean operators, filters, and sorting each produce the expected ordered results.

**Acceptance Scenarios**:

1. **Given** several bookmarks, **When** the user enters ordinary search terms, **Then** matching against titles, addresses, page descriptions, personal notes, and tags is case-insensitive and all entered terms are required by default.
2. **Given** bookmarks with different tags, **When** the user searches with a tag qualifier such as `tag:research`, **Then** only bookmarks carrying that tag are returned.
3. **Given** bookmarks containing similar wording, **When** the user encloses words in quotation marks, **Then** only bookmarks containing that exact phrase are returned.
4. **Given** a search containing `AND`, `OR`, `NOT`, or parentheses, **When** the query is valid, **Then** the app combines or excludes conditions according to `NOT`, then `AND`, then `OR`, with parentheses overriding that order.
5. **Given** a malformed advanced query, **When** the user runs it, **Then** the app identifies the problem in plain language and preserves the query for correction.
6. **Given** an active search or filter with no matches, **When** results are displayed, **Then** the user sees a clear empty state and can clear the active criteria.
7. **Given** any visible collection view, **When** the user chooses a supported sort order, **Then** the visible bookmarks are reordered without changing their saved data.

---

### User Story 3 - Manage a Read-Later Queue (Priority: P2)

As a user, I can flag bookmarks to read later, view only unread items, and check them off as read so that saved reading becomes a manageable queue.

**Why this priority**: The read-later workflow is a primary organization need and replaces a generic favorites marker.

**Independent Test**: Flag a bookmark for later, confirm it appears in the unread view, mark it read, and confirm it leaves the unread view while remaining in the collection with a completed reading state.

**Acceptance Scenarios**:

1. **Given** a new or existing bookmark, **When** the user flags it to read later, **Then** it is marked unread and appears in the unread view.
2. **Given** an unread bookmark, **When** the user marks it read, **Then** it no longer appears in the unread view but remains available in the collection as read.
3. **Given** a bookmark marked read, **When** the user marks it unread again, **Then** it returns to the unread view.
4. **Given** a bookmark not placed in the read-later workflow, **When** the user views unread items, **Then** that bookmark is not included.

---

### User Story 4 - Add Rich Personal Notes (Priority: P3)

As a user, I can write and format my own notes separately from the page's description so that a bookmark preserves why it matters to me.

**Why this priority**: Personal context makes saved material more valuable without slowing down basic capture.

**Independent Test**: Add a note containing headings, emphasis, a list, a quotation, a link, and inline or block code; save it, reopen it, edit it, and verify its content and formatting persist and are searchable.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user adds a personal note with supported formatting, **Then** a readable formatted version is shown and the content remains editable.
2. **Given** a saved formatted note, **When** the user returns in a later session, **Then** its text, links, structure, and formatting are preserved.
3. **Given** text that appears only in a personal note, **When** the user searches for that text, **Then** the associated bookmark can be found.
4. **Given** formatted note content that could execute or embed unsafe behavior, **When** it is displayed, **Then** the unsafe behavior is not executed while the user's readable text is retained where possible.

---

### User Story 5 - Maintain Many Bookmarks Safely (Priority: P3)

As a user, I can select multiple bookmarks, update them together, archive links without losing them, restore archived links, and permanently delete unwanted links with confirmation.

**Why this priority**: Bulk maintenance and reversible archiving keep a large collection usable while reducing accidental data loss.

**Independent Test**: Select several bookmarks, apply a tag, mark them read, archive them, locate them in the archive, restore one, and permanently delete the others after confirming the item count.

**Acceptance Scenarios**:

1. **Given** a collection or search result, **When** the user selects individual bookmarks or all visible results, **Then** the app shows the number selected and the bulk actions available for that selection.
2. **Given** multiple selected bookmarks, **When** the user adds or removes tags or marks the selection read or unread, **Then** the requested change is applied to every selected bookmark and the outcome is reported clearly.
3. **Given** one or more active bookmarks, **When** the user archives them, **Then** they disappear from the default collection and appear in the separate archive view with their saved information intact.
4. **Given** one or more archived bookmarks, **When** the user restores them, **Then** they return to the default collection with their tags, notes, and reading state unchanged.
5. **Given** one or more selected bookmarks, **When** the user requests permanent deletion, **Then** the app identifies how many bookmarks will be permanently removed and requires explicit confirmation.
6. **Given** a permanent-deletion confirmation, **When** the user confirms, **Then** all selected bookmarks are removed and cannot be restored through the app; when the user cancels, all are retained unchanged.
7. **Given** a bulk operation that cannot be completed for every selected bookmark, **When** the operation finishes, **Then** the app distinguishes successful and unsuccessful items and offers a retry for the unsuccessful items where possible.

### Edge Cases

- Leading and trailing whitespace in submitted addresses, titles, descriptions, and tag names is ignored.
- Addresses without an explicit web scheme are normalized to a secure web address when unambiguous; unsupported or unsafe schemes are rejected.
- Page-detail retrieval can encounter unreachable pages, redirects, authentication walls, missing metadata, oversized responses, or slow responses; none of these conditions prevents the user from saving a valid address.
- Changing an address on an existing bookmark prompts retrieval of details for the new destination but never silently overwrites title or description text the user has edited.
- A duplicate check treats equivalent normalized addresses as the same destination and includes archived bookmarks.
- Titles, descriptions, notes, addresses, and tags that exceed their stated limits are identified before data is discarded.
- Tags differing only by capitalization or surrounding whitespace are treated as the same tag; a multi-word tag can be targeted by quoting its name.
- A bookmark can be saved without a page description, personal note, or tags, but always receives a non-empty title automatically or from a user edit.
- Search operators written inside a quoted phrase are treated as text rather than commands.
- Search and filtering operate within the current active or archived view; archived bookmarks do not appear in default collection or unread-view results.
- A bookmark retains its read-later state while archived, and that state becomes visible again if the bookmark is restored.
- Changing filters after making a selection does not silently apply bulk actions to hidden items; the app clearly identifies whether selection is retained or cleared.
- If saved data cannot be loaded or a change cannot be persisted, the user sees a non-destructive error and can retry; the interface does not claim the operation succeeded.
- A newly created account, an empty archive, an empty unread queue, and a search with no matches each show a distinct, actionable empty state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let a user create an account, sign in, sign out, and regain access through a standard account-recovery flow.
- **FR-002**: The system MUST keep each user's bookmark collection private and prevent users from viewing or changing another user's bookmarks.
- **FR-003**: Users MUST be able to begin saving a bookmark by entering only a valid web address.
- **FR-004**: For each valid public web address, the system MUST attempt to retrieve and propose the page title, a short page description, and the site's icon before the bookmark is saved.
- **FR-005**: If a page title cannot be retrieved, the system MUST derive a non-empty title from the destination so the user is never required to type a title merely to save a valid address.
- **FR-006**: Users MUST be able to edit the proposed title and page description before saving and edit them again later; a user's edits MUST NOT be silently replaced by later page-detail retrieval.
- **FR-007**: The system MUST clearly report unavailable page details and MUST allow a valid bookmark to be saved when some or all details cannot be retrieved.
- **FR-008**: The system MUST accept secure and non-secure public web addresses, normalize unambiguous addresses that omit a scheme, and reject unsupported or unsafe address schemes.
- **FR-009**: The system MUST preserve bookmarks and all their saved attributes across sessions until the user changes or permanently deletes them.
- **FR-010**: The system MUST detect equivalent normalized addresses already present in the user's active or archived collection, warn the user, avoid creating a duplicate, and take the user to the existing bookmark.
- **FR-011**: The default collection MUST display each bookmark's title, destination domain, site icon, tags, reading state, and date saved; the full address, page description, and personal notes MUST be available from the bookmark's details.
- **FR-012**: Users MUST be able to open a saved bookmark while retaining their current bookmark-collection context.
- **FR-013**: Users MUST be able to add and remove tags on bookmarks, and tag names MUST be normalized for surrounding whitespace and capitalization when determining uniqueness.
- **FR-014**: Users MUST be able to write and edit personal notes separately from the retrieved page description.
- **FR-015**: Personal notes MUST support headings, bold and italic emphasis, ordered and unordered lists, quotations, links, and inline and block code, with both editable and readable formatted views.
- **FR-016**: The system MUST display formatted personal notes without allowing note content to execute scripts, load active embedded content, or otherwise perform actions merely by being viewed.
- **FR-017**: Users MUST be able to flag a bookmark to read later, which gives it an unread state, and MUST be able to mark it read, mark it unread again, or remove it from read-later tracking.
- **FR-018**: Users MUST be able to view only unread, non-archived bookmarks.
- **FR-019**: Ordinary search terms MUST be matched case-insensitively against titles, addresses, page descriptions, personal notes, and tags, with adjacent ordinary terms treated as `AND`.
- **FR-020**: Search MUST support direct tag qualification using `tag:<name>`, including quoted multi-word tag names.
- **FR-021**: Search MUST support exact-phrase matching with quotation marks and Boolean `AND`, `OR`, and `NOT` operators, with evaluation order of `NOT`, then `AND`, then `OR`, and parentheses available to override that order.
- **FR-022**: The system MUST preserve a malformed search query and explain how to correct it instead of silently changing its meaning.
- **FR-023**: Users MUST be able to filter the current collection view by a single tag or reading state and MUST be able to clear active search and filter criteria.
- **FR-024**: Users MUST be able to sort the visible collection by newest saved, oldest saved, or title, with newest saved as the default.
- **FR-025**: Users MUST be able to select individual bookmarks or all bookmarks currently visible in the active view or search result, see the selection count, and clear the selection.
- **FR-026**: For selected bookmarks, users MUST be able to add or remove tags, mark items read or unread, archive or restore items where applicable, and request permanent deletion.
- **FR-027**: The system MUST report the outcome of a bulk operation, identify any items it could not update, and allow failed items to be retried when recovery is possible.
- **FR-028**: Users MUST be able to archive active bookmarks and MUST be able to browse, search, select, and restore bookmarks from a separate archive view.
- **FR-029**: Archived bookmarks MUST be excluded from the default collection and unread view while retaining their page details, tags, notes, and reading state.
- **FR-030**: Permanent deletion, whether for one or multiple bookmarks, MUST identify the number of affected bookmarks and require explicit confirmation that the action cannot be undone.
- **FR-031**: The system MUST show actionable empty states for a new collection, the unread view, the archive, and search or filter criteria with no matches.
- **FR-032**: The system MUST provide clear validation and failure messages without discarding valid information the user has entered.
- **FR-033**: The system MUST prevent failed retrieval, save, edit, reading-state, archive, restore, bulk, or delete operations from being presented as successful and MUST offer a retry path when recovery is possible.

### Key Entities

- **User Account**: Represents an individual who owns a private bookmark collection; includes identity, access credentials or equivalent sign-in association, and account status.
- **Bookmark**: Represents a saved web destination; includes owner, normalized address, title, optional page description, optional site icon, optional rich personal note, reading state, archive state, creation date, last-updated date, and associated tags.
- **Reading State**: Represents whether a bookmark is outside read-later tracking, unread, or read, and changes as the user adds it to or progresses it through the read-later workflow.
- **Tag**: Represents a reusable label within one user's collection; includes a normalized name and relationships to any number of that user's bookmarks.
- **Selection**: Represents the current set of bookmarks chosen for one bulk action; includes the chosen bookmark identities and count but does not alter bookmarks until an action is confirmed or applied.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of first-time users can save and reopen their first bookmark by entering only its address, without assistance, in under 45 seconds.
- **SC-002**: For at least 90% of publicly accessible test pages that publish a title, description, and site icon, all published details are proposed to the user without manual entry.
- **SC-003**: Users can locate and open a known bookmark from a collection of 1,000 items in under 10 seconds using ordinary search, tag qualification, exact phrases, Boolean expressions, filters, or sorting.
- **SC-004**: For collections of up to 10,000 bookmarks, 95% of collection views, searches, filters, and sorts present usable results within 2 seconds under normal operating conditions.
- **SC-005**: Users can select and successfully update 100 bookmarks in one bulk action in under 30 seconds, excluding time spent choosing the bookmarks.
- **SC-006**: In acceptance testing, 100% of bookmark changes reported as successful—including notes, reading state, and archive state—remain correct after signing out and signing back in.
- **SC-007**: In usability testing, at least 90% of participants complete save, find, read-later, note-editing, bulk-update, archive-and-restore, and permanent-delete workflows without facilitator assistance.
- **SC-008**: In access-control testing, no user can view or modify bookmarks owned by another user.
- **SC-009**: In destructive-action testing, permanent deletion never occurs without explicit confirmation that states the affected bookmark count and irreversibility.

## Assumptions

- The initial release is a responsive web application for individual users, with an account required to keep each collection private and available across sessions.
- The product uses a conventional sign-in and account-recovery experience; the exact identity mechanism is a planning decision rather than a user-facing requirement.
- One user owns each bookmark. Shared collections, public profiles, team permissions, and real-time collaboration are outside the initial release.
- Page title, description, and site icon retrieval applies to publicly reachable web pages. Pages that require a login, block automated access, or omit metadata may yield partial details.
- The page description is information about the destination; the rich personal note is user-authored content. Users may edit both, but they remain distinct.
- The supported note formatting is intentionally bounded to headings, emphasis, lists, quotations, links, and code; arbitrary active embeds and executable content are outside scope.
- Read-later state replaces the previously proposed favorites feature; favorites are not part of this release.
- Manual bookmark entry is included. Browser extensions and third-party synchronization are outside the initial release.
- Tags, read-later state, and archiving provide the initial organization model. Folders, nested collections, automatic categorization, full page previews, and automated broken-link checking are outside the initial release.
- Importing an existing bookmark collection and exporting a portable copy are planned follow-on capabilities, not requirements for this initial release.
- A practical validation limit will be defined for title, page description, personal note, address, and tag lengths during planning and communicated to users at entry time.

## Planned Follow-on Capability

- A future release will let users import bookmarks from common browser-export formats, report duplicates and malformed entries before completion, and preserve usable folder or tag information where practical.
- A future release will let users export their bookmarks—including addresses, titles, descriptions, personal notes, tags, reading state, and archive state—in a portable format suitable for backup or migration.
- Import and export are recorded here for roadmap continuity but are not included in this specification's acceptance scenarios, requirements, or success criteria.
