# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-25

**Status**: Approved (client approved 2026-09-25 after review)

**Input**: User description: "I want to build an app to save and manage
bookmarks." Revised with client corrections: import/export, rich metadata
capture, editable address, tag suggestions, advanced search, sorting, separate
read-later and archive states, bulk actions, reusable saved views, formatted
notes, local + Internet Archive page copies, and display preferences.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark with rich metadata (Priority: P1)

A person finds a web page worth keeping and saves it by entering its address.
The app collects the page's title, description, site icon, and preview image
where possible, and lets the person review and edit those details before or
after saving.

**Why this priority**: Saving a link with recognizable details is the core
reason the product exists. This alone is a usable MVP.

**Independent Test**: Enter a URL, see the fetched title/description/icon/
preview, adjust a field, save, and confirm the bookmark appears with the
edited details.

**Acceptance Scenarios**:

1. **Given** an empty list, **When** the user enters a valid URL, **Then** the
   app attempts to fetch the page title, description, site icon, and preview
   image and shows them for review before saving.
2. **Given** fetched details on the save form, **When** the user edits the
   title, description, or other fields and saves, **Then** the bookmark is
   stored with the edited values.
3. **Given** the save form, **When** the user submits without a URL, **Then**
   the app rejects the entry and explains an address is required.
4. **Given** the save form, **When** the user enters text that is not a valid
   web address, **Then** the app rejects the entry and explains the address is
   invalid.
5. **Given** a page whose metadata cannot be fetched, **When** the user saves,
   **Then** the bookmark is still saved using the address as the title, which
   the user can edit afterward.

---

### User Story 2 - Browse, search, and sort bookmarks (Priority: P1)

A person returns to the app to retrieve something saved earlier. They see
their bookmarks, choose how to sort them, and use a powerful search to locate a
specific one.

**Why this priority**: Saved links are worthless if they cannot be found
again. Browsing, sorting, and search make the collection usable at any size.

**Independent Test**: With several bookmarks saved, change the sort order, run
a compound search, and confirm only matching bookmarks remain, ordered as
chosen.

**Acceptance Scenarios**:

1. **Given** several saved bookmarks, **When** the user opens the app, **Then**
   all active bookmarks are listed, most recently saved first by default.
2. **Given** the list, **When** the user selects a different sort option (e.g.
   title A–Z, oldest first, most recently updated), **Then** the list reorders
   accordingly.
3. **Given** saved bookmarks, **When** the user types a search term, **Then**
   only bookmarks whose title, address, description, notes, or tags match are
   shown, ignoring capitalization.
4. **Given** the search box, **When** the user enters a `#tag` token, a quoted
   phrase, or a combination using AND, OR, NOT, and parentheses, **Then** the
   results reflect that combined query, evaluated with NOT first, then AND,
   then OR, with parentheses overriding that order.
5. **Given** the search box, **When** the user quotes an operator word such as
   `"AND"`, **Then** it is matched as a literal word rather than treated as an
   operator.
6. **Given** a search that matches nothing, **When** results are empty, **Then**
   the app shows a clear "no matches" message.
7. **Given** a bookmark in the list, **When** the user selects it, **Then** the
   app opens the original page in a new browser tab.

---

### User Story 3 - Organize bookmarks with tags (Priority: P2)

A person labels bookmarks with tags and later filters by a tag. While typing a
tag, existing tags are suggested.

**Why this priority**: Organization keeps the collection useful as it grows.
The client has chosen tags (plus saved views) instead of folders.

**Independent Test**: Add tags to a bookmark (accepting a suggested existing
tag), filter by a tag, and confirm only bookmarks carrying it appear.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user types a tag, **Then** existing tags
   matching the typed text are suggested for quick selection.
2. **Given** bookmarks with different tags, **When** the user selects a tag
   filter, **Then** only bookmarks carrying that tag are shown.
3. **Given** an active tag filter, **When** the user clears it, **Then** the
   full list returns.

---

### User Story 4 - Edit and delete bookmarks (Priority: P2)

A person corrects any of a bookmark's details — including its address — or
permanently removes a bookmark.

**Why this priority**: Maintenance keeps the collection accurate. Secondary to
creating and finding bookmarks.

**Independent Test**: Change a saved bookmark's address and title, confirm the
update persists, then permanently delete a bookmark and confirm it does not
return.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user edits its address, title,
   description, note, or tags and saves, **Then** the updated values persist
   after reload.
2. **Given** the user saves an address that already exists as a bookmark,
   **When** the save is submitted, **Then** the app opens the existing bookmark
   for editing instead of creating a duplicate or only warning.
3. **Given** a saved bookmark, **When** the user permanently deletes it and
   confirms, **Then** it is removed and does not return after reload.
4. **Given** a permanent delete action, **When** triggered, **Then** the app
   asks for confirmation, making clear this is different from archiving.

---

### User Story 5 - Import and export bookmarks (Priority: P2)

A person brings in their existing browser bookmarks and can later export their
collection back out in the usual bookmark-file format.

**Why this priority**: The client considers manual entry alone too limiting;
import removes the barrier to adopting the app, and export prevents lock-in.

**Independent Test**: Import a standard browser bookmark file and confirm its
entries appear; export and confirm the produced file re-imports with the same
bookmarks.

**Acceptance Scenarios**:

1. **Given** a standard browser bookmark file, **When** the user imports it,
   **Then** its bookmarks (address, title, and folder-derived tags where
   present) are added to the collection.
2. **Given** an import containing addresses that already exist, **When** the
   import runs, **Then** existing bookmarks are not duplicated and the user is
   told how many were added versus skipped.
3. **Given** a collection of bookmarks, **When** the user exports, **Then** the
   app produces a standard bookmark file that other browsers and the app itself
   can read back.

---

### User Story 6 - Read/unread status and archiving (Priority: P2)

A bookmark has two **independent** properties: its **read/unread status** (an
unread bookmark is one to "read later") and whether it is **archived** (hidden
from the normal lists without being deleted). A person marks bookmarks read or
unread as they work through them, and separately archives bookmarks to get them
out of the way. These two properties do not affect each other.

**Why this priority**: Independent read/unread and archived properties let the
collection stay focused while keeping items retrievable. The client requires
archiving to be reversible, clearly separate from permanent deletion, and
non-destructive to a bookmark's read/unread status.

**Independent Test**: Leave a bookmark unread and confirm it appears in the
read-later view; archive an unread bookmark, confirm it leaves the normal and
read-later views for the archive view, then restore it and confirm it is still
unread and returns to the read-later view.

**Acceptance Scenarios**:

1. **Given** an unread, unarchived bookmark, **When** the user opens the
   read-later view, **Then** the bookmark appears there.
2. **Given** a bookmark, **When** the user marks it read or unread, **Then** its
   read/unread status changes and its archived status is unaffected.
3. **Given** a bookmark, **When** the user archives it, **Then** it leaves the
   normal list and the read-later view and appears in the archive view, while
   keeping its read/unread status.
4. **Given** an archived, unread bookmark, **When** the user restores it,
   **Then** it is still unread and returns to both the normal list and the
   read-later view; restoring never silently marks it read or otherwise alters
   it.
5. **Given** the read/unread status and the archived status, **When** the user
   reviews any bookmark, **Then** the two are clearly distinct from each other
   and archiving is clearly distinct from permanent deletion.

---

### User Story 7 - Bulk actions on multiple bookmarks (Priority: P2)

A person selects several bookmarks — or all bookmarks in the current filtered
results — and applies one action to all of them at once.

**Why this priority**: Managing a large collection one item at a time is
tedious; bulk actions make maintenance practical.

**Independent Test**: Filter the list, select all results, apply a tag to the
selection, and confirm every selected bookmark now carries it.

**Acceptance Scenarios**:

1. **Given** a list of bookmarks, **When** the user selects several items or
   "select all in current results", **Then** the count of selected items is
   shown.
2. **Given** a selection, **When** the user applies add/remove tags, mark read
   or unread, archive/restore, or delete, **Then** the action is applied to
   every selected bookmark.
3. **Given** a bulk permanent delete, **When** triggered, **Then** the app asks
   for confirmation before removing the selected bookmarks.

---

### User Story 8 - Reusable saved views (Priority: P3)

A person builds a view from a search plus included and excluded tags, names it,
and reopens it later to see the same live filtered set.

**Why this priority**: Saved views replace folders as the client's primary
organizing tool for recurring needs, but the app is usable without them.

**Independent Test**: Create a saved view (a search term with one included and
one excluded tag), reopen it later, and confirm it shows the matching
bookmarks according to the current collection.

**Acceptance Scenarios**:

1. **Given** a search and included/excluded tag selections, **When** the user
   saves it as a named view, **Then** the view appears in a list of saved
   views.
2. **Given** a saved view, **When** the user opens it, **Then** the list shows
   the bookmarks currently matching that view's search and tag rules.
3. **Given** a saved view, **When** the user edits or deletes it, **Then** the
   change persists and does not alter the underlying bookmarks.

---

### User Story 9 - Local and Internet Archive copies (Priority: P3)

A person keeps a saved local copy of a bookmarked page so its content survives
even if the original changes or disappears. The copy is stored as a
self-contained HTML file (with PDFs preserved as PDFs instead), and the person
can optionally request a snapshot through the Internet Archive.

**Why this priority**: Preservation protects against link rot but is not
required for the core save/find loop.

**Independent Test**: Save a page, request a local copy, and later open that
stored copy as a single self-contained HTML file; for a PDF address, confirm
the stored copy is the PDF itself.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user requests a local copy, **Then**
   the app stores the page as a self-contained HTML file (embedding the needed
   assets) and lets the user open it later.
2. **Given** a bookmark whose address points to a PDF, **When** a local copy is
   made, **Then** the stored copy preserves the PDF as a PDF rather than HTML.
3. **Given** a saved bookmark, **When** the user requests an Internet Archive
   snapshot, **Then** the app submits the page to the Internet Archive and
   records the resulting snapshot link when available.
4. **Given** a local-copy or Internet Archive request that cannot be completed
   (page unreachable or service unavailable), **When** it fails, **Then** the
   bookmark itself is unaffected and the user is informed the copy was not made.

---

### User Story 10 - Formatted notes (Priority: P3)

A person writes a note on a bookmark using simple formatting (such as bold,
lists, and links) and sees that formatting rendered when viewing the bookmark.

**Why this priority**: Richer notes add value but are not essential to core
use.

**Independent Test**: Add a note with a bold word and a list, save, and confirm
the formatting is displayed when the bookmark is viewed.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user writes a note with simple formatting,
   **Then** the note is saved with that formatting.
2. **Given** a saved formatted note, **When** the user views the bookmark,
   **Then** the formatting is displayed as intended.

---

### User Story 11 - Display preferences (Priority: P3)

A person adjusts how the list looks — default sort order, how much information
each item shows, and text size — and the app remembers these preferences.

**Why this priority**: Comfort and readability, refined once core features
work.

**Independent Test**: Change default sort, information density, and text size;
reload the app and confirm the preferences persist and take effect.

**Acceptance Scenarios**:

1. **Given** the preferences, **When** the user sets a default sort order,
   information density, and text size, **Then** the list reflects them.
2. **Given** saved preferences, **When** the user reloads the app, **Then** the
   preferences persist and are reapplied.
3. **Given** the list, **When** a bookmark is shown, **Then** it clearly
   displays the title, description, tags, and site icon (subject to the chosen
   information density).

---

### Edge Cases

- **Duplicate on save**: Saving an existing address opens that bookmark for
  editing rather than creating a duplicate (see FR-014).
- **Duplicate on import**: Existing addresses are skipped, not duplicated, and
  the user sees an added-vs-skipped summary.
- **Missing metadata**: When a page's title, description, icon, or preview
  cannot be fetched, the app saves what it has and falls back to the address as
  the title.
- **Unreachable page**: Saving, local-copy, and Internet Archive requests fail
  gracefully without losing the bookmark; the user is informed.
- **Malformed search query**: An unbalanced quote or parenthesis produces a
  clear message rather than wrong or empty results silently.
- **Literal operator words**: An operator word (AND/OR/NOT) is treated as a
  literal term only when quoted; unquoted, it acts as an operator per the
  precedence rules.
- **Large collection**: The list, search, sort, and bulk selection remain
  responsive with many hundreds of bookmarks.
- **Very long title/description/address**: Long text is truncated for display
  while the full value is preserved.
- **Malformed or partial import file**: Recognizable entries are imported and
  unreadable ones are reported rather than aborting the whole import.

## Requirements *(mandatory)*

### Functional Requirements

**Saving & metadata**

- **FR-001**: System MUST let a user save a bookmark by providing a web address
  (URL), validating it and rejecting empty or malformed entries with a clear
  message.
- **FR-002**: On entry of an address, System MUST attempt to fetch the page's
  title, description, site icon, and preview image, and present them for review.
- **FR-003**: Users MUST be able to edit the title, description, tags, note,
  icon/preview association, and the address itself, both before and after
  saving, with changes persisted.
- **FR-004**: When metadata cannot be fetched, System MUST still save the
  bookmark, using the address as the title fallback.
- **FR-005**: System MUST store, per bookmark, its address, title, description,
  formatted note, tags, site icon, preview image reference, a read/unread status
  and an archived status as **two independent properties**, date saved, and date
  last updated.

**Browse, search & sort**

- **FR-006**: Users MUST be able to view the normal list (unarchived
  bookmarks), the read-later view (unread, unarchived bookmarks), and the
  archive view (archived bookmarks, regardless of read/unread status).
- **FR-007**: Users MUST be able to sort the list by multiple options,
  including most recently saved (default), oldest, title A–Z/Z–A, and most
  recently updated.
- **FR-008**: System MUST provide case-insensitive search across title,
  address, description, notes, and tags.
- **FR-009**: Search MUST support `#tag` tokens, quoted phrases matched exactly,
  and boolean composition with AND, OR, NOT, and parentheses. Operator
  precedence MUST be NOT first, then AND, then OR, with parentheses overriding
  that order. Operator words that are quoted (e.g. `"AND"`) MUST be treated as
  literal search terms, not operators. Malformed queries MUST be reported
  clearly.
- **FR-010**: Users MUST be able to open a bookmarked page in a new browser tab
  from the list.
- **FR-011**: System MUST show clear empty and "no matches" states.

**Tags & views**

- **FR-012**: Users MUST be able to add, change, and remove tags, with existing
  tags suggested as they type.
- **FR-013**: Users MUST be able to filter by included and excluded tags and to
  clear the filter.
- **FR-014**: Users MUST be able to save a search plus included/excluded tags
  as a named, reusable view, and to open, edit, and delete such views; views
  reflect the current collection and do not alter bookmarks.

**Editing, read/unread, archiving & deletion**

- **FR-015**: When a user saves an address that already exists, System MUST
  open the existing bookmark for editing rather than duplicating or only
  warning.
- **FR-016**: Users MUST be able to toggle a bookmark's read/unread status
  independently of its archived status. An unread bookmark is treated as "read
  later".
- **FR-017**: Users MUST be able to archive a bookmark (hiding it from the
  normal list and the read-later view) and to restore it. Archiving and
  restoring MUST NOT change the bookmark's read/unread status or any other
  field: a restored bookmark returns exactly as it was, including remaining
  unread and thus reappearing in the read-later view. Archiving MUST be
  reversible and distinct from permanent deletion.
- **FR-018**: Users MUST be able to permanently delete a bookmark, with a
  confirmation step that makes clear it differs from archiving.

**Bulk actions**

- **FR-019**: Users MUST be able to select multiple bookmarks or all bookmarks
  in the current filtered results, with the selected count shown.
- **FR-020**: Users MUST be able to apply to a selection: add/remove tags, mark
  read/unread, archive/restore, and permanent delete (with confirmation).

**Import & export**

- **FR-021**: Users MUST be able to import a standard browser bookmark file,
  mapping entries to bookmarks and deriving tags from source folders where
  present, skipping addresses that already exist and reporting an added-vs-
  skipped summary.
- **FR-022**: Users MUST be able to export the collection to a standard
  bookmark file that browsers and this app can read back.

**Page preservation**

- **FR-023**: Users MUST be able to request a saved local copy of a bookmarked
  page and open it later; the copy MUST be stored as a self-contained HTML file
  (embedding needed assets), except that PDF addresses MUST be preserved as
  PDFs rather than HTML.
- **FR-024**: Users MUST be able to request an Internet Archive snapshot of a
  page, with the resulting snapshot link recorded when available.
- **FR-025**: When a local-copy or Internet Archive request fails, System MUST
  leave the bookmark intact and inform the user the copy was not made.

**Notes & display**

- **FR-026**: Notes MUST support simple formatted text (such as bold, lists,
  and links) and display that formatting when the bookmark is viewed.
- **FR-027**: The list MUST clearly show each bookmark's title, description,
  tags, and site icon, subject to the chosen information density.
- **FR-028**: Users MUST be able to set display preferences — default sort
  order, information density, and text size — and System MUST persist and
  reapply them across sessions.

**Persistence**

- **FR-029**: System MUST persist all bookmarks, tags, saved views, page
  copies, and preferences durably so they remain available across sessions and
  app restarts.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved reference to a web page. Attributes: address, title,
  description, formatted note, site icon, preview image reference, tags, a
  read/unread status and an archived status (two **independent** properties),
  date saved, date last updated, links to any local copy and Internet Archive
  snapshot. Uniquely identified; unique by address within the collection.
  (The read-later view is derived: unread and unarchived bookmarks.)
- **Tag**: A short text label. Many-to-many with bookmarks.
- **Saved View**: A named, reusable filter defined by a search query plus
  included and excluded tags. References tags/queries, not fixed bookmark sets.
- **Page Copy**: A stored local capture of a page's content (HTML/document or
  preserved PDF) linked to a bookmark.
- **Archive Snapshot**: A reference (link) to an Internet Archive capture of a
  page, linked to a bookmark.
- **Preferences**: The single user's display settings — default sort,
  information density, text size.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save their first bookmark, with fetched metadata shown
  for review, in under 30 seconds from opening the app.
- **SC-002**: A user can locate a specific bookmark among at least 500 saved
  bookmarks in under 10 seconds using search, sort, tag filter, or a saved
  view.
- **SC-003**: Search, sort, and filter results update within 1 second of the
  user's input for a collection of at least 500 bookmarks.
- **SC-004**: 100% of saved bookmarks, tags, saved views, and preferences
  remain available after the app is closed and reopened.
- **SC-005**: A user can import a standard browser bookmark file of at least
  500 entries and see the imported bookmarks, with an added-vs-skipped summary,
  in under 1 minute.
- **SC-006**: An exported file re-imports into the app (or another browser)
  reproducing the same bookmarks with no loss of address or title.
- **SC-007**: A user can select all bookmarks in a filtered result and apply a
  bulk action to them in under 15 seconds.
- **SC-008**: 90% of first-time users successfully save, organize with a tag,
  and re-find a bookmark without external help.

## Assumptions

- **Single user, no login (v1)**: The app serves one person's personal
  collection; multi-user accounts, authentication, and sharing are out of scope
  for v1. (Confirmed by client.)
- **Web application**: Delivered as a web app accessed through a browser,
  consistent with the project's runtime presentation environment.
- **Standard bookmark file format**: Import/export use the common
  browser-exported bookmark file format that mainstream browsers read and
  write; source folder names are mapped to tags on import.
- **Best-effort metadata and preservation**: Fetching page metadata, making
  local copies, and Internet Archive snapshots depend on the target page and
  external service being reachable; failures are handled gracefully without
  affecting the bookmark. Internet Archive is an external dependency and may be
  unavailable.
- **Simple formatted notes**: Notes use a lightweight formatting vocabulary
  (e.g. bold, italics, lists, links); full rich-document editing is out of
  scope.
- **Local copy scope**: A local copy captures the page's readable content and
  preserves PDF documents as PDFs; perfectly faithful capture of highly dynamic
  or login-gated pages is best-effort.
- **Folders excluded**: Per client direction, folders are not implemented;
  tags plus reusable saved views provide organization.
- **Modern browser**: Users access the app on a current desktop or mobile web
  browser with JavaScript enabled.
