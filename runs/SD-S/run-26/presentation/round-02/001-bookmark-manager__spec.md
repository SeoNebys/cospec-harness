# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: "I want to build an app to save and manage bookmarks." Plus refinements: automatic page details on save (title, description, favicon, preview image) with editable title/description; read-later status and unread view; reversible archiving with an archive view distinct from deletion; sorting by date added and title; duplicate addresses open the existing bookmark for editing; tags only (no folders/favorites); standard import/export in v1; saved notes; preserved page snapshot including keeping PDFs as PDFs. No accounts, no ongoing link-health checks.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark with automatic page details (Priority: P1)

A person finds a web page (or PDF) they want to keep and saves it by providing
its address. The app automatically fetches the page's details — title,
description, favicon, and a preview image — so the bookmark is rich without
manual effort, while the person can still edit the title and description.

**Why this priority**: Saving links with useful, automatically populated details
is the core reason the app exists. This single story is a usable product on its
own.

**Independent Test**: Enter a web address, save it, and confirm a new bookmark
appears showing an auto-filled title, description, favicon, and preview image;
then edit the title and description and confirm the edits persist.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user submits a valid web
   address, **Then** a new bookmark is created showing an automatically fetched
   title, description, favicon, and preview image where available.
2. **Given** a saved bookmark with auto-filled details, **When** the user edits
   the title and/or description and saves, **Then** the edited values are shown
   and persist across sessions.
3. **Given** the user submits an entry that is not a valid web address, **When**
   they try to save, **Then** the app rejects it with a clear message and saves
   nothing.
4. **Given** a page whose details cannot be fetched (unreachable or missing
   metadata), **When** the bookmark is saved, **Then** the app still saves it
   with a title derived from the address and leaves missing details empty for the
   user to fill in.

---

### User Story 2 - Preserve a snapshot of the saved page (Priority: P1)

When a bookmark is saved, the app captures and stores a snapshot of the page as
it was at that moment, so the content remains available even if the original page
later changes or disappears. Pages saved as PDFs are preserved as PDFs.

**Why this priority**: Preserving content, not just a link, is a defining
promise of this app and central to its value. It is captured at save time using
the same fetch as Story 1.

**Independent Test**: Save a normal web page and open its stored snapshot to
confirm the captured content is viewable; save a PDF address and confirm the
stored snapshot is the PDF, viewable as a PDF.

**Acceptance Scenarios**:

1. **Given** a valid web-page address, **When** the bookmark is saved, **Then** a
   snapshot of the page content is captured and can be reopened later from the
   bookmark.
2. **Given** an address that points to a PDF, **When** the bookmark is saved,
   **Then** the snapshot is preserved as a PDF and reopens as a PDF.
3. **Given** a page whose snapshot cannot be captured, **When** the bookmark is
   saved, **Then** the bookmark is still created and clearly indicates that no
   snapshot is available.

---

### User Story 3 - Browse, sort, and find saved bookmarks (Priority: P2)

A person with many saved bookmarks locates a specific one quickly by searching
text, filtering by a tag, and sorting the list — at least by date added and by
title.

**Why this priority**: As the collection grows, finding and ordering links
matters almost as much as saving them. It builds directly on the saved data from
Stories 1–2.

**Independent Test**: With several bookmarks saved, type a keyword and confirm
only matching bookmarks show; select a tag and confirm filtering; change the sort
to "title" and to "date added" and confirm the order changes accordingly.

**Acceptance Scenarios**:

1. **Given** multiple saved bookmarks, **When** the user types a keyword,
   **Then** only bookmarks whose title, address, description, notes, or tags
   match are shown.
2. **Given** bookmarks with tags, **When** the user selects a tag, **Then** only
   bookmarks carrying that tag are shown.
3. **Given** multiple saved bookmarks, **When** the user chooses a sort option,
   **Then** the list reorders by date added (newest/oldest) or by title
   (A–Z/Z–A) as selected.
4. **Given** a search or filter with no matches, **When** results are computed,
   **Then** the app shows an empty-result message rather than an error.

---

### User Story 4 - Read-later status and unread view (Priority: P2)

A person marks bookmarks as "to read later" and switches to a dedicated unread
view to focus on what they have not yet read, marking items read as they go.

**Why this priority**: Turns a pile of saved links into an actionable reading
queue, a primary way people manage bookmarks day to day.

**Independent Test**: Mark a bookmark as unread, open the unread view and confirm
it appears there; mark it read and confirm it leaves the unread view.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user marks it as read-later
   (unread), **Then** it appears in the unread view.
2. **Given** an unread bookmark, **When** the user marks it as read, **Then** it
   is removed from the unread view but remains in the full list.
3. **Given** the unread view, **When** the user opens it, **Then** only unread
   bookmarks are shown.

---

### User Story 5 - Notes on a bookmark (Priority: P2)

A person adds their own free-form notes to a bookmark to record why they saved it
or what to remember about it, and edits those notes later.

**Why this priority**: Personal context makes a saved collection far more useful
and is searchable alongside other fields.

**Independent Test**: Add a note to a bookmark, save, and confirm it persists and
is found by searching its text.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user adds or edits a note and saves,
   **Then** the note persists and is shown with the bookmark.
2. **Given** a bookmark with a note, **When** the user searches for text in the
   note, **Then** the bookmark appears in the results.

---

### User Story 6 - Reversible archiving, distinct from deletion (Priority: P2)

A person clears finished or inactive bookmarks out of their main list by
archiving them. Archived bookmarks live in a separate archive view and can be
restored at any time. Permanent deletion is a separate, explicit action.

**Why this priority**: Lets people declutter without losing anything, while still
allowing intentional permanent removal.

**Independent Test**: Archive a bookmark and confirm it leaves the main list and
appears in the archive view; restore it and confirm it returns; separately,
delete a bookmark and confirm it is permanently gone.

**Acceptance Scenarios**:

1. **Given** a bookmark in the main list, **When** the user archives it, **Then**
   it no longer appears in the main list and appears in the archive view.
2. **Given** an archived bookmark, **When** the user restores it, **Then** it
   returns to the main list.
3. **Given** a bookmark (in either view), **When** the user deletes it and
   confirms, **Then** it is permanently removed and no longer appears in any
   view.
4. **Given** a delete action, **When** the user is asked to confirm, **Then** no
   deletion occurs unless they confirm.

---

### User Story 7 - Duplicate address opens the existing bookmark (Priority: P2)

When a person saves an address they already have, the app takes them to edit the
existing bookmark instead of creating a second copy.

**Why this priority**: Prevents accidental duplicates and keeps the collection
clean; a common frustration with bookmark tools.

**Independent Test**: Save an address, then submit the same address again and
confirm the app opens the existing bookmark for editing rather than creating a
new one.

**Acceptance Scenarios**:

1. **Given** a bookmark already exists for an address, **When** the user submits
   the same address, **Then** the app opens the existing bookmark for editing
   and does not create a duplicate.
2. **Given** the existing bookmark is archived, **When** the user submits its
   address again, **Then** the app surfaces the existing (archived) bookmark for
   editing rather than creating a new copy.

---

### User Story 8 - Import and export bookmarks (Priority: P3)

A person brings in an existing collection from another tool and can later export
their collection to take it elsewhere, using a standard bookmark format.

**Why this priority**: Enables adoption (bring your links in) and avoids lock-in
(take them out), but the app is already valuable for saving and managing before
this is added.

**Independent Test**: Import a standard bookmark file and confirm the entries
appear as bookmarks; export and confirm the resulting file contains the current
collection in a standard format.

**Acceptance Scenarios**:

1. **Given** a standard bookmark export file from another tool, **When** the user
   imports it, **Then** its entries are added as bookmarks (address, title, and
   tags/folders mapped to tags where present).
2. **Given** imported addresses that already exist, **When** the import runs,
   **Then** existing bookmarks are not duplicated.
3. **Given** a collection of bookmarks, **When** the user exports, **Then** a
   standard-format file is produced containing the collection.

---

### Edge Cases

- What happens when the same address is submitted twice? The app opens the
  existing bookmark for editing instead of creating a duplicate (Story 7).
- How does the system handle a page with no fetchable metadata or preview image?
  It saves the bookmark with a title derived from the address and leaves missing
  details empty for the user to complete.
- What happens when a snapshot cannot be captured (unreachable, blocked, or too
  large)? The bookmark is still saved and clearly marked as having no snapshot.
- How does the system handle a very long title, address, or note? It stores the
  full value and displays it truncated without breaking the layout.
- What happens when an imported file is malformed or partially invalid? The app
  imports the valid entries, skips the invalid ones, and reports how many of each.
- How does the system behave when there are zero bookmarks, zero unread, or zero
  archived items? Each view shows a friendly empty state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to create a bookmark by providing a web
  address, with optional user-supplied title, description, notes, and one or more
  tags.
- **FR-002**: System MUST validate that the submitted address is a well-formed
  web address and reject invalid entries with a clear message.
- **FR-003**: On save, System MUST automatically fetch and store the page's
  title, description, favicon, and preview image where available.
- **FR-004**: System MUST allow the user to edit the title and description
  (whether auto-filled or user-supplied).
- **FR-005**: When page details cannot be fetched, System MUST still save the
  bookmark, derive a title from the address, and leave missing details empty for
  the user to fill in.
- **FR-006**: On save, System MUST capture and store a snapshot of the page
  content as it was at save time, and allow the user to reopen that snapshot
  later.
- **FR-007**: System MUST preserve PDF pages as PDFs in the snapshot and reopen
  them as PDFs.
- **FR-008**: When a snapshot cannot be captured, System MUST still save the
  bookmark and clearly indicate that no snapshot is available.
- **FR-009**: System MUST persist all bookmark data (including notes, status,
  tags, and snapshots) so it remains available across sessions and restarts.
- **FR-010**: System MUST display bookmarks in a list showing at least the title,
  address, favicon, tags, and read/unread status.
- **FR-011**: Users MUST be able to search bookmarks by keyword matching title,
  address, description, notes, or tags.
- **FR-012**: Users MUST be able to filter bookmarks by a selected tag.
- **FR-013**: Users MUST be able to sort bookmarks at least by date added and by
  title, in ascending and descending order.
- **FR-014**: Users MUST be able to mark a bookmark as read-later (unread) or
  read, and view a dedicated unread view containing only unread bookmarks.
- **FR-015**: Users MUST be able to add and edit free-form notes on a bookmark.
- **FR-016**: Users MUST be able to archive a bookmark (removing it from the main
  list) and view a dedicated archive view; archiving MUST be reversible via a
  restore action.
- **FR-017**: Users MUST be able to permanently delete a bookmark as a separate,
  explicit action with a confirmation step.
- **FR-018**: When a user submits an address that already exists, System MUST open
  the existing bookmark for editing instead of creating a duplicate, including
  when the existing bookmark is archived.
- **FR-019**: Users MUST be able to open a bookmarked address in their browser
  from the list.
- **FR-020**: Users MUST be able to import bookmarks from a standard bookmark
  file, mapping addresses, titles, and any folders/tags to tags, without creating
  duplicates of addresses that already exist.
- **FR-021**: Users MUST be able to export their collection to a standard
  bookmark file.
- **FR-022**: On malformed or partially invalid import, System MUST import valid
  entries, skip invalid ones, and report the counts of each.
- **FR-023**: System MUST show clear empty states for an empty collection, an
  empty unread view, an empty archive view, and empty search/filter results.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved, content-preserving reference to a web page or PDF.
  Attributes: address; title (auto or edited); description (auto or edited);
  favicon; preview image; user notes; set of tags; read/unread status;
  archived/active status; reference to the stored page snapshot; snapshot type
  (e.g., web page or PDF) and availability; creation timestamp; last-updated
  timestamp.
- **Tag**: A short user-defined label used to group and filter bookmarks. A
  bookmark may carry many tags; a tag may apply to many bookmarks.
- **Snapshot**: The stored copy of a bookmark's page content captured at save
  time, viewable later; preserves PDFs as PDFs.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark in under 20 seconds from opening the
  add form to seeing it in the list with auto-fetched details.
- **SC-002**: For reachable pages that expose standard metadata, auto-fetched
  title and description are populated at least 90% of the time.
- **SC-003**: A user can locate a specific bookmark among 100+ saved items in
  under 10 seconds using search, tag filtering, or sorting.
- **SC-004**: A saved snapshot can be reopened and viewed for 100% of bookmarks
  that report an available snapshot; PDFs reopen as PDFs.
- **SC-005**: Saved bookmarks and their notes, status, tags, and snapshots are
  still present after closing and reopening the app 100% of the time.
- **SC-006**: Submitting an already-saved address opens the existing bookmark for
  editing and creates zero duplicates 100% of the time.
- **SC-007**: Archived bookmarks can be restored to the main list 100% of the
  time; permanent deletion removes them from all views 100% of the time.
- **SC-008**: A standard bookmark file exported by the app can be re-imported
  with the collection intact and no duplicates created.

## Assumptions

- This is a single-user application for v1; multi-user accounts, sharing, and
  authentication are out of scope.
- The app is a web application reviewed through a browser.
- Bookmarks, notes, and snapshots are stored locally to the application's own
  storage; no external bookmark service (e.g., browser sync) integration is
  required for v1.
- "Standard bookmark format" for import/export refers to the widely used HTML
  bookmark file that browsers import and export; nested folders in such files map
  to tags on import.
- Snapshots are captured once at save time. The app does not perform ongoing
  link-health checks or re-capture pages automatically.
- Snapshot capture and detail fetching depend on the target page being reachable
  at save time and may be limited by pages that block automated access or that
  are excessively large; such cases fall back to the "no snapshot / missing
  details" behavior above.
- Organization is by tags only; folders and favorites are intentionally out of
  scope for v1.
