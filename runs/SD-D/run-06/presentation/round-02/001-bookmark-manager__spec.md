# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-17

**Status**: Draft (revised)

**Input**: User description: "An app to save and manage bookmarks" — expanded with
tagging, automatic metadata capture, advanced search, read-later, archiving,
sorting, bulk actions, saved views, rich notes, local page preservation,
import/export, and display preferences.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark with automatic metadata (Priority: P1)

A person finds a web page worth keeping and saves it by providing its address.
The app automatically collects the page's title, description, site icon, and a
preview image so the entry is rich without manual effort, while the user can
still override the title and description.

**Why this priority**: Saving with useful, auto-populated context is the core
reason the app exists. This slice alone delivers a usable product: capture a
link and get back a meaningful, editable entry.

**Independent Test**: Add a bookmark by entering a URL, confirm the app fills in
title, description, icon, and preview image, edit the title, and confirm the
entry persists across a reload.

**Acceptance Scenarios**:

1. **Given** an empty collection, **When** the user submits a valid URL, **Then**
   a bookmark is saved and the app automatically populates title, description,
   site icon, and preview image from the page where available.
2. **Given** an auto-populated bookmark, **When** the user edits the title or
   description, **Then** the edited values are kept and persist across reloads.
3. **Given** a page whose metadata cannot be fetched, **When** the bookmark is
   saved, **Then** it is still stored with the address preserved and a readable
   fallback title, and missing fields degrade gracefully.
4. **Given** an address entered without a scheme (e.g. `example.com`), **When**
   saved, **Then** it is normalized to a valid address rather than rejected.
5. **Given** an invalid or empty address, **When** the user tries to save,
   **Then** the app rejects it with a clear message and saves nothing.

---

### User Story 2 - Saving an existing address routes to the existing bookmark (Priority: P1)

When the user saves an address that is already bookmarked, the app takes them to
the existing bookmark so they can review or edit it, rather than creating a
second copy or silently overwriting what is there.

**Why this priority**: Duplicate handling is a core correctness guarantee for a
growing collection; getting it wrong causes data loss or clutter. It is tightly
coupled to saving (US1) and is therefore also P1.

**Independent Test**: Save a URL, then save the same URL again; confirm no second
entry is created, existing data is unchanged, and the user lands on the existing
bookmark ready to edit.

**Acceptance Scenarios**:

1. **Given** an address is already bookmarked, **When** the user saves that same
   address again, **Then** no new bookmark is created and no existing field is
   silently changed.
2. **Given** the duplicate is detected, **When** the save is handled, **Then**
   the app opens/focuses the existing bookmark in an editable state and informs
   the user it already exists.
3. **Given** addresses that differ only by trivial variation (e.g. trailing
   slash, scheme, or case of host), **When** compared, **Then** they are treated
   as the same address for duplicate detection.

---

### User Story 3 - Organize with tags (Priority: P2)

The user assigns one or more tags to a bookmark, receives suggestions drawn from
existing tags while typing, and later filters the collection down to a chosen
tag.

**Why this priority**: Tags are the primary organizing mechanism for a growing
collection and unlock filtering and saved views, but they depend on bookmarks
existing first.

**Independent Test**: Add tags to several bookmarks (accepting a typed
suggestion), then filter by one tag and confirm only bookmarks with that tag are
shown.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user adds one or more tags, **Then** the
   tags are saved and displayed on the bookmark.
2. **Given** existing tags in the collection, **When** the user types into the
   tag field, **Then** matching existing tags are suggested and can be selected
   to avoid duplicates and typos.
3. **Given** tagged bookmarks, **When** the user filters by a tag, **Then** only
   bookmarks carrying that tag are listed.
4. **Given** a new tag not seen before, **When** the user enters it, **Then** it
   is created and becomes available as a future suggestion.

---

### User Story 4 - Powerful search (Priority: P2)

The user finds bookmarks by searching across address, title, description, notes,
and tags. Search ignores letter case and supports exact phrases, `#tag` tokens,
the operators AND / OR / NOT, and grouped (parenthesized) expressions.

**Why this priority**: Retrieval is what makes a large collection valuable;
expressive search is a stated core need. It builds on saved bookmarks and tags.

**Independent Test**: With a varied collection, run a query combining a phrase, a
`#tag`, and AND/OR/NOT with grouping, and confirm the results match the expected
logical set, case-insensitively.

**Acceptance Scenarios**:

1. **Given** a collection, **When** the user searches a plain keyword, **Then**
   bookmarks whose address, title, description, notes, or tags contain it are
   returned, regardless of letter case.
2. **Given** a quoted phrase, **When** searched, **Then** only bookmarks
   containing that exact contiguous phrase match.
3. **Given** a `#tag` token, **When** searched, **Then** results are constrained
   to bookmarks carrying that tag.
4. **Given** a query using AND / OR / NOT, **When** evaluated, **Then** results
   respect boolean logic (all-of, any-of, exclusion).
5. **Given** a grouped query with parentheses, **When** evaluated, **Then**
   grouping precedence is honored.
6. **Given** a malformed query, **When** submitted, **Then** the app reports the
   problem clearly instead of returning misleading results.

---

### User Story 5 - Read-later workflow (Priority: P2)

The user marks bookmarks as unread ("read later"), reviews them in a dedicated
unread view, and marks items as read once done.

**Why this priority**: Read-later is a distinct, high-value workflow for a
collection used as a reading queue; independent of tagging and archiving.

**Independent Test**: Save items as unread, open the unread view to confirm only
unread items appear, mark one read, and confirm it leaves the unread view.

**Acceptance Scenarios**:

1. **Given** bookmarks, **When** the user marks one unread/read, **Then** its
   read status is updated and persists.
2. **Given** a mix of read and unread bookmarks, **When** the user opens the
   unread view, **Then** only unread bookmarks are shown.
3. **Given** an unread bookmark, **When** the user marks it read, **Then** it no
   longer appears in the unread view.

---

### User Story 6 - Archive instead of delete (Priority: P2)

The user archives bookmarks they no longer want in daily view as a reversible
alternative to deletion. Archived items are hidden from normal browsing and
search, appear in a dedicated archive view, and can be restored. Permanent
deletion remains available and requires confirmation.

**Why this priority**: Reversible archiving protects against accidental loss
while keeping the working list clean; a core management behavior distinct from
delete.

**Independent Test**: Archive a bookmark, confirm it disappears from normal
browsing and search but appears in the archive view, then restore it and confirm
it returns.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user archives it, **Then** it is hidden
   from normal browsing and from normal search results.
2. **Given** archived bookmarks, **When** the user opens the archive view,
   **Then** only archived bookmarks are shown.
3. **Given** an archived bookmark, **When** the user restores it, **Then** it
   returns to normal browsing and search.
4. **Given** a bookmark, **When** the user chooses permanent delete, **Then** it
   is removed only after explicit confirmation and does not reappear.

---

### User Story 7 - Sort, bulk actions, and saved views (Priority: P2)

The user chooses how the list is sorted (rather than always newest-first),
selects multiple bookmarks — or everything matching the current search/filter —
to apply an action in bulk (tag, mark read/unread, archive, delete), and saves a
combination of search text plus included/excluded tags as a named view to return
to later.

**Why this priority**: Together these make a large collection manageable at
scale; they build on search, tags, read status, and archiving.

**Independent Test**: Sort by different criteria; select all results of a search
and bulk-add a tag; save the current search + tag filter as a named view and
reopen it.

**Acceptance Scenarios**:

1. **Given** a list, **When** the user selects a sort option, **Then** the list
   reorders accordingly and the choice is remembered per the display preferences.
2. **Given** a filtered/searched result set, **When** the user selects multiple
   items or "select all matching", **Then** the selection reflects the intended
   set.
3. **Given** a multi-selection, **When** the user applies tag / mark read /
   mark unread / archive / delete, **Then** the action applies to every selected
   bookmark (delete still requiring confirmation).
4. **Given** an active search plus included and/or excluded tags, **When** the
   user saves it as a named view, **Then** reopening that view restores the same
   search and tag inclusion/exclusion.

---

### User Story 8 - Rich notes (Priority: P3)

The user writes notes on a bookmark that can contain formatting, and sees that
formatting rendered when viewing the bookmark.

**Why this priority**: Notes add lasting value but are secondary to capture and
retrieval.

**Independent Test**: Add a note with formatting to a bookmark, save, reopen, and
confirm the formatting is displayed.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user writes a formatted note and saves,
   **Then** the note and its formatting persist.
2. **Given** a saved formatted note, **When** the user views the bookmark,
   **Then** the formatting is rendered rather than shown as raw markup.

---

### User Story 9 - Preserve a local copy of the page (Priority: P3)

The app keeps a preserved local copy of the bookmarked page so its content
survives even if the original goes offline. When the link points to a PDF, the
original PDF is saved. The user can additionally request preservation through the
Internet Archive.

**Why this priority**: Preservation guards against link rot but is not required
for basic saving and retrieval.

**Independent Test**: Save a normal page and confirm a local copy is retrievable;
save a PDF link and confirm the original PDF is stored; trigger Internet Archive
preservation and confirm a resulting archived reference is recorded.

**Acceptance Scenarios**:

1. **Given** a bookmarked web page, **When** it is saved, **Then** a local copy
   of the page is preserved and can be opened later.
2. **Given** a link that resolves to a PDF, **When** it is saved, **Then** the
   original PDF file is preserved as the local copy.
3. **Given** a bookmark, **When** the user requests Internet Archive
   preservation, **Then** the app submits it and records the resulting archived
   reference on the bookmark.
4. **Given** preservation cannot be completed (e.g. page unreachable or external
   service unavailable), **When** it fails, **Then** the bookmark is still saved
   and the failure is reported without blocking the save.

---

### User Story 10 - Import and export browser bookmarks (Priority: P3)

The user imports a standard browser bookmark file — preserving titles, tags, and
original dates — and exports their collection to the same standard format.

**Why this priority**: Import/export enables migration and backup but is not
needed for day-to-day use.

**Independent Test**: Import a standard bookmark file and confirm titles, tags,
and original dates are retained; export and confirm the file is valid and
re-importable.

**Acceptance Scenarios**:

1. **Given** a standard browser bookmark file, **When** the user imports it,
   **Then** bookmarks are added with their titles, tags, and original dates
   preserved.
2. **Given** imported addresses that already exist, **When** importing, **Then**
   duplicates are reconciled to the existing bookmark rather than creating copies.
3. **Given** a collection, **When** the user exports, **Then** a standard browser
   bookmark file is produced that other browsers/tools can read.

---

### User Story 11 - Personal display preferences (Priority: P3)

The user sets personal display choices — default sort order, how many items are
shown at once, and text size — and the app honors them.

**Why this priority**: Personalization improves comfort at scale but is not core
to capture and retrieval.

**Independent Test**: Change default sort, page size, and text size; reload and
confirm the app applies the saved preferences.

**Acceptance Scenarios**:

1. **Given** the preferences screen, **When** the user sets default sort, item
   count per view, and text size, **Then** the choices are saved and applied.
2. **Given** saved preferences, **When** the user returns later, **Then** the app
   opens with those preferences in effect.

---

### Edge Cases

- **Duplicate on save/import**: The same address is never duplicated; on save the
  user is routed to the existing bookmark, and on import it is reconciled to the
  existing entry — never a silent overwrite.
- **Address normalization**: Trivial variants (missing scheme, trailing slash,
  host letter case) are treated as the same address.
- **Metadata/preview unavailable**: Missing title/description/icon/preview degrade
  gracefully with sensible fallbacks; the bookmark still saves.
- **Preservation failures**: Local copy, PDF capture, or Internet Archive
  submission failing does not block saving; the failure is surfaced.
- **Archived items and search**: Archived bookmarks are excluded from normal
  browsing and search and only appear in the archive view.
- **Malformed search query**: Invalid boolean/grouping syntax yields a clear
  error, not misleading results.
- **Empty and no-match states**: A first-time empty collection and an empty
  result set each show a clear, friendly state.
- **Large collection**: Sorting, filtering, and search remain responsive as the
  collection grows.
- **Conflicting/renamed tags on import**: Imported tags merge with existing tags
  of the same name rather than creating separate duplicates.

## Requirements *(mandatory)*

### Functional Requirements

**Saving & metadata**

- **FR-001**: System MUST let a user save a bookmark by providing a web address.
- **FR-002**: System MUST validate the address as a well-formed web URL, normalize
  trivial variants (missing scheme, trailing slash, host case), and reject empty
  or malformed input with a clear message.
- **FR-003**: System MUST automatically collect the page's title, description,
  site icon, and preview image where available when a bookmark is saved.
- **FR-004**: System MUST allow the user to edit the title and description, and
  MUST persist those edits over the auto-collected values.
- **FR-005**: System MUST still save a bookmark when metadata collection fails,
  preserving the address and using graceful fallbacks for missing fields.
- **FR-006**: System MUST record the date/time each bookmark was added, and MUST
  preserve an original date when supplied on import.

**Duplicates**

- **FR-007**: System MUST prevent duplicate bookmarks for the same (normalized)
  address; on a repeat save it MUST route the user to the existing bookmark in an
  editable state and inform them, never creating a copy or silently overwriting.

**Tags**

- **FR-008**: Users MUST be able to assign one or more tags to a bookmark.
- **FR-009**: System MUST suggest matching existing tags as the user types a tag.
- **FR-010**: Users MUST be able to filter the collection by a selected tag.

**Search**

- **FR-011**: Users MUST be able to search across address, title, description,
  notes, and tags.
- **FR-012**: Search MUST ignore letter case.
- **FR-013**: Search MUST support exact-phrase matching (quoted phrases), `#tag`
  tokens, the boolean operators AND / OR / NOT, and grouped (parenthesized)
  expressions with correct precedence.
- **FR-014**: System MUST report malformed search queries clearly rather than
  returning misleading results.

**Read-later**

- **FR-015**: Users MUST be able to mark a bookmark read or unread, with status
  persisted.
- **FR-016**: System MUST provide a dedicated unread view showing only unread
  bookmarks.

**Archiving & deletion**

- **FR-017**: Users MUST be able to archive a bookmark as a reversible action.
- **FR-018**: System MUST hide archived bookmarks from normal browsing and normal
  search, and MUST provide a dedicated archive view showing only archived items.
- **FR-019**: Users MUST be able to restore an archived bookmark to normal
  browsing and search.
- **FR-020**: Users MUST be able to permanently delete a bookmark, only after an
  explicit confirmation step.

**Sorting, bulk actions, saved views**

- **FR-021**: Users MUST be able to choose the list sort order (not fixed to
  newest-first).
- **FR-022**: Users MUST be able to select multiple bookmarks, including a
  "select all matching the current search/filter" option.
- **FR-023**: Users MUST be able to apply bulk actions to a selection: add tags,
  mark read/unread, archive, and delete (delete still requiring confirmation).
- **FR-024**: Users MUST be able to save a combination of search text plus
  included and excluded tags as a named view, and reopen it to restore that
  search and tag inclusion/exclusion.

**Notes**

- **FR-025**: Users MUST be able to write notes containing formatting, and the
  app MUST render that formatting when the bookmark is viewed.

**Preservation**

- **FR-026**: System MUST preserve a local copy of the bookmarked page that can be
  opened later.
- **FR-027**: When a link resolves to a PDF, System MUST preserve the original PDF
  as the local copy.
- **FR-028**: Users MUST be able to additionally request preservation through the
  Internet Archive, and System MUST record the resulting archived reference.
- **FR-029**: System MUST not block saving when any preservation step fails, and
  MUST surface the failure.

**Import / export**

- **FR-030**: Users MUST be able to import a standard browser bookmark file,
  preserving titles, tags, and original dates.
- **FR-031**: On import, System MUST reconcile addresses that already exist to the
  existing bookmark rather than creating duplicates, merging same-named tags.
- **FR-032**: Users MUST be able to export the collection to a standard browser
  bookmark file that other browsers/tools can read.

**Display & preferences**

- **FR-033**: The bookmark list MUST display, for each bookmark, its title,
  description, tags, and site icon; activating a bookmark MUST open the original
  page.
- **FR-034**: System MUST provide a clear empty state (no bookmarks) and a clear
  no-match state (empty search/filter result).
- **FR-035**: Users MUST be able to set personal display preferences — default
  sort order, number of items shown per view, and text size — and System MUST
  apply and persist them across sessions.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved reference to a web resource. Attributes: normalized web
  address (unique key for duplicate detection), title, description, site icon,
  preview image, formatted notes, read/unread status, archived status, date
  added, original date (from import), and last-modified date. Relates to many
  Tags; may have one preserved local copy and one Internet Archive reference.
- **Tag**: A user-defined label. Has a name (unique, case-insensitive for merge)
  and relates to many Bookmarks. Drives suggestions, filtering, and saved views.
- **Saved View**: A named, reusable combination of search text plus included and
  excluded tags. Attributes: name, search expression, included tags, excluded
  tags.
- **Preserved Copy**: The stored local rendition of a bookmarked page (page
  snapshot, or the original PDF when applicable), linked to its Bookmark.
- **Internet Archive Reference**: A recorded reference to an externally archived
  version of the page, linked to its Bookmark.
- **Display Preferences**: The user's personal settings — default sort order,
  items shown per view, and text size.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark and receive auto-collected metadata
  (title, description, icon, preview where available) in under 15 seconds.
- **SC-002**: A user can locate a specific bookmark in a collection of 500 using
  search (including phrase, `#tag`, and boolean operators) in under 10 seconds.
- **SC-003**: Saving an already-bookmarked address results in zero duplicate
  entries and zero silent data changes in 100% of attempts.
- **SC-004**: Browsing, sorting, filtering, and search results update in under 1
  second with at least 1,000 saved bookmarks.
- **SC-005**: 95% of first-time users successfully save and tag their first
  bookmark without external help.
- **SC-006**: Importing a standard bookmark file preserves 100% of titles, tags,
  and original dates for well-formed entries, with no duplicate creation for
  addresses already present.
- **SC-007**: Archived bookmarks appear in 0% of normal browsing and search
  results and in 100% of archive-view listings.
- **SC-008**: A saved local copy remains openable for 100% of successfully
  preserved bookmarks even when the original page is unreachable.

## Assumptions

- **Single user, no accounts (v1)**: One user's personal collection, no login or
  multi-user separation. Sharing is out of scope.
- **Browser-accessed web application**: Delivered as a web app; native mobile
  apps are out of scope for v1.
- **Local, single-instance persistence**: Bookmarks, tags, saved views, preserved
  copies, and preferences are stored locally by the app; cross-device sync and
  cloud backup are out of scope for v1.
- **Internet Archive is an external dependency**: Its availability is outside the
  app's control; preservation through it is best-effort and non-blocking.
- **Metadata and local-copy capture are best-effort**: Fetching title,
  description, icon, preview, and page snapshots depends on the target page being
  reachable and cooperative; failures degrade gracefully.
- **Standard bookmark format**: Import/export uses the common HTML browser
  bookmark file format understood by mainstream browsers.
- **Rich notes and rich metadata are user-supplied or page-supplied content**:
  The app renders provided formatting; authoring beyond basic formatting is not a
  goal for v1.
