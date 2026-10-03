# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-24

**Status**: Draft (revised after client review round 1)

**Input**: User description: "I want to build an app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark with automatic page information (Priority: P1)

A person finds a web page they want to keep and saves it by providing its address. The
app automatically collects the page's title, description, site icon, and preview image so
the entry is rich without manual effort, while still letting the person edit the title and
description. If the address is already saved, the app takes them straight to the existing
bookmark for editing instead of creating a duplicate.

**Why this priority**: Saving is the core reason the app exists, and automatic page
information is what makes saved entries useful at a glance. This capability delivers value
on its own.

**Independent Test**: Add a bookmark by address, confirm the title/description/icon/preview
are populated automatically, edit the title, and confirm the entry persists after reload.
Save the same address again and confirm it opens the existing bookmark for editing.

**Acceptance Scenarios**:

1. **Given** an empty list, **When** the user submits a valid address, **Then** a bookmark is created and its title, description, site icon, and preview image are populated automatically from the page where available.
2. **Given** the automatically collected title or description is imperfect, **When** the user edits either field and saves, **Then** the edited values are kept and persist after reload.
3. **Given** a page whose information cannot be retrieved, **When** the bookmark is saved, **Then** the system falls back to a readable title derived from the address and lets the user fill in the remaining fields manually, without blocking the save.
4. **Given** an address that is already bookmarked, **When** the user tries to save it again, **Then** the system opens the existing bookmark for editing instead of creating a duplicate.
5. **Given** an entry that is not a valid web address, **When** the user tries to save, **Then** the system rejects it with a clear message without losing what they typed.

---

### User Story 2 - Browse and open bookmarks in a readable list (Priority: P1)

A person opens the app to revisit something they saved, scans a readable list, and opens
the chosen bookmark in their browser.

**Why this priority**: A saved bookmark has no value unless it can be found and reopened.
Together with Story 1 this forms the minimum viable product.

**Independent Test**: Seed several bookmarks, confirm each row shows title, description,
tags, and site icon, and confirm activating one opens the correct address in a new tab.

**Acceptance Scenarios**:

1. **Given** several saved bookmarks, **When** the user opens the app, **Then** each bookmark is shown in a readable list displaying its title, description, tags, and site icon.
2. **Given** a bookmark in the list, **When** the user activates it, **Then** its web address opens in a new browser tab.
3. **Given** no bookmarks exist, **When** the user opens the app, **Then** a helpful empty state explains how to add the first bookmark.
4. **Given** very long titles, descriptions, or addresses, **When** they are displayed, **Then** the list stays readable (e.g. truncated) while the full value remains available.

---

### User Story 3 - Organize with tags (Priority: P2)

A person labels bookmarks with tags (such as "work" or "recipes") and filters the list by
a tag to focus on one topic. While adding tags, the app suggests existing tags so labels
stay consistent.

**Why this priority**: Tags are central to how this person manages a growing collection,
not an optional final layer. They underpin filtering, saved searches, and bulk actions.

**Independent Test**: Assign a tag to two bookmarks (using suggestions to reuse an existing
tag), filter by that tag, and confirm only those two are shown.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user adds one or more tags, **Then** the tags are saved and displayed with the bookmark.
2. **Given** existing tags in the collection, **When** the user begins typing a tag, **Then** the app suggests matching existing tags to choose from.
3. **Given** bookmarks with different tags, **When** the user filters by a tag, **Then** only bookmarks carrying that tag are shown.

---

### User Story 4 - Add notes, edit, and delete (Priority: P2)

A person keeps a bookmark useful by attaching a note with simple formatting, correcting the
title or address, and permanently deleting entries they no longer want.

**Why this priority**: Notes and corrections are core to "managing" bookmarks over time.
Permanent deletion is the irreversible counterpart to archiving (Story 7).

**Independent Test**: Add a formatted note to a bookmark and confirm it persists and is
searchable; edit the title and confirm the change persists; delete a bookmark and confirm
it is gone after reload.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user adds or edits a note using simple formatting, **Then** the formatted note is saved, displayed, and included in searches.
2. **Given** an existing bookmark, **When** the user edits its title, description, or address and saves, **Then** the updated values persist after reload.
3. **Given** an existing bookmark, **When** the user chooses to permanently delete it, **Then** the system asks for confirmation and, once confirmed, removes it so it does not reappear after reload.

---

### User Story 5 - Powerful search (Priority: P2)

A person searches their whole collection to find a bookmark, using plain keywords or more
precise queries.

**Why this priority**: As the collection grows, reliable search is what makes it navigable.
It builds on titles, descriptions, notes, addresses, and tags from earlier stories.

**Independent Test**: Seed bookmarks with varied titles, notes, and tags, then run queries
using a `#tag` term, an exact phrase, and a combination with AND/OR/NOT and parentheses,
confirming the matched set is correct and matching is case-insensitive.

**Acceptance Scenarios**:

1. **Given** saved bookmarks, **When** the user searches a keyword, **Then** matching is case-insensitive and spans titles, descriptions, notes, and addresses.
2. **Given** a `#tag` term in the query, **When** the search runs, **Then** results are restricted to bookmarks carrying that tag.
3. **Given** a query wrapped in quotes, **When** the search runs, **Then** only bookmarks containing that exact phrase match.
4. **Given** a query combining terms with AND, OR, NOT and parentheses, **When** the search runs, **Then** results honor the boolean logic and grouping.
5. **Given** a query that matches nothing, **When** results are shown, **Then** the user sees a clear "no results" message rather than an empty screen.

---

### User Story 6 - Read-later status (Priority: P2)

A person marks freshly saved items as unread, works through a dedicated unread view, and
marks items read as they finish them.

**Why this priority**: A read-later workflow is a distinct, valuable way this person manages
incoming links, separate from long-term organization.

**Independent Test**: Save a bookmark, confirm it appears in the unread view, mark it read,
and confirm it leaves the unread view.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user views read-later status, **Then** each bookmark is either read or unread.
2. **Given** unread bookmarks, **When** the user opens the unread view, **Then** only unread bookmarks are shown.
3. **Given** an unread bookmark, **When** the user marks it read, **Then** it no longer appears in the unread view; marking it unread again returns it there.

---

### User Story 7 - Archive as a reversible action (Priority: P2)

A person clears finished or stale bookmarks out of their everyday view by archiving them,
knowing they can be restored later, without permanently deleting anything.

**Why this priority**: Archiving keeps the active collection focused while preserving data.
It is explicitly distinct from permanent deletion.

**Independent Test**: Archive a bookmark, confirm it disappears from normal lists and
searches, view the archive, restore it, and confirm it returns to normal views.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user archives it, **Then** it is hidden from normal lists and from normal searches.
2. **Given** archived bookmarks, **When** the user opens the archive view, **Then** archived bookmarks are shown there.
3. **Given** an archived bookmark, **When** the user restores it, **Then** it reappears in normal lists and searches.
4. **Given** archiving and deletion, **When** the user uses each, **Then** archiving is reversible and permanent deletion (Story 4) is not.

---

### User Story 8 - Act on many bookmarks at once (Priority: P3)

A person selects several bookmarks — or everything matching the current view — and applies
one action to all of them: add a tag, mark read or unread, archive, or delete.

**Why this priority**: Bulk actions save significant time at scale but the app is fully
usable acting on one bookmark at a time first.

**Independent Test**: Select three bookmarks, apply a tag to all, and confirm all three
carry it; then select everything matching a filtered view and archive it in one action.

**Acceptance Scenarios**:

1. **Given** a list of bookmarks, **When** the user selects several, **Then** they can apply tagging, mark read/unread, archive, or delete to the whole selection at once.
2. **Given** a filtered or searched view, **When** the user chooses to select everything matching it, **Then** the chosen action applies to all matching bookmarks.
3. **Given** a bulk delete, **When** the user confirms, **Then** the same confirmation safeguards as single deletion apply before permanent removal.

---

### User Story 9 - Saved searches (Priority: P3)

A person saves a query they use often — combining text with tags that must be included and
tags that must be excluded — and reruns it with one click.

**Why this priority**: Saved searches speed up recurring navigation but depend on search and
tags being in place first.

**Independent Test**: Create a saved search combining a keyword with one included and one
excluded tag, rerun it, and confirm the result matches the definition.

**Acceptance Scenarios**:

1. **Given** a query combining text with included and excluded tags, **When** the user saves it, **Then** it is stored and appears in a list of saved searches.
2. **Given** a saved search, **When** the user runs it, **Then** the current results matching its definition are shown.
3. **Given** a saved search, **When** the user deletes it, **Then** it is removed from the saved-search list.

---

### User Story 10 - Sorting and display preferences (Priority: P3)

A person adjusts how the collection is presented — sort order, how many items appear, and
text size — to suit how they work.

**Why this priority**: Presentation control is a comfort and scale improvement layered on a
working list.

**Independent Test**: Change the sort to "title", confirm the list reorders; set a default
number of items shown and a text size, and confirm the preferences persist after reload.

**Acceptance Scenarios**:

1. **Given** a list of bookmarks, **When** the user sorts by a choice such as date added or title, **Then** the list reorders accordingly (most recently added first by default).
2. **Given** display preferences, **When** the user sets a default sort, number of items shown, and text size, **Then** those preferences persist across reloads and apply to the list.

---

### User Story 11 - Keep a saved copy of the page (Priority: P3)

A person preserves the content behind a bookmark against link rot by keeping a saved local
copy. When the link is a PDF, the app stores the PDF itself. The person can also choose to
preserve the page through the Internet Archive.

**Why this priority**: Preservation protects against dead links but is not required for the
core save-and-find workflow.

**Independent Test**: Save a normal page and confirm a local copy is retained and viewable;
save a PDF link and confirm the PDF itself is stored; trigger Internet Archive preservation
and confirm the resulting archive reference is recorded (or a clear failure is reported if
the service is unavailable).

**Acceptance Scenarios**:

1. **Given** a bookmarked web page, **When** the user keeps a saved copy, **Then** a local copy of the page is stored and can be reopened later.
2. **Given** a bookmarked address that points to a PDF, **When** a copy is kept, **Then** the PDF file itself is stored.
3. **Given** a bookmark, **When** the user requests Internet Archive preservation, **Then** the app records the resulting archive reference on success, or reports the failure clearly without losing the bookmark when the service is unavailable.

---

### User Story 12 - Import and export (Priority: P3)

A person moves bookmarks in and out of the app using the common browser-bookmark HTML
format, so their collection is portable and not locked in.

**Why this priority**: Portability protects the person's data and eases adoption, but the
app works without it.

**Independent Test**: Export the collection to a browser-bookmark HTML file, then import a
browser-bookmark HTML file and confirm the bookmarks (and their folders/tags where present)
appear.

**Acceptance Scenarios**:

1. **Given** a collection of bookmarks, **When** the user exports, **Then** a standard browser-bookmark HTML file is produced containing the bookmarks.
2. **Given** a standard browser-bookmark HTML file, **When** the user imports it, **Then** its bookmarks are added to the collection, with folder labels mapped to tags where present.
3. **Given** an import that includes an address already saved, **When** the import runs, **Then** the existing bookmark is preserved rather than duplicated.

---

### Edge Cases

- **Duplicate address**: Saving an existing address opens the existing bookmark for editing instead of creating a duplicate (FR-005).
- **Page info unavailable**: When a page cannot be retrieved, the save still succeeds with an address-derived title and manual fields.
- **Missing scheme**: An address entered without a scheme (e.g. `example.com`) is accepted and normalized to a usable web address.
- **Archived items in search**: Archived bookmarks never appear in normal lists or searches; they surface only in the archive view.
- **Empty and no-results states**: A first-time user sees a helpful empty state; a search or filter that matches nothing shows a clear "no results" message.
- **Very long text**: Long titles, descriptions, and addresses are truncated in the list while the full value remains available.
- **PDF vs page**: The saved-copy behavior differs by content type — a page snapshot for web pages, the file itself for PDFs.
- **External service down**: Internet Archive preservation failures are reported honestly and never lose the underlying bookmark.

## Requirements *(mandatory)*

### Functional Requirements

**Saving & page information**

- **FR-001**: System MUST allow a user to save a bookmark from a web address, with an optional user-provided title.
- **FR-002**: System MUST automatically collect the page's title, description, site icon, and preview image where available when a bookmark is saved.
- **FR-003**: System MUST allow the user to edit a bookmark's title and description regardless of what was collected automatically.
- **FR-004**: System MUST validate that a submitted address is a well-formed web address, normalize a missing scheme, and reject invalid entries with a clear message while preserving user input.
- **FR-005**: When a user saves an address that already exists, System MUST open the existing bookmark for editing instead of creating a duplicate.
- **FR-006**: When page information cannot be retrieved, System MUST still save the bookmark with a title derived from the address and allow manual entry of the remaining fields.

**Viewing & opening**

- **FR-007**: System MUST display bookmarks in a readable list showing at least the title, description, tags, and site icon.
- **FR-008**: Users MUST be able to open a bookmark's address in a new browser tab.
- **FR-009**: System MUST persist all bookmark data so it remains available after the app is closed and reopened.
- **FR-010**: System MUST show a clear empty state when no bookmarks exist and a clear "no results" state when a search or filter matches nothing.

**Tags**

- **FR-011**: Users MUST be able to assign zero or more tags to a bookmark.
- **FR-012**: System MUST suggest matching existing tags as the user types a tag.
- **FR-013**: Users MUST be able to filter the list to bookmarks carrying a chosen tag.

**Notes, edit & delete**

- **FR-014**: Users MUST be able to attach a note with simple formatting to a bookmark.
- **FR-015**: Users MUST be able to edit a bookmark's title, description, address, note, and tags.
- **FR-016**: Users MUST be able to permanently delete a bookmark, with a confirmation step before removal.

**Search**

- **FR-017**: System MUST provide case-insensitive search across titles, descriptions, notes, and addresses.
- **FR-018**: Search MUST support `#tag` terms that restrict results to a given tag.
- **FR-019**: Search MUST support exact-phrase matching via quotes.
- **FR-020**: Search MUST support boolean combinations using AND, OR, NOT and parentheses for grouping.

**Read-later**

- **FR-021**: System MUST track a read/unread status for each bookmark and let users mark items read or unread.
- **FR-022**: System MUST provide a separate unread view showing only unread bookmarks.

**Archiving**

- **FR-023**: Users MUST be able to archive a bookmark as a reversible action, distinct from permanent deletion.
- **FR-024**: System MUST hide archived bookmarks from normal lists and searches and show them only in a dedicated archive view, from which they can be restored.

**Bulk actions**

- **FR-025**: Users MUST be able to select multiple bookmarks, and optionally everything matching the current view, and apply tagging, mark read/unread, archive, or delete to the whole selection.
- **FR-026**: Bulk deletion MUST apply the same confirmation safeguard as single deletion.

**Sorting, saved searches & preferences**

- **FR-027**: Users MUST be able to sort the list by useful choices including date added and title, defaulting to most recently added first.
- **FR-028**: Users MUST be able to save a search that combines text with included and excluded tags, rerun it, and delete it.
- **FR-029**: Users MUST be able to set display preferences including default sort order, number of items shown, and text size, and System MUST persist them across reloads.

**Saved copies**

- **FR-030**: Users MUST be able to keep a saved local copy of a bookmarked page that can be reopened later.
- **FR-031**: When a bookmarked address points to a PDF, System MUST store the PDF file itself as the saved copy.
- **FR-032**: Users MUST be able to request preservation through the Internet Archive; System MUST record the resulting archive reference on success and report failure clearly without losing the bookmark.

**Import & export**

- **FR-033**: Users MUST be able to export the collection to a standard browser-bookmark HTML file.
- **FR-034**: Users MUST be able to import a standard browser-bookmark HTML file, mapping folder labels to tags where present and avoiding duplicates of already-saved addresses.

**General**

- **FR-035**: System MUST record the date each bookmark was added and the date it was last modified.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved web reference. Attributes: web address, title, description, formatted note, site icon, preview image, date added, date last modified, read/unread status, archived status, associated tags, and any saved-copy references.
- **Tag**: A short user-defined label grouping bookmarks. Many-to-many with bookmarks.
- **Saved Search**: A stored query combining search text with included and excluded tags, rerunnable by the user.
- **Saved Copy**: A preserved version of a bookmarked page — a local page snapshot, a stored PDF file, or an Internet Archive reference — associated with a bookmark.
- **Preferences**: The user's display settings: default sort order, number of items shown, and text size.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark, with page information collected automatically, in under 15 seconds from opening the app.
- **SC-002**: A user can locate a specific bookmark among at least 100 saved entries in under 10 seconds using search or a saved search.
- **SC-003**: 95% of first-time users successfully save, find, and reopen a bookmark without external help.
- **SC-004**: Saved bookmarks and their data are retained across 100% of app restarts with no data loss.
- **SC-005**: Search and filter results appear without a noticeable wait (perceived as instant) for collections up to 1,000 bookmarks.
- **SC-006**: A user can apply an action (tag, mark read/unread, archive, or delete) to at least 50 selected bookmarks in a single operation.
- **SC-007**: A user can archive and later restore a bookmark with no loss of its data, tags, notes, or saved copies.
- **SC-008**: Exporting and then re-importing a collection preserves 100% of bookmark addresses without creating duplicates.

## Assumptions

- **Single user, no login**: The app serves one person's personal collection with no accounts or sign-in (confirmed with client).
- **Web application**: Delivered as a browser-based app reviewed at the provided runtime address; native mobile/desktop apps are out of scope for v1.
- **Local persistence**: Bookmarks, saved copies, and preferences are stored by the application's own persistence layer on the server it runs on.
- **Automatic page information requires network access**: Collecting title/description/icon/preview and keeping saved copies require fetching the live page; when a page is unreachable, the app degrades gracefully (FR-006) rather than failing the save.
- **Internet Archive is an external dependency**: Preservation through the Internet Archive relies on that third-party service; when it is unavailable the local copy and bookmark are unaffected and the failure is reported honestly.
- **Simple note formatting**: "Simple formatting" means lightweight styling (e.g. bold, italics, lists, links) rather than a full rich-document editor.
- **English-language UI**: A single-language interface is sufficient for v1.

### Out of Scope (v1)

- User accounts and sign-in.
- Browser extensions or in-browser capture buttons.
- Syncing across multiple devices or browsers.
