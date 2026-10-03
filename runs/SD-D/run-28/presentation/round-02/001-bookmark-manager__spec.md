# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-27

**Status**: Draft (revised after client review — round 2)

**Input**: User description: "An app to save and manage bookmarks" plus client
revisions: automatic metadata capture, duplicate-to-edit, advanced search, tag
suggestions, read-later, archiving, bulk actions, sorting, notes, page
preservation, saved views, import/export, and display preferences.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark with automatic metadata (Priority: P1)

The user finds a web page and saves it by entering its address. The app
automatically collects the page's **title, description, favicon, and preview
image** so the user does not have to type them. The saved bookmark appears in
the list showing this captured information. The user can still edit the title
and description afterward.

**Why this priority**: Saving links with rich, automatic metadata is the core
reason the app exists. It is a usable product on its own.

**Independent Test**: Enter a valid URL, save it, and confirm the bookmark
appears with an auto-collected title, description, favicon, and preview image.
Reload the app and confirm it persists.

**Acceptance Scenarios**:

1. **Given** an empty list, **When** the user saves a valid URL, **Then** the app fetches and stores the page's title, description, favicon, and preview image, and the bookmark persists after reload.
2. **Given** a saved bookmark, **When** the user edits the title or description, **Then** the edited values are stored and shown in place of the captured ones.
3. **Given** a page whose metadata cannot be fetched (unreachable, or fields missing), **When** the bookmark is saved, **Then** the app still saves it, derives a title from the address, and clearly indicates which metadata is unavailable.
4. **Given** the save form, **When** the user enters text that is not a valid web address, **Then** the app rejects it with a clear message and does not save.
5. **Given** an address without a scheme (e.g. `example.com`), **When** the user saves, **Then** it is normalized to a valid `http`/`https` address.

---

### User Story 2 - Save an existing address takes me to it (Priority: P1)

When the user saves an address that already exists in their collection, the app
does not create a duplicate and does not merely warn. Instead it takes the user
directly to the existing bookmark so they can update it.

**Why this priority**: Prevents silent duplicates and matches how the user
expects re-saving to behave; tightly coupled to the core save flow.

**Independent Test**: Save a URL, then attempt to save the same URL again;
confirm no duplicate is created and the user lands on the existing bookmark in an
editable state.

**Acceptance Scenarios**:

1. **Given** a bookmark for a given address exists, **When** the user saves the same address again, **Then** no duplicate is created and the user is taken to the existing bookmark ready to edit.
2. **Given** addresses that differ only by trivial variation (trailing slash, scheme, or letter case of the host), **When** compared for duplication, **Then** they are treated as the same address.

---

### User Story 3 - Browse, sort, and search (Priority: P1)

The user views their bookmarks in a list and finds specific ones. Search is
**case-insensitive** and covers **title, address, description, notes, and tags**.
The user can build precise queries using **exact phrases** (in quotes),
**`#tag`** terms, and the boolean operators **AND, OR, NOT** with
**parentheses** for grouping. The user can also choose how the list is
**sorted** rather than being limited to newest-first.

**Why this priority**: A saved link has no value if it cannot be found again;
this is what turns a pile of links into a usable collection.

**Independent Test**: With several bookmarks saved, run a combined query such as
`#work AND ("quarterly report" OR budget) NOT archived-topic` and confirm only
matching bookmarks appear; change the sort order and confirm the list reorders.

**Acceptance Scenarios**:

1. **Given** multiple bookmarks, **When** the user opens the app, **Then** all non-archived bookmarks are listed using the current/default sort order.
2. **Given** a search term, **When** the user searches, **Then** matching is case-insensitive and considers title, address, description, notes, and tags.
3. **Given** a query with quotes, **When** searching, **Then** the quoted text is matched as an exact phrase.
4. **Given** a query using `#tag`, **When** searching, **Then** results are restricted to bookmarks carrying that tag.
5. **Given** a query using AND, OR, NOT and parentheses, **When** searching, **Then** results honor the boolean logic and grouping.
6. **Given** a search with no matches, **When** results are shown, **Then** a clear "no results" message appears.
7. **Given** the list, **When** the user chooses a different sort option (e.g. title A–Z, date added, last modified, read/unread), **Then** the list reorders accordingly.

---

### User Story 4 - Edit and delete bookmarks (Priority: P2)

The user corrects a title or description, adjusts the address or tags, or
permanently removes a bookmark that is no longer relevant.

**Why this priority**: Managing the collection keeps it accurate; depends on
saving existing first.

**Independent Test**: Edit a bookmark's fields and confirm they persist; delete
a bookmark (with confirmation) and confirm it stays gone after reload.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user edits its title, description, address, or tags and saves, **Then** the updated values are shown and persisted.
2. **Given** an existing bookmark, **When** the user deletes it and confirms, **Then** it is permanently removed and does not reappear after reload.
3. **Given** a delete action, **When** the user is asked to confirm, **Then** cancelling leaves the bookmark unchanged.

---

### User Story 5 - Read later and unread view (Priority: P2)

The user marks bookmarks as "to read later." A dedicated **unread view** shows
only items still to be read, and the user can **mark items read** (and back to
unread).

**Why this priority**: A distinct read-later workflow is a primary way the user
wants to manage incoming links.

**Independent Test**: Save an item as unread, open the unread view and confirm it
appears, mark it read, and confirm it leaves the unread view.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** it is marked read-later/unread, **Then** its read state is stored and shown.
2. **Given** unread and read bookmarks, **When** the user opens the unread view, **Then** only unread bookmarks appear.
3. **Given** an unread bookmark, **When** the user marks it read, **Then** it leaves the unread view; marking it unread again returns it.

---

### User Story 6 - Archive as a reversible alternative to delete (Priority: P2)

The user archives bookmarks they want out of the way without deleting them.
Archived items are **hidden from the normal list** and appear in their own
**archive view**, from which they can be **restored**.

**Why this priority**: Reversible archiving lets the user declutter safely;
distinct from permanent deletion.

**Independent Test**: Archive a bookmark, confirm it disappears from the normal
list and appears in the archive view, then restore it and confirm it returns.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user archives it, **Then** it is hidden from the normal list and appears in the archive view.
2. **Given** an archived bookmark, **When** the user restores it, **Then** it returns to the normal list.
3. **Given** the normal list and default search, **When** results are shown, **Then** archived bookmarks are excluded unless the archive view or an explicit archived filter is used.

---

### User Story 7 - Organize with tags and tag suggestions (Priority: P2)

The user assigns one or more tags to bookmarks and filters by tag. While
entering tags, the app **suggests tags the user has already used** so tagging
stays consistent.

**Why this priority**: Tags are the chosen organization model; suggestions keep
them consistent and reduce fragmentation.

**Independent Test**: Add a tag to two bookmarks, start typing that tag on a
third and confirm it is suggested, then filter by the tag and confirm only the
tagged bookmarks appear.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user adds one or more tags, **Then** the tags are shown and saved.
2. **Given** previously used tags, **When** the user types the beginning of a tag, **Then** matching existing tags are suggested.
3. **Given** bookmarks with different tags, **When** the user filters by a tag, **Then** only bookmarks carrying that tag are listed; clearing the filter restores the full list.

---

### User Story 8 - Descriptions and formatted notes (Priority: P2)

Each bookmark supports a plain-text **description** (auto-captured, editable) and
a separate **formatted note** the user writes for their own commentary.

**Why this priority**: Notes and descriptions add lasting personal value to saved
links and feed into search.

**Independent Test**: Add a formatted note to a bookmark, confirm the formatting
renders, reload, and confirm the note persists and is searchable.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user writes a formatted note, **Then** the formatting is preserved on display and after reload.
2. **Given** a note or description, **When** the user searches for text within it, **Then** the bookmark matches.

---

### User Story 9 - Bulk selection and actions (Priority: P3)

The user selects several bookmarks individually, or selects **everything
matching the current search or filter**, and applies an action to all of them at
once: **add/remove tags, mark read/unread, archive, or delete**.

**Why this priority**: Bulk actions make managing a large collection efficient;
builds on selection, tagging, read/archive states.

**Independent Test**: Run a search, select all matching results, add a tag to
them in one action, and confirm every matching bookmark now carries the tag.

**Acceptance Scenarios**:

1. **Given** a list, **When** the user selects multiple bookmarks, **Then** a bulk action can be applied to exactly those selected.
2. **Given** an active search or filter, **When** the user chooses "select all matching", **Then** the action applies to the full matching set, not just the visible page.
3. **Given** a bulk destructive action (delete), **When** applied, **Then** the user confirms first; bulk archive is reversible via restore.

---

### User Story 10 - Saved views (Priority: P3)

The user creates reusable **saved views** defined by a search query together
with **included and excluded tags**, then reopens a view later to see its
results without re-entering the criteria.

**Why this priority**: Saved views turn frequent queries into one-click
destinations; depends on search and tags.

**Independent Test**: Create a saved view from a query plus included/excluded
tags, reopen it later, and confirm it shows the expected filtered results.

**Acceptance Scenarios**:

1. **Given** a search and chosen included/excluded tags, **When** the user saves it as a view with a name, **Then** the view is stored and listed.
2. **Given** a saved view, **When** the user opens it, **Then** the current bookmarks matching its criteria are shown.
3. **Given** a saved view, **When** the user edits or deletes it, **Then** the change persists.

---

### User Story 11 - Page preservation (Priority: P3)

For each bookmark the app keeps a **preserved copy of the linked page** so the
content survives even if the original changes or disappears. If the link points
to a **PDF**, the PDF itself is kept. The user can also choose to **submit the
page to the Internet Archive** and keep a reference to that snapshot.

**Why this priority**: Preservation protects against link rot; valuable but not
required for the core save/find/manage loop.

**Independent Test**: Save a page, open its preserved copy and confirm it renders
from stored content; save a PDF link and confirm the PDF is retained; trigger
Internet Archive submission and confirm a snapshot reference is stored.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** preservation runs, **Then** a stored copy of the page is available to view later independent of the live site.
2. **Given** a link to a PDF, **When** saved, **Then** the PDF file is retained as the preserved copy.
3. **Given** a bookmark, **When** the user requests Internet Archive submission, **Then** the app submits it and stores a reference to the resulting snapshot; if submission fails, the user is informed and the bookmark is unaffected.

---

### User Story 12 - Import and export (Priority: P3)

The user imports bookmarks from a standard **browser-bookmark HTML file**,
retaining **titles, tags, and dates**, and exports their collection to the same
standard format.

**Why this priority**: Migration in and out protects the user's investment and
avoids lock-in; independent of daily use.

**Independent Test**: Import a browser bookmark HTML file and confirm titles,
tags, and dates are preserved; export and confirm the file re-imports faithfully.

**Acceptance Scenarios**:

1. **Given** a standard browser-bookmark HTML file, **When** the user imports it, **Then** bookmarks are added with their titles, tags, and original dates preserved.
2. **Given** an import that contains an address already present, **When** imported, **Then** it is merged with the existing bookmark rather than duplicated.
3. **Given** the collection, **When** the user exports, **Then** a standard browser-bookmark HTML file is produced that can be imported by this app and by common browsers.

---

### User Story 13 - Display preferences (Priority: P3)

The user sets basic display preferences: **default sort order**, **how many
items are shown** (per page / list density), and **text size**. Preferences
persist across sessions.

**Why this priority**: Comfort and readability; refinement rather than core
capability.

**Independent Test**: Change default sort, item count, and text size; reload and
confirm the preferences are still applied.

**Acceptance Scenarios**:

1. **Given** the preferences screen, **When** the user changes default sort, item count, or text size, **Then** the list reflects the choices and they persist after reload.

---

### Edge Cases

- **Metadata fetch failure / slow site**: Saving still succeeds; missing fields are indicated and a title is derived from the address; fetching does not block the user indefinitely.
- **Preview image / favicon missing**: The bookmark displays a sensible placeholder.
- **Duplicate on import**: Merged into the existing bookmark (see US-12), consistent with duplicate-to-edit on manual save (US-2).
- **Malformed search query** (unbalanced quotes/parentheses): The app reports the problem clearly instead of returning misleading results.
- **Very long titles/addresses/notes**: Stored in full, displayed truncated so layout is preserved.
- **Empty states**: Distinct friendly prompts for empty collection, empty unread view, empty archive, and no-results searches.
- **Whitespace-only input**: Treated as empty for validation.
- **Preservation of large pages/PDFs**: Handled without blocking the UI; failures are reported and leave the bookmark intact.
- **Internet Archive unavailable**: Submission failure is reported without affecting the local bookmark or its local preserved copy.

## Requirements *(mandatory)*

### Functional Requirements

**Saving & metadata**

- **FR-001**: Users MUST be able to save a bookmark by providing a web address, with optional tags, description, note, and read-later state.
- **FR-002**: On save, System MUST automatically fetch and store the page's title, description, favicon, and preview image where available.
- **FR-003**: Users MUST be able to edit the title and description (and other fields) after saving; edited values take precedence over captured ones.
- **FR-004**: System MUST validate that the address is well-formed, reject invalid input with a clear message, and normalize a scheme-less address to a valid `http`/`https` form.
- **FR-005**: When metadata cannot be fetched, System MUST still save the bookmark, derive a title from the address, and indicate which metadata is unavailable.
- **FR-006**: System MUST persist all bookmark data so it survives reload/restart.

**Duplicates**

- **FR-007**: When saving an address that already exists, System MUST NOT create a duplicate and MUST take the user to the existing bookmark in an editable state.
- **FR-008**: System MUST treat addresses differing only by trailing slash, scheme, or host letter-case as the same address for duplicate detection.

**Browsing, sorting & search**

- **FR-009**: System MUST display bookmarks in a list, excluding archived items from the normal list by default.
- **FR-010**: Users MUST be able to choose the sort order (at minimum: date added, last modified, title A–Z/Z–A, and read/unread), with a configurable default.
- **FR-011**: Search MUST be case-insensitive and match across title, address, description, notes, and tags.
- **FR-012**: Search MUST support exact-phrase matching via quotes, `#tag` terms, and the boolean operators AND, OR, and NOT with parentheses for grouping.
- **FR-013**: System MUST report malformed queries clearly and MUST show a clear "no results" state when nothing matches.

**Read-later & archive**

- **FR-014**: Users MUST be able to mark bookmarks read-later/unread and toggle them read/unread; System MUST provide a dedicated unread view.
- **FR-015**: Users MUST be able to archive and restore bookmarks; archived items MUST be hidden from the normal list and available in a dedicated archive view.

**Tags**

- **FR-016**: Users MUST be able to assign zero or more tags to a bookmark and filter the list by tag.
- **FR-017**: While entering tags, System MUST suggest tags the user has previously used.

**Notes & descriptions**

- **FR-018**: Each bookmark MUST support a plain-text description and a separately editable formatted note; both MUST be searchable.

**Bulk actions**

- **FR-019**: Users MUST be able to select multiple bookmarks individually or select all bookmarks matching the current search/filter.
- **FR-020**: Users MUST be able to apply add-tag, remove-tag, mark read/unread, archive, and delete to a selection in one action; deletion MUST be confirmed.

**Saved views**

- **FR-021**: Users MUST be able to create, open, edit, and delete named saved views defined by a search query plus included and excluded tags.

**Page preservation**

- **FR-022**: System MUST keep a preserved copy of each linked page that can be viewed independently of the live site; when the link is a PDF, the PDF MUST be retained as the preserved copy.
- **FR-023**: Users MUST be able to submit a page to the Internet Archive and have a reference to the resulting snapshot stored; failures MUST be reported without affecting the bookmark.

**Import & export**

- **FR-024**: Users MUST be able to import bookmarks from a standard browser-bookmark HTML file, preserving titles, tags, and dates, and merging addresses that already exist.
- **FR-025**: Users MUST be able to export the collection to a standard browser-bookmark HTML file compatible with this app and common browsers.

**Preferences & general**

- **FR-026**: Users MUST be able to set and persist display preferences: default sort order, number of items shown, and text size.
- **FR-027**: Each bookmark MUST record its date added and date last modified.
- **FR-028**: Users MUST be able to open a bookmark's original address in a new browser tab.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved link. Attributes: address (normalized), captured title, user title override, captured description, user description override, formatted note, favicon, preview image, read/unread state, archived state, date added, date last modified, associated tags, preserved-copy reference, Internet Archive snapshot reference.
- **Tag**: A short label used to group bookmarks. Many-to-many with bookmarks; the set of previously used tags feeds suggestions.
- **Saved View**: A named, reusable filter defined by a search query plus included and excluded tags.
- **Preserved Copy**: Stored content for a bookmark (page snapshot, or the original PDF), viewable independently of the live site.
- **Preferences**: User-level settings — default sort order, items shown, text size.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save their first bookmark, with metadata automatically captured, within 30 seconds of opening the app and with no prior setup.
- **SC-002**: Searching a collection of 500 bookmarks, including boolean and phrase queries, returns results in under 1 second.
- **SC-003**: 95% of users can find and open a previously saved bookmark on their first attempt.
- **SC-004**: Saved bookmarks and their preserved copies are retained across app reloads with zero data loss under normal use.
- **SC-005**: A user can apply a bulk action to all bookmarks matching a search (up to 500 items) in a single operation completing in under 5 seconds.
- **SC-006**: Importing a browser-bookmark HTML file of 1,000 entries preserves 100% of titles, tags, and dates and creates no duplicates for addresses already present.
- **SC-007**: Automatic metadata capture succeeds for at least 90% of reachable pages that expose standard metadata; the remaining cases save successfully with a derived title.

## Assumptions

- **Single-user, no login**: The app serves one user; no accounts, authentication, or sharing (confirmed with client).
- **Tags, not folders**: Organization is via tags and saved views; hierarchical folders are out of scope (confirmed with client).
- **Web application** reached over HTTP, consistent with the project's runtime presentation environment.
- **Browser extension is out of scope** (confirmed with client). Bookmarks are added manually in-app or via import.
- **Metadata capture** reads standard page metadata (page title, standard description and preview-image/social tags, and favicon). It does not execute site-specific scraping and depends on the target being reachable at save time.
- **Formatted notes** use a lightweight, portable formatting model (e.g. common markdown-style formatting: headings, bold/italic, lists, links); full rich-media editing is not required.
- **Preserved copy** is a self-contained stored rendering of the page captured at save time; the Internet Archive option is an additional external snapshot, not a replacement for the local copy. Network access to target sites and to the Internet Archive is required for those features to succeed.
- **Standard bookmark HTML format** refers to the Netscape bookmark file format used by common browsers for import/export.
- **Storage growth from preserved copies** is expected; storage limits/retention tuning is deferred to planning.
- **Modern browser** is used to access the app.

## Open decisions for client confirmation

These do not block review but would sharpen scope — please steer if you have a
preference; otherwise the assumptions above stand:

1. **Formatted note format** — is common markdown-style formatting acceptable, or do you want full rich-text (fonts, colors, images)?
2. **Preserved copy fidelity** — a single self-contained snapshot per bookmark captured at save time (default), versus multiple versions over time?
3. **Internet Archive** — is it acceptable that this feature requires outbound internet access and may be unavailable offline?
