# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-07-13

**Status**: Approved

**Input**: User description: "An app to save and manage bookmarks"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A person finds a web page they want to return to later. They save it in the app by
providing its address (URL). The app captures the page's title, site icon (favicon),
and a short description automatically where possible, and the bookmark appears in their
list so it can be found again.

**Why this priority**: Saving is the core reason the app exists. Without it, nothing
else has value. This alone is a usable product: capture links now, revisit later.

**Independent Test**: Add a bookmark by entering a URL, then confirm it appears in the
saved list with a recognizable title and its address intact.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user saves a valid URL, **Then** a new bookmark appears in the list showing its title and address.
2. **Given** a URL with no reachable title, **When** the user saves it, **Then** the bookmark is still saved and the address itself is shown as the title.
3. **Given** a bookmark that already exists with the same address, **When** the user tries to save it again, **Then** the app takes them straight to the existing bookmark ready for editing (to update its note, tags, etc.) instead of creating a duplicate or dead-ending.

---

### User Story 2 - Browse and open saved bookmarks (Priority: P1)

The person opens the app and sees their saved bookmarks in a list. They can open any
bookmark's page in their browser with a single action.

**Why this priority**: Saved links are worthless if they cannot be viewed and opened.
This pairs with Story 1 to form the minimum viable product.

**Independent Test**: With several bookmarks saved, view the list and open one; confirm
the correct page is launched.

**Acceptance Scenarios**:

1. **Given** several saved bookmarks, **When** the user opens the app, **Then** all bookmarks are listed with title and address.
2. **Given** a bookmark in the list, **When** the user chooses to open it, **Then** its page is launched in the browser.
3. **Given** no bookmarks saved yet, **When** the user opens the app, **Then** a clear empty state invites them to add their first bookmark.

---

### User Story 3 - Edit and delete bookmarks (Priority: P2)

The person keeps their collection tidy by correcting a title, fixing an address, or
removing bookmarks they no longer need.

**Why this priority**: Management (not just saving) is in the app's name. Needed for a
collection to stay useful over time, but the app is still usable without it.

**Independent Test**: Change a saved bookmark's title, confirm the change persists; then
delete a bookmark and confirm it no longer appears.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the user edits its title or address and saves, **Then** the updated values are shown and persist across sessions.
2. **Given** a saved bookmark, **When** the user deletes it, **Then** it is removed from the list.
3. **Given** a delete action, **When** the user confirms it, **Then** the bookmark is removed; **When** they cancel, **Then** nothing changes.

---

### User Story 4 - Organize with tags and search (Priority: P2)

As the collection grows, the person labels bookmarks with tags and searches or filters
to find what they need quickly. When typing a tag, the app suggests tags they have
already used so similar tags don't proliferate.

**Why this priority**: Turns a flat list into a manageable collection. Valuable at scale
but not required for the first usable version.

**Independent Test**: Tag several bookmarks, filter by a tag, and search by a keyword
found only in a note; confirm only matching bookmarks are shown regardless of letter case.

**Acceptance Scenarios**:

1. **Given** bookmarks with tags, **When** the user filters by a tag, **Then** only bookmarks carrying that tag are shown.
2. **Given** a search term, **When** the user searches, **Then** bookmarks whose title, address, note, or tags match the term are shown, matching case-insensitively (e.g., "Recipe" and "recipe" return the same results).
3. **Given** a search or filter with no matches, **When** it is applied, **Then** a clear "no results" state is shown.
4. **Given** existing tags in the collection, **When** the user begins typing a tag on a bookmark, **Then** matching already-used tags are suggested for selection.

---

### User Story 5 - Import existing browser bookmarks (Priority: P3)

The person already has a pile of bookmarks in their web browser, sorted into folders.
They bring those into the app in one action so they don't have to re-save everything by
hand — and the folder organization and original save dates come along with them.

**Why this priority**: High personal value for getting started, but the app is fully
usable without it (bookmarks can be added manually). Sequenced after the core save/
browse/manage/organize capabilities.

**Independent Test**: Import a standard browser bookmark export file containing folders
and confirm the bookmarks appear with their titles, addresses, folder names as tags, and
their original save dates preserved.

**Acceptance Scenarios**:

1. **Given** a standard browser bookmark export file, **When** the user imports it, **Then** each bookmark in the file is added to the list with its title and address.
2. **Given** an export in which bookmarks are organized into folders, **When** the user imports it, **Then** each bookmark's folder name(s) are applied as tags so the browser's organization is preserved (nested folders contribute each level as a tag).
3. **Given** an export in which bookmarks carry an original save date, **When** the user imports it, **Then** each bookmark keeps its original save date (rather than the date of import), so sorting by newest stays meaningful.
4. **Given** an import that includes an address already saved, **When** the import runs, **Then** the existing bookmark is kept (no duplicate is created) and the user is told how many were added versus skipped.
5. **Given** a file that is not a recognized bookmark export, **When** the user tries to import it, **Then** the app rejects it with a clear message and imports nothing.

---

### User Story 6 - Export bookmarks to a file (Priority: P3)

The person wants the assurance that their links are theirs to keep. They export their
whole collection to a file so they have a backup and can move it elsewhere if needed.

**Why this priority**: Not required for daily use, but essential for user trust and
avoiding lock-in. Kept deliberately simple — a plain "save my bookmarks to a file."

**Independent Test**: Export the collection to a file and confirm it contains the saved
bookmarks (addresses and titles) in a standard, re-openable format.

**Acceptance Scenarios**:

1. **Given** saved bookmarks, **When** the user exports, **Then** a file is produced containing their bookmarks (at least title and address) in a standard bookmark format.
2. **Given** an empty collection, **When** the user exports, **Then** a valid (empty) file is still produced without error.
3. **Given** a file exported from this app, **When** it is imported back (into this app or a browser), **Then** the bookmarks are recognized and restored.

---

### Edge Cases

- **Invalid address**: The user submits text that is not a valid web address — the app rejects it with a clear message and does not save.
- **Very long titles/addresses**: Titles and addresses are stored and displayed without breaking the layout (truncated with full value accessible).
- **Duplicate save**: Attempting to save an address that already exists opens the existing bookmark for editing instead of duplicating it.
- **Unreachable page on save**: If the page's title, icon, or description cannot be retrieved, saving still succeeds using the address as the title (icon/description simply left blank).
- **Import file with duplicates or errors**: Duplicate addresses in an import are skipped (existing bookmark kept); a malformed/unsupported file is rejected without importing anything.
- **Import without folders or dates**: Bookmarks stored loose (no folder) import with no tags added; bookmarks lacking an original date fall back to the import date.
- **Export of an empty collection**: Produces a valid, empty bookmark file without error.
- **Note formatting round-trip**: Formatted notes (links, bold, bullets) are stored so their formatting is preserved and re-displayed; search still matches the note's text content regardless of formatting.
- **Bulk data**: The list remains usable and responsive with a large number of bookmarks (e.g., thousands).
- **Deleting a tag in use**: Removing a tag from a bookmark does not delete the bookmark; a tag no longer used by any bookmark simply stops appearing in filters.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to save a bookmark by providing a web address (URL).
- **FR-002**: System MUST attempt to capture the page title automatically when a bookmark is saved, falling back to the address if no title is available.
- **FR-002a**: System MUST attempt to capture the site icon (favicon) and a short page description automatically when a bookmark is saved; if either is unavailable, the bookmark is still saved with that field left blank.
- **FR-002b**: Users MUST be able to edit the automatically captured description (and it is treated the same as the note in FR-015).
- **FR-003**: System MUST validate that the provided address is a well-formed web address and reject invalid input with a clear message.
- **FR-004**: System MUST prevent duplicate bookmarks of the same address; when a user attempts to save an address that already exists, the system MUST open the existing bookmark for editing instead of creating a duplicate.
- **FR-005**: System MUST persist saved bookmarks so they remain available across app restarts.
- **FR-006**: System MUST display all saved bookmarks in a list showing at least title and address.
- **FR-007**: Users MUST be able to open a bookmark's page in their web browser.
- **FR-008**: Users MUST be able to edit a bookmark's title and address.
- **FR-009**: Users MUST be able to delete a bookmark, with a confirmation step to prevent accidental loss.
- **FR-010**: Users MUST be able to assign one or more tags to a bookmark and remove tags.
- **FR-010a**: System MUST suggest already-used tags matching what the user is typing when they add a tag to a bookmark.
- **FR-011**: Users MUST be able to filter the bookmark list by tag.
- **FR-012**: Users MUST be able to search bookmarks by keyword matching title, address, note/description, or tags. Search MUST be case-insensitive.
- **FR-013**: System MUST show a clear empty state when no bookmarks exist and a "no results" state when a search or filter matches nothing.
- **FR-014**: System MUST record when each bookmark was saved and support ordering the list by most-recently-added (default) and alphabetically by title.
- **FR-015**: Users MUST be able to optionally add a note/description to a bookmark and apply basic formatting to it — at minimum links, bold, and bullet lists — which MUST be displayed formatted when the note is read.
- **FR-016**: Users MUST be able to import bookmarks from a standard browser bookmark export file, adding each bookmark's title and address; addresses that already exist MUST be skipped (no duplicates), and the user MUST be shown how many were added versus skipped.
- **FR-016a**: On import, System MUST convert the browser folder(s) containing each bookmark into tags on that bookmark (each level of a nested folder path contributing a tag), preserving the browser's organization.
- **FR-016b**: On import, System MUST preserve each bookmark's original save date from the export where present, rather than assigning the import date, so that ordering by most-recently-added remains meaningful.
- **FR-017**: System MUST reject an unrecognized or malformed import file with a clear message and import nothing in that case.
- **FR-018**: Users MUST be able to export their entire bookmark collection to a file in a standard, re-openable bookmark format (containing at least title and address).
- **FR-019**: A non-technical user MUST be able to start the app with a single action (e.g., one icon/shortcut) that opens it ready to use, with no per-use setup, commands, or configuration after the initial one-time install.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved link. Attributes: web address (URL), title, site icon (favicon), optional formatted description/note (links, bold, bullet lists), set of tags, date saved (may originate from an import), date last modified.
- **Tag**: A short text label used to group bookmarks. A bookmark may have many tags; a tag may apply to many bookmarks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark in under 15 seconds from opening the app.
- **SC-002**: A user can locate a specific bookmark in a collection of 1,000 using search or filter in under 10 seconds.
- **SC-003**: 95% of saved bookmarks display a meaningful title (page title captured, not just the raw address) for reachable pages.
- **SC-004**: The bookmark list remains responsive (results appear within 1 second) with at least 5,000 saved bookmarks.
- **SC-005**: No bookmark data is lost across app restarts in 100% of normal-use sessions.
- **SC-006**: In usability testing, 90% of new users successfully save and re-open a bookmark on their first attempt without guidance.
- **SC-007**: A user can import a browser bookmark export of 500 bookmarks in a single action, with folders preserved as tags and original dates retained, and a clear added-vs-skipped summary, in under 1 minute.
- **SC-008**: A user can export their entire collection to a file in a single action, and that file can be re-imported (into this app or a browser) with no bookmarks lost.
- **SC-009**: After the one-time install, a non-technical user can go from "I want to use it" to a ready-to-use app in a single action and under 10 seconds, with no typed commands or configuration.

## Assumptions

- **Single user, single device (v1, confirmed)**: The app serves one user and stores bookmarks locally. Multi-user accounts, cloud sync, and cross-device sharing are out of scope for v1.
- Bookmarks are web addresses (http/https); other URI schemes are out of scope for v1.
- Automatic capture of title, icon, and description depends on the page being reachable at save time; failure falls back to the address for the title and leaves icon/description blank, and is not treated as an error.
- **Import and export are both in scope** (User Stories 5 and 6, P3). Import reads standard browser bookmark export files, including folder structure (mapped to tags) and original save dates. Export writes a standard, re-openable bookmark file.
- The user has a working web browser available to open bookmark pages.
- The user is non-technical: day-to-day use must not require a terminal, typed commands, or manual configuration. A one-time install/setup step is acceptable; recurring fiddling is not (FR-019).
- Standard app expectations apply for error handling (clear messages) and data retention (bookmarks kept until the user deletes them).
