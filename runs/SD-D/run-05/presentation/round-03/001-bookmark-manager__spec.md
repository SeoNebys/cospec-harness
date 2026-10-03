# Feature Specification: Bookmark Manager

**Feature Branch**: `not-created`  
**Created**: 2026-09-17  
**Last Revised**: 2026-09-17  
**Status**: Approved  
**Input**: Build a personal bookmark manager with automatic page details, strict duplicate prevention, read-later and archive workflows, formatted notes, advanced and saved searches, bulk management, standard bookmark import/export, and display preferences.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save with Automatic Details (Priority: P1)

As a user, I can paste a web address and have its title, icon, and short description or preview filled in, while retaining control to edit the text before or after saving.

**Why this priority**: Low-effort capture is the foundation of the product.

**Independent Test**: Paste a reachable address, review retrieved details, edit them, save, and reopen the destination.

**Acceptance Scenarios**:

1. **Given** a valid reachable address, **When** retrieval completes, **Then** every available title, icon, and description or preview is shown before save confirmation.
2. **Given** retrieved details, **When** the user changes the title or description and saves, **Then** the edited values are retained.
3. **Given** details are unavailable or retrieval fails, **When** the attempt ends, **Then** the outcome is explained and the user can complete the required title manually without losing the address.
4. **Given** retrieval is in progress, **When** the user chooses not to wait, **Then** they can continue manually; a later response does not overwrite their input.
5. **Given** no usable icon, **When** the bookmark is displayed, **Then** a consistent fallback icon appears.

---

### User Story 2 - Prevent Duplicates (Priority: P1)

As a user, resaving an existing link takes me to its canonical bookmark for updating rather than creating a second copy.

**Why this priority**: One record per destination prevents fragmented notes and status.

**Independent Test**: Save equivalent forms of one address and verify that only the first creates a bookmark.

**Acceptance Scenarios**:

1. **Given** an active or archived bookmark with the same normalized address, **When** it is submitted again, **Then** no bookmark is created and the existing one opens for review or editing.
2. **Given** that bookmark is archived, **When** the duplicate is submitted, **Then** its archived state is disclosed and it can be updated or restored.
3. **Given** addresses differing only by host-name case, default port, trailing root slash, or page fragment, **When** submitted, **Then** they identify the same destination.
4. **Given** addresses with distinct paths or query values, **When** submitted, **Then** they remain distinct unless otherwise normalized identically.

---

### User Story 3 - Read Later and Archive (Priority: P1)

As a user, I can filter unread items, change read status, archive items out of my main list, browse the archive, and restore items without losing them.

**Why this priority**: Reading-queue and clutter-management workflows are central to daily use.

**Independent Test**: Save an unread bookmark, mark it read, archive it, find it in the archive, and restore it with its status intact.

**Acceptance Scenarios**:

1. **Given** a newly saved or imported bookmark, **When** it appears, **Then** it is unread by default.
2. **Given** mixed states, **When** the unread view opens, **Then** only active unread bookmarks appear.
3. **Given** an active bookmark, **When** archived, **Then** it leaves main and unread views but remains in the archive.
4. **Given** an archived bookmark, **When** restored, **Then** all details and read status remain intact.

---

### User Story 4 - Search Precisely and Save Searches (Priority: P1)

As a user, I can search content using tag shorthand, exact phrases, AND, OR, exclusions, grouping, and status filters, then name and reuse useful searches.

**Why this priority**: Precise, reusable retrieval keeps a large collection useful.

**Independent Test**: Run combined queries on varied bookmarks, save one, change the collection, and confirm the saved search reevaluates against current data.

**Acceptance Scenarios**:

1. **Given** varied bookmarks, **When** unqualified words are entered, **Then** matching is case-insensitive across title, address, description, visible note text, and tags, with adjacent words treated as AND.
2. **Given** `tag:reading`, quotes, `AND`, `OR`, parentheses, or a leading minus sign, **When** searched, **Then** the results honor those conditions and the interpreted criteria are visible.
3. **Given** malformed syntax, **When** searched, **Then** the invalid portion and a correction path are shown without discarding the query.
4. **Given** valid active criteria, **When** saved under a unique name, **Then** the query, filters, status scope, and ordering can be reopened, updated, renamed, or deleted.
5. **Given** a saved search, **When** reopened, **Then** it runs against current bookmarks rather than returning a frozen list.

---

### User Story 5 - Maintain Rich Bookmark Details (Priority: P2)

As a user, I can edit details, write notes with headings, lists, and links, view those notes formatted, and permanently delete unwanted bookmarks.

**Why this priority**: Rich, maintainable context turns links into a personal reference collection.

**Independent Test**: Edit all fields, render each note format, then permanently delete after confirmation.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** valid details are edited, **Then** the changes replace prior values.
2. **Given** notes with headings, ordered or unordered lists, and links, **When** viewed, **Then** they render readably rather than as formatting symbols and remain editable.
3. **Given** unsafe embedded content, **When** saved or displayed, **Then** it cannot execute code or alter the application.
4. **Given** permanent deletion, **When** invoked, **Then** its irreversibility is clear and explicit confirmation is required.

---

### User Story 6 - Manage Many at Once (Priority: P2)

As a user, I can select visible bookmarks or every bookmark matching the current criteria, then add/remove tags, mark read/unread, archive, restore, or delete them together.

**Why this priority**: Bulk maintenance makes large collections practical.

**Independent Test**: Select all results spanning multiple pages and verify each bulk action affects only the intended items.

**Acceptance Scenarios**:

1. **Given** selected items, **When** a bulk action is available, **Then** the current affected count is shown before it runs and the completed outcome afterward.
2. **Given** more matches than are visible, **When** all matches are selected, **Then** the full matching set and count are used.
3. **Given** matches change before confirmation, **When** confirmation appears, **Then** the refreshed count is shown.
4. **Given** bulk permanent deletion, **When** invoked, **Then** the count and irreversible nature are stated and explicit confirmation is required.

---

### User Story 7 - Import and Export (Priority: P2)

As a user, I can import browser-exported HTML bookmarks and export my collection to that broadly compatible format.

**Why this priority**: Portability is required because the user already has bookmarks elsewhere.

**Independent Test**: Import a representative file with folders, invalid entries, and duplicates; review its report; export; and import the result into a representative browser.

**Acceptance Scenarios**:

1. **Given** a valid browser bookmarks file, **When** imported, **Then** supported links are added unread and folder names become tags.
2. **Given** existing or within-file duplicates, **When** imported, **Then** canonical bookmarks remain unchanged, no duplicate is created, and skipped counts are reported.
3. **Given** invalid individual entries, **When** imported, **Then** valid entries still import and added, skipped, and failed counts with reasons are reported.
4. **Given** an export, **When** completed, **Then** all active and archived bookmark titles and addresses appear in a browser-compatible HTML file, and unsupported application-specific details are disclosed.

---

### User Story 8 - Personalize Display (Priority: P3)

As a user, I can retain a default sort order, page size, and text size.

**Why this priority**: Comfort and predictability improve frequent use without blocking core workflows.

**Independent Test**: Change all preferences, start a new session, and verify them in collection views.

**Acceptance Scenarios**:

1. **Given** saved preferences, **When** a relevant view opens, **Then** they apply and persist between sessions.
2. **Given** no preferences, **When** the collection opens, **Then** defaults are newest first, 25 items, and standard text.
3. **Given** a saved search has an ordering, **When** opened, **Then** it overrides ordering for that view without changing the global default.

### Edge Cases

- Metadata retrieval can time out, be blocked, redirect, or return missing/oversized values; saving remains usable and explains the result.
- Retrieved metadata and formatted notes are untrusted and cannot execute code.
- Editing an address to an existing normalized destination is rejected and opens the canonical bookmark.
- Archived bookmarks participate in duplicate detection but are excluded from main and unread views.
- Tags ignore case and surrounding whitespace.
- Invalid or unreadable import files add nothing; partially valid files produce a detailed partial-import report.
- Bulk actions handle zero, one, or all 10,000 supported bookmarks and never silently use a stale match count.
- Search handles punctuation, escaped quotes, empty groups, and conflicting conditions with actionable feedback.
- Unavailable destinations do not alter saved bookmarks.
- Oversized fields, files, or tag lists are rejected at documented limits without losing valid entered content.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to begin saving with a valid `http` or `https` address.
- **FR-002**: The system MUST attempt to retrieve and prefill every available page title, icon, and short description or preview before confirmation.
- **FR-003**: Users MUST be able to override retrieved text before saving and edit address, title, description, notes, tags, and read state afterward.
- **FR-004**: A valid address and non-empty title are required; retrieval failure MUST NOT prevent manual completion.
- **FR-005**: The system MUST retain original and normalized addresses, title, optional icon and description, formatted notes, tags, read/archive states, and created/updated dates between sessions.
- **FR-006**: At most one bookmark per normalized destination MUST exist across active and archived states.
- **FR-007**: A duplicate save or address edit MUST create no duplicate and MUST open the canonical bookmark, disclosing archived state where relevant.
- **FR-008**: Normalization MUST ignore host case, default ports, trailing root slash, and fragments while preserving meaningful path and query differences.
- **FR-009**: New and imported bookmarks MUST default to unread; users MUST be able to mark read/unread and view active unread items only.
- **FR-010**: Users MUST be able to archive, browse archived items, and restore them without losing details or read state.
- **FR-011**: Permanent deletion from active or archived state MUST require explicit confirmation identifying irreversibility and count.
- **FR-012**: Notes MUST support authoring and readable display of headings, ordered/unordered lists, and links.
- **FR-013**: Notes and retrieved content MUST be treated as untrusted and MUST NOT execute code or alter the application.
- **FR-014**: Unqualified search MUST case-insensitively cover titles, displayed addresses, descriptions, visible note text, and tags; adjacent terms mean AND.
- **FR-015**: Search MUST support `tag:value`, quoted phrases, `AND`, `OR`, parentheses, leading-minus exclusion, and read/unread plus active/archived scopes.
- **FR-016**: Search MUST show interpreted criteria and retain malformed queries while identifying the invalid portion and correction.
- **FR-017**: Users MUST be able to uniquely name, open, rename, update, and delete saved combinations of query, filters, status scope, and ordering.
- **FR-018**: Saved searches MUST evaluate current data rather than frozen results.
- **FR-019**: Users MUST be able to select visible items or all current matches, including other pages.
- **FR-020**: Bulk actions MUST add/remove tags, mark read/unread, archive, restore, and permanently delete where applicable.
- **FR-021**: Bulk actions MUST show a refreshed affected count before execution and report changed and failed counts afterward; permanent deletion requires confirmation.
- **FR-022**: Import MUST accept browser-exported HTML bookmarks, convert folder names to tags, prevent duplicates, continue past invalid entries, and report added/skipped/failed counts with reasons.
- **FR-023**: An unreadable or unsupported import MUST add nothing and provide an actionable error.
- **FR-024**: Export MUST include active and archived bookmark titles and addresses in browser-compatible HTML and disclose details the format cannot represent.
- **FR-025**: Opening a bookmark MUST not remove or otherwise change it.
- **FR-026**: Collection entries MUST communicate title, destination, icon/fallback, tags, read state, relevant archive state, and creation date.
- **FR-027**: Ordering MUST support newest, oldest, title ascending/descending, and most recently updated.
- **FR-028**: Users MUST be able to retain a default sort, page size of 10/25/50/100, and small/standard/large text.
- **FR-029**: Empty-collection and no-match states MUST be distinct and offer appropriate next actions.
- **FR-030**: Validation and operation feedback MUST be actionable and MUST NOT discard valid entered content.
- **FR-031**: During a session, current query, filters, scope, ordering, page, and selection MUST persist through non-navigational actions unless made inapplicable by the action.

### Scope Boundaries

The first release includes one personal collection; automatic title, icon, and description/preview retrieval; strict deduplication; rich notes; tags; read and archive states; expressive and saved searches; individual and bulk maintenance; browser HTML import/export; and display preferences.

It excludes accounts, sync, sharing, collaboration, in-app folders, browser extensions, link-health monitoring, offline page copies, full-text search of destination pages, and guaranteed preservation of application-specific data in formats unable to represent it.

### Key Entities

- **Bookmark**: One canonical destination with addresses, page details, notes, tags, states, and timestamps.
- **Tag**: A reusable, case-insensitive label associated with bookmarks.
- **Saved Search**: A named query, filter, scope, and ordering combination evaluated against current bookmarks.
- **Display Preferences**: Retained default ordering, page size, and text size.
- **Collection View**: Current criteria, page, and selection used for presentation and actions.
- **Import Result**: Added, duplicate, and failed counts with explanatory reasons.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For pages exposing usable details, at least 95% of saves populate every available title, icon, and description/preview; 90% complete retrieval within 3 seconds under normal network conditions.
- **SC-002**: At least 90% of first-time users can paste, review, and save a link unaided in under 45 seconds.
- **SC-003**: 100% of duplicate attempts covered by documented normalization rules open the existing bookmark and create none.
- **SC-004**: A known item among 10,000 bookmarks can be found with expressive or saved search in under 10 seconds.
- **SC-005**: For 10,000 bookmarks, 95% of searches, filters, sorts, and page changes complete visibly within 1 second under normal conditions.
- **SC-006**: A bulk action on up to 10,000 matches reports a complete outcome within 10 seconds and changes no unselected bookmark.
- **SC-007**: A valid 10,000-link browser file imports with accurate counts, and the exported collection imports into a representative common browser.
- **SC-008**: All accepted content changes, states, saved searches, and preferences remain after ending and starting a new session.
- **SC-009**: At least 90% of usability participants complete save, unread, archive/restore, expressive search, bulk tag, saved search, import, and export journeys on their first unaided attempt.

## Assumptions

- This is a single-user personal application; accounts, permissions, sharing, and synchronization are out of scope.
- “Standard” import/export means browser-exported HTML accepted by major browsers. Imported nested folder names become case-insensitive tags because folders are otherwise excluded.
- Only `http` and `https` destinations are supported.
- Metadata depends on what a destination exposes and permits. A short preview is page-provided summary text; generating summaries from full page content is excluded.
- Note formatting is limited to headings, ordered/unordered lists, and links; executable or arbitrary embedded content is excluded.
- Search operators ignore case; `AND` precedes `OR`; leading minus negates the next term/group; parentheses override precedence.
- The supported collection and maximum bulk selection are 10,000 bookmarks.
- Exact safe field, file, and tag limits will be chosen during planning, clearly surfaced, and high enough for ordinary collections.
- Import adds without replacing existing data and never overwrites a duplicate's details.
- Standard export may not preserve notes, status, saved searches, preferences, or tags in every receiving browser; limitations are disclosed before export.
- External destination availability and safety are outside the application's control.
