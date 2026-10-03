# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-24

**Status**: Approved

**Input**: User description: "An app to save and manage bookmarks"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark with page metadata (Priority: P1)

A person finds a web page worth keeping and saves it by entering its address.
The app records the page and, when available, automatically collects its title,
description, site icon (favicon), and a preview image so the saved item is
recognizable at a glance. The user can adjust the title and description both while saving and afterward.

**Why this priority**: Saving links with useful, recognizable detail is the core
reason the app exists. This alone is a usable product.

**Independent Test**: Add a bookmark by entering a URL and confirm it appears in
the saved list with its fetched title, description, icon, and preview image (when
the page provides them), and that the title and description can be edited.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user submits a valid URL for a
   page that exposes metadata, **Then** the bookmark is saved and shown with its
   fetched title, description, site icon, and preview image.
2. **Given** a page that provides no title, **When** the bookmark is saved,
   **Then** the app uses the URL as the display label and leaves description,
   icon, and preview empty rather than failing.
3. **Given** the save form is open, **When** the user edits the fetched title or
   description before saving, **Then** the bookmark is saved with the edited
   values.
4. **Given** a saved bookmark, **When** the user edits its title or description
   afterward, **Then** the edited values are stored and shown in place of the
   fetched ones.
5. **Given** the normal bookmark list, **When** it is displayed, **Then** each
   item visibly shows its title, description, tags, and site icon.
6. **Given** the user submits an empty or malformed URL, **When** they try to
   save, **Then** the app rejects it with a clear message and saves nothing.

---

### User Story 2 - Open, note, and revisit bookmarks (Priority: P1)

The user selects a saved bookmark to open the original page in a new browser
context, and can attach a personal note to any bookmark for their own context. Notes
support simple Markdown formatting and are shown as formatted text.

**Why this priority**: A saved link is only useful if it reliably reopens the
original page; personal notes are how the user captures why a link mattered.

**Independent Test**: Add a note to a bookmark, confirm it persists, then select
the bookmark and confirm the original page opens.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user selects it to open, **Then** the
   original page opens in a new browser tab/window without leaving the app.
2. **Given** a saved bookmark, **When** the user writes or edits a personal note
   using simple Markdown, **Then** the note is saved, displayed as formatted
   text, and persists across reloads.

---

### User Story 3 - Edit-on-duplicate save (Priority: P1)

When the user saves a URL that is already bookmarked, the app takes them to the
existing bookmark so they can edit it, instead of creating a second copy or
merely warning them.

**Why this priority**: Prevents silent duplication and makes re-saving a natural
way to update an existing entry.

**Independent Test**: Save a URL, then save the same URL again and confirm the
app opens the existing bookmark for editing rather than creating a new one.

**Acceptance Scenarios**:

1. **Given** a URL already saved, **When** the user submits that same URL again,
   **Then** the app opens the existing bookmark in an editable view and creates
   no new bookmark.
2. **Given** the user is taken to the existing bookmark, **When** they change and
   save details, **Then** the single existing bookmark reflects the changes.

---

### User Story 4 - Advanced search across all text (Priority: P2)

The user finds saved links using case-insensitive search that matches titles,
URLs, descriptions, notes, and tags, and can build precise queries using `#tag`
terms, quoted phrases, and `AND` / `OR` / `NOT` combined with parentheses.
Terms placed side by side (including a plain word next to a `#tag`) must all
match unless explicitly joined with `OR`; an operator wrapped in quotes is
treated as ordinary search text rather than an operator.

**Why this priority**: A growing collection is only valuable if items can be
found precisely; expressive search is central to daily use.

**Independent Test**: With varied bookmarks saved, run a compound query mixing a
`#tag`, a quoted phrase, and boolean operators with parentheses, and confirm only
the correct bookmarks are returned.

**Acceptance Scenarios**:

1. **Given** bookmarks whose descriptions and notes contain a keyword, **When**
   the user searches that keyword in any letter case, **Then** all matching
   bookmarks are returned regardless of case, matching across title, URL,
   description, note, and tags.
2. **Given** a mix of tagged bookmarks, **When** the user searches `#news`,
   **Then** only bookmarks tagged `news` are returned.
3. **Given** the query `"machine learning"`, **When** searched, **Then** only
   bookmarks containing that exact phrase (not the words separately) are returned.
4. **Given** the query `#news AND (python OR rust) NOT archived-topic`, **When**
   searched, **Then** the results honor the boolean logic and grouping.
5. **Given** the query `python #news` (a plain word beside a `#tag` with no
   operator), **When** searched, **Then** only bookmarks that match both the word
   and the tag are returned.
6. **Given** the query `python OR rust`, **When** searched, **Then** bookmarks
   matching either term are returned.
7. **Given** the query `"AND"` (an operator in quotes), **When** searched,
   **Then** it matches the literal text "AND" rather than acting as an operator.
8. **Given** the query `#news AND (python OR rust) NOT archived-topic`, **When**
   searched, **Then** the results honor the boolean logic and grouping.
9. **Given** a malformed query (e.g., unbalanced parentheses), **When** searched,
   **Then** the app reports the problem clearly instead of returning misleading
   results.
10. **Given** no bookmarks match, **When** results are shown, **Then** a clear
    empty-results message is displayed.

---

### User Story 5 - Tagging with suggestions (Priority: P2)

The user organizes bookmarks with tags and, while typing a tag, sees suggestions
drawn from existing tags so tagging stays consistent.

**Why this priority**: Consistent tags are the backbone of finding and filtering;
suggestions prevent near-duplicate tags.

**Independent Test**: Create several tags, then begin typing a tag on another
bookmark and confirm matching existing tags are suggested and can be selected.

**Acceptance Scenarios**:

1. **Given** existing tags, **When** the user types the first characters of a
   tag, **Then** matching existing tags are suggested for selection.
2. **Given** a suggested tag, **When** the user selects it, **Then** it is
   applied without creating a duplicate variant.
3. **Given** a tag that does not yet exist, **When** the user confirms it,
   **Then** a new tag is created and applied.
4. **Given** an existing tag, **When** the user types a name that matches it
   (rather than choosing the suggestion), **Then** the existing tag is reused and
   no duplicate tag is created — tag names remain unique.

---

### User Story 6 - Read-later and read state (Priority: P2)

The user marks items to read later, sees them in a separate unread view, and
marks items as read once done.

**Why this priority**: Separating "to read" from the general collection is a core
workflow for a bookmarking tool.

**Independent Test**: Mark bookmarks unread, confirm they appear in the unread
view, mark one read, and confirm it leaves the unread view.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user sets it as unread (read-later),
   **Then** it appears in the dedicated unread view.
2. **Given** an unread bookmark, **When** the user marks it read, **Then** it is
   removed from the unread view and shown as read elsewhere.
3. **Given** the unread view, **When** it is opened, **Then** it shows only
   unread, non-archived bookmarks.

---

### User Story 7 - Reversible archiving (Priority: P2)

The user archives bookmarks they want out of the way; archived items are excluded
from the normal list and normal search and appear in their own archive view,
where they can be restored.

**Why this priority**: Lets the collection stay focused without losing anything;
reversibility protects against mistakes.

**Independent Test**: Archive a bookmark, confirm it disappears from the normal
list and default search, appears in the archive view, then restore it and confirm
it returns to the normal list.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user archives it, **Then** it no longer
   appears in the normal list or default search results.
2. **Given** an archived bookmark, **When** the user opens the archive view,
   **Then** the bookmark is listed there.
3. **Given** an archived bookmark, **When** the user restores it, **Then** it
   returns to the normal list and search.

---

### User Story 8 - Bulk actions (Priority: P2)

The user selects several bookmarks, or all results in the current search/filter,
and applies an action to them together: add or remove tags, mark read or unread,
archive (or restore), or delete.

**Why this priority**: Maintaining a large collection one item at a time is
impractical; bulk actions make upkeep feasible.

**Independent Test**: Select multiple bookmarks (and separately "select all in
current results"), apply a tag addition and an archive to the selection, and
confirm every selected item changed.

**Acceptance Scenarios**:

1. **Given** several selected bookmarks, **When** the user adds or removes a tag
   in bulk, **Then** the change applies to every selected bookmark.
2. **Given** an active search/filter, **When** the user chooses "select all
   results" and marks them read, **Then** all matching bookmarks are marked read.
3. **Given** a bulk delete, **When** the user confirms, **Then** all selected
   bookmarks are removed after a single confirmation.

---

### User Story 9 - Sorting options (Priority: P3)

The user orders the list by more than newest-first — for example oldest-first,
title, or last-updated.

**Why this priority**: Improves browsing but the collection is usable with the
default order alone.

**Acceptance Scenarios**:

1. **Given** several bookmarks, **When** the user chooses a sort option,
   **Then** the list reorders accordingly and the choice is reflected immediately.
2. **Given** no explicit choice, **When** the list loads, **Then** it uses the
   user's default sort preference (newest-first out of the box).

---

### User Story 10 - Saved reusable filters (Priority: P3)

The user saves a named filter built from search terms plus included and excluded
tags, and reapplies it later in one step.

**Why this priority**: Speeds up recurring views but is a convenience over the
core search.

**Acceptance Scenarios**:

1. **Given** a search with included and excluded tags, **When** the user saves it
   as a named filter, **Then** the filter is stored and listed for reuse.
2. **Given** a saved filter, **When** the user applies it, **Then** the list
   shows exactly the bookmarks matching its terms and tag include/exclude rules.
3. **Given** a saved filter, **When** the user deletes it, **Then** it is removed
   from the list of saved filters (existing bookmarks are unaffected).

---

### User Story 11 - Import and export (browser HTML format) (Priority: P3)

The user imports bookmarks from, and exports them to, the standard browser
bookmark HTML format, preserving titles, tags, and dates.

**Why this priority**: Protects the user's investment and enables migration, but
the app works without it.

**Acceptance Scenarios**:

1. **Given** a standard browser bookmark HTML file, **When** the user imports it,
   **Then** bookmarks are created with their titles, tags, and dates preserved.
2. **Given** a collection of bookmarks, **When** the user exports, **Then** a
   standard browser bookmark HTML file is produced with titles, tags, and dates
   preserved.
3. **Given** an import containing URLs already saved, **When** it runs, **Then**
   existing bookmarks are updated/merged rather than duplicated.
4. **Given** a malformed or non-bookmark file, **When** the user imports it,
   **Then** the app reports the problem and imports nothing invalid.

---

### User Story 12 - Preserved page copies (Priority: P3)

The user keeps a preserved local copy of a saved page so its content survives
even if the original changes or disappears; PDF pages are saved as PDFs. The user
can also request a copy be preserved through the Internet Archive.

**Why this priority**: Guards against link rot, but the core collection is usable
without archived copies.

**Acceptance Scenarios**:

1. **Given** a saved bookmark to an HTML page, **When** the user saves a local
   copy, **Then** a self-contained single-file copy of the page content is stored
   and can be opened offline later from the bookmark (pixel-perfect or fully
   interactive reproduction is not required).
2. **Given** a saved bookmark whose URL is a PDF, **When** a local copy is saved,
   **Then** it is preserved as a PDF file.
3. **Given** a saved bookmark, **When** the user chooses to save through the
   Internet Archive, **Then** the app submits the URL to the Internet Archive and
   records the resulting archived-snapshot link on the bookmark.
4. **Given** a page copy cannot be produced (page unreachable or service
   unavailable), **When** the attempt fails, **Then** the app reports the failure
   and the bookmark itself remains intact.

---

### User Story 13 - Display preferences (Priority: P3)

The user adjusts basic display preferences: default sort order, how many items
are shown per view/page, and text size.

**Why this priority**: Comfort and readability improvement; not required for core
value.

**Acceptance Scenarios**:

1. **Given** the preferences view, **When** the user changes default sort, page
   size, or text size, **Then** the changes take effect and persist across
   sessions.

---

### Edge Cases

- Saving a URL already bookmarked opens the existing bookmark for editing (no
  duplicate). Import handles the same collision by merging rather than
  duplicating.
- A page exposing no metadata (title/description/icon/preview) still saves, using
  the URL as label and leaving missing fields empty.
- A page title, icon, preview, or page copy cannot be fetched: the app degrades
  gracefully, saves what it can, and reports failures for optional steps without
  losing the bookmark.
- A malformed search query (unbalanced quotes/parentheses, dangling operator) is
  reported clearly rather than returning misleading results.
- Archived bookmarks are excluded from the normal list and default search; a
  search run explicitly within the archive view searches only archived items.
- Deleting the last remaining bookmark shows a friendly empty state.
- A very large collection (hundreds+ of items) remains browsable, searchable, and
  sortable without noticeable slowdown.
- Bulk "select all results" applies only to items matching the current
  search/filter, never to hidden (e.g., archived) items.
- Import/export must round-trip: exporting then re-importing preserves titles,
  tags, and dates without loss or duplication.

## Requirements *(mandatory)*

### Functional Requirements

**Saving & metadata**

- **FR-001**: System MUST allow users to save a bookmark from a URL, with an
  optional user-provided title and optional tags.
- **FR-002**: System MUST validate that a submitted URL is well-formed and reject
  invalid entries with a clear message, saving nothing.
- **FR-003**: System MUST, when saving, attempt to collect the page's title,
  description, site icon (favicon), and preview image, and store any that are
  available.
- **FR-004**: System MUST allow users to edit a bookmark's title and description
  both while saving and after saving, using edited values in place of fetched
  ones.
- **FR-004a**: System MUST display, for each item in the normal bookmark list,
  at least its title, description, tags, and site icon.
- **FR-005**: System MUST fall back to the URL as the display label when no title
  is available, and leave unavailable metadata fields empty without failing.

**Notes & opening**

- **FR-006**: System MUST allow a personal note to be attached to and edited on
  any bookmark, persist it, support simple Markdown formatting in it, and display
  it as formatted text.
- **FR-007**: System MUST let the user open a bookmark's original page in a new
  browser tab/window.

**Duplicate handling**

- **FR-008**: When a user saves a URL that already exists, System MUST open the
  existing bookmark for editing and MUST NOT create a duplicate.

**Search**

- **FR-009**: System MUST provide case-insensitive search matching a bookmark's
  title, URL, description, note, and tags.
- **FR-010**: Search MUST support `#tag` terms, quoted exact phrases, and the
  boolean operators `AND`, `OR`, and `NOT` with parentheses for grouping.
- **FR-010a**: Search MUST treat adjacent terms (including a plain word next to a
  `#tag`) as requiring all to match unless the user explicitly joins them with
  `OR`.
- **FR-010b**: Search MUST treat an operator word (`AND`, `OR`, `NOT`) as
  ordinary search text when it is enclosed in quotes rather than as an operator.
- **FR-011**: System MUST report malformed queries clearly instead of returning
  misleading results.
- **FR-012**: System MUST show a clear empty-results state when a search matches
  nothing, and a clear empty state when there are no bookmarks at all.

**Tagging**

- **FR-013**: Users MUST be able to assign and remove one or more tags on a
  bookmark.
- **FR-014**: While typing a tag, System MUST suggest matching existing tags.
- **FR-014a**: System MUST keep tag names unique: typing a name that matches an
  existing tag (rather than choosing the suggestion) MUST reuse that tag and MUST
  NOT create a duplicate.

**Read state & archiving**

- **FR-015**: System MUST support a read/unread (read-later) state per bookmark,
  a dedicated unread view showing only unread non-archived bookmarks, and the
  ability to mark items read or unread. A newly saved bookmark MUST start as an
  ordinary read item; it appears in the unread/read-later view only when the user
  deliberately marks it for later.
- **FR-016**: System MUST support reversible archiving: archived bookmarks are
  excluded from the normal list and default search, appear in a dedicated archive
  view, and can be restored.

**Bulk actions**

- **FR-017**: Users MUST be able to select multiple bookmarks, or select all
  results in the current search/filter, and apply as a batch: add/remove tags,
  mark read/unread, archive/restore, or delete (delete confirmed once for the
  batch).

**Sorting & default order**

- **FR-018**: System MUST persist bookmark creation and last-updated timestamps
  and offer multiple sort options (including newest-first, oldest-first, title,
  and last-updated), defaulting to the user's chosen default sort (newest-first
  initially).

**Saved filters**

- **FR-019**: Users MUST be able to create, apply, and delete named reusable
  filters composed of search terms plus included and excluded tags.

**Import / export**

- **FR-020**: System MUST import and export bookmarks in the standard browser
  bookmark HTML format, preserving titles, tags, and dates, and MUST merge rather
  than duplicate URLs that already exist on import.

**Page preservation**

- **FR-021**: System MUST let users save a preserved local copy of a bookmarked
  page as a self-contained single file that opens offline and can be reopened
  from the bookmark; when the URL is a PDF, the copy MUST be preserved as a PDF.
  The copy must remain readable offline but need not reproduce pixel-perfect or
  fully interactive behavior.
- **FR-022**: System MUST offer saving a page through the Internet Archive and
  record the resulting archived-snapshot link on the bookmark; failures MUST be
  reported without harming the bookmark.

**Persistence & preferences**

- **FR-023**: System MUST persist all bookmarks, tags, notes, read/archive state,
  saved filters, page copies, and preferences so they survive app restarts.
- **FR-024**: Users MUST be able to adjust display preferences — default sort
  order, number of items shown per view, and text size — and have them persist.
- **FR-025**: Users MUST be able to edit a bookmark's URL and delete a bookmark,
  with deletion requiring a confirmation step.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved link. Attributes: URL; title (fetched or edited);
  description (fetched or edited); personal note (Markdown-formatted); site icon;
  preview image;
  set of tags; read/unread state; archived state; creation timestamp;
  last-updated timestamp; optional local page copy reference; optional
  Internet Archive snapshot link.
- **Tag**: A short label grouping related bookmarks. Many-to-many with bookmarks;
  used for tagging, tag suggestions, and filter include/exclude.
- **Saved Filter**: A named, reusable query composed of search terms plus
  included tags and excluded tags.
- **Page Copy**: A preserved local rendering of a bookmarked page as a
  self-contained single file (HTML content or PDF) that opens offline, linked to
  its bookmark.
- **Preferences**: User-level display settings — default sort order, items shown
  per view, and text size.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark, with metadata captured
  automatically when available, in under 20 seconds from opening the app.
- **SC-002**: A user can locate a specific bookmark among at least 500 saved
  items in under 10 seconds using search, tags, or a saved filter.
- **SC-003**: Search results, including compound `#tag`/phrase/boolean queries,
  appear effectively instantly (no perceptible wait) for at least 500 bookmarks.
- **SC-004**: 95% of first-time users successfully save, then find, a bookmark
  without external help.
- **SC-005**: No saved bookmark, note, tag, read/archive state, saved filter, or
  preference is lost across app restarts in normal use.
- **SC-006**: Exporting a collection and re-importing it preserves 100% of
  titles, tags, and dates with no duplicated bookmarks.
- **SC-007**: A preserved local page copy remains openable after the original
  page is changed or removed.

## Assumptions

- The app is a single-user personal tool for v1; multi-user accounts, login, and
  sharing are out of scope.
- The app is accessed through a web browser; native mobile apps are out of scope
  for v1.
- Organization is by tags only; folders, favorites, and link-health checking are
  explicitly out of scope for v1.
- Bookmarks and page copies are retained indefinitely until the user deletes
  them; no automatic expiry.
- Automatic metadata capture (title, description, icon, preview) and page copies
  are best-effort conveniences; when a page or service is unavailable the app
  still saves the bookmark and reports optional-step failures.
- Saving through the Internet Archive depends on that external public service
  being reachable; unavailability is reported and does not block bookmarking.
- Import/export targets the standard Netscape-style browser bookmark HTML format
  commonly used by major browsers; tags are carried in that format's supported
  attributes.
