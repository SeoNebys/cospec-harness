# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-16

**Status**: Draft (revised after client review)

**Input**: User description: "An app to save and manage bookmarks" — expanded in
review to include automatic metadata capture, rich per-bookmark data (note,
tags, read/unread, archive), advanced search, bulk actions, saved searches, page
snapshots and Internet Archive saving, import/export, and display preferences.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a link with automatic details (Priority: P1)

A person finds a web page worth keeping. They paste or type its address and save
it. The app automatically collects the page's title, description, favicon, and a
preview image so the saved bookmark is recognizable without extra typing. They
can adjust the title and description if they wish. If they save an address that
is already bookmarked, the app takes them straight to the existing bookmark to
edit rather than creating a duplicate.

**Why this priority**: Effortless capture with recognizable details is the core
value; it is what makes the collection worth building and browsing.

**Independent Test**: Save a real web address; confirm the bookmark appears with
an auto-collected title, description, favicon, and preview image, and that the
title/description are editable. Save the same address again and confirm it opens
the existing bookmark instead of adding a second one.

**Acceptance Scenarios**:

1. **Given** a valid new web address, **When** the user saves it, **Then** the
   app fetches and stores the page's title, description, favicon, and preview
   image, and shows the new bookmark.
2. **Given** a saved bookmark, **When** the user edits its title or description,
   **Then** the edited values are stored and shown in place of the fetched ones.
3. **Given** the page provides no description or no preview image, **When** the
   bookmark is saved, **Then** the app stores what it can and uses clear
   fallbacks (e.g. the address as the title) without failing.
4. **Given** an address that already exists in the collection, **When** the user
   saves it again, **Then** the app opens the existing bookmark for editing and
   does not create a duplicate.
5. **Given** an empty or non-http/https address, **When** the user tries to
   save, **Then** the app rejects it with a clear explanation and saves nothing.

---

### User Story 2 - Browse and open saved bookmarks (Priority: P1)

The person returns to find something they saved. The normal list clearly shows
each bookmark's title, description, tags, and favicon. They click a bookmark to
open the original page in a new browser tab.

**Why this priority**: Saved links are only valuable if they can be recognized,
found, and reopened; browsing is inseparable from saving.

**Independent Test**: With several bookmarks saved, load the normal list and
confirm each row shows title, description, tags, and favicon, and that clicking a
bookmark opens its original page in a new tab.

**Acceptance Scenarios**:

1. **Given** one or more non-archived bookmarks, **When** the user opens the
   app, **Then** the normal list shows each bookmark's title, description, tags,
   and favicon.
2. **Given** a bookmark in the list, **When** the user activates it, **Then**
   the original page opens in a new browser tab.
3. **Given** no bookmarks have been saved yet, **When** the user opens the app,
   **Then** a friendly empty state invites them to add their first bookmark.

---

### User Story 3 - Organize with notes, tags, read state, and archive (Priority: P2)

The person curates their collection. They add a personal note to a bookmark,
assign multiple tags (helped by suggestions drawn from tags they already use),
mark items unread / read-later, and archive things they want out of the way.
Unread items and archived items each have their own view; archived items never
appear in normal browsing or search.

**Why this priority**: This is the heart of "managing" rather than merely
storing bookmarks, but the app is already useful for capture and reopening
without it.

**Independent Test**: On a bookmark, add a note and several tags (confirming
suggestions appear from existing tags), toggle its read/unread state, and archive
it. Confirm it leaves the normal list, appears in the archived view, and is
excluded from normal search; confirm unread items appear in the unread view.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user adds or edits a free-text note,
   **Then** the note is stored and shown when viewing that bookmark.
2. **Given** a bookmark, **When** the user assigns one or more tags, **Then**
   the tags are stored, shown in the list, and offered as suggestions when
   tagging other bookmarks.
3. **Given** the user is typing a tag, **When** existing tags match what they
   type, **Then** the app suggests those existing tags to reuse.
4. **Given** a bookmark, **When** the user marks it unread/read-later or read,
   **Then** its state updates and the unread view reflects the change.
5. **Given** a bookmark, **When** the user archives it, **Then** it disappears
   from the normal list and normal search and appears in the archived view;
   **When** unarchived, it returns to normal browsing.
6. **Given** the archived and unread views, **When** the user opens either,
   **Then** each shows exactly the bookmarks in that state.

---

### User Story 4 - Search precisely (Priority: P2)

The person searches to pinpoint bookmarks. Search matches across title,
description, note, and address, ignoring capitalization. They can search a `#tag`,
put words in quotes for an exact phrase, and combine terms with AND, OR, and NOT,
grouped with parentheses. They can also sort the results.

**Why this priority**: Precise retrieval is essential once a collection grows,
but a small collection is browsable without it.

**Independent Test**: With a varied collection, run searches that exercise
case-insensitive matching across all four fields, a `#tag` search, a quoted exact
phrase, and a boolean expression with AND/OR/NOT and parentheses; confirm only
the correct bookmarks appear and that sorting reorders them.

**Acceptance Scenarios**:

1. **Given** bookmarks whose title, description, note, or address contain a
   keyword, **When** the user searches that keyword in any capitalization,
   **Then** all matching non-archived bookmarks are returned.
2. **Given** tagged bookmarks, **When** the user searches `#tagname`, **Then**
   only bookmarks carrying that tag are returned.
3. **Given** a quoted phrase, **When** the user searches it, **Then** only
   bookmarks containing that exact phrase (ignoring capitalization) match.
4. **Given** a boolean expression using AND, OR, NOT and parentheses, **When**
   the user searches it, **Then** results honor the logical combination and
   grouping.
5. **Given** any result set, **When** the user chooses a sort order, **Then**
   the results reorder accordingly and the choice is respected.
6. **Given** archived bookmarks, **When** the user searches the normal view,
   **Then** archived bookmarks are excluded from results.
7. **Given** a search with no matches, **When** results are empty, **Then** the
   app shows a clear "no matches" state and a way to clear the search.

---

### User Story 5 - Act on many bookmarks at once (Priority: P3)

The person tidies in bulk. They select several bookmarks and apply a change to
all of them at once (for example add a tag, mark read, or archive). They can also
apply an action to every bookmark matching the current view/search, not just
those on screen.

**Why this priority**: A major convenience for large collections, but every bulk
action can be done one-by-one, so it follows the single-item flows.

**Independent Test**: Select several bookmarks and apply a bulk action, then
apply an action to all bookmarks matching the current filter; confirm each
affected bookmark changed and unaffected ones did not.

**Acceptance Scenarios**:

1. **Given** several selected bookmarks, **When** the user applies a bulk action
   (tag, untag, mark read/unread, archive/unarchive, delete), **Then** the
   action applies to exactly the selected bookmarks.
2. **Given** an active view or search, **When** the user chooses "apply to all
   matching," **Then** the action applies to every bookmark matching that view,
   including those not currently on screen.
3. **Given** a destructive bulk action (delete), **When** the user confirms,
   **Then** the app removes the affected bookmarks and reports how many changed.

---

### User Story 6 - Save and reuse searches (Priority: P3)

The person has searches they run often. They save a search (its keywords,
filters, and sort) under a name and reopen it later with one click.

**Why this priority**: A productivity boost layered on top of search; search is
usable without it.

**Independent Test**: Build a search, save it with a name, change the view, then
reopen the saved search and confirm it restores the same query, filters, and
sort.

**Acceptance Scenarios**:

1. **Given** an active search with filters and sort, **When** the user saves it
   with a name, **Then** it appears in a list of saved searches.
2. **Given** a saved search, **When** the user opens it, **Then** the app
   restores the same query, filters, and sort and shows matching results.
3. **Given** a saved search, **When** the user renames or deletes it, **Then**
   the change persists.

---

### User Story 7 - Keep copies: snapshots and Internet Archive (Priority: P3)

The person guards against link rot. For a bookmark they capture a local snapshot
of the page as it looked when saved (a PDF stays a PDF, kept as-is), and/or ask
that the page be saved to the Internet Archive. They can later open the local
snapshot and the Internet Archive copy.

**Why this priority**: Valuable durability feature, but independent of core
capture and retrieval.

**Independent Test**: Take a snapshot of a normal page and confirm it can be
reopened offline; bookmark a PDF address and confirm its snapshot is the original
PDF; trigger Internet Archive saving and confirm the bookmark records a link to
the archived copy.

**Acceptance Scenarios**:

1. **Given** a bookmark to a normal web page, **When** the user takes a
   snapshot, **Then** the app stores a viewable local copy of the page content
   and lets the user reopen it.
2. **Given** a bookmark whose address is a PDF, **When** the user takes a
   snapshot, **Then** the stored snapshot is the PDF itself, kept as a PDF.
3. **Given** a bookmark, **When** the user requests Internet Archive saving,
   **Then** the app submits the address to the Internet Archive and records a
   link to the archived copy on the bookmark.
4. **Given** snapshotting or Internet Archive saving cannot complete (page or
   service unreachable), **When** it fails, **Then** the app reports the failure
   and leaves the bookmark otherwise intact.

---

### User Story 8 - Import and export bookmarks (Priority: P3)

The person moves bookmarks in and out. They import an existing browser bookmarks
file (the standard Netscape bookmark-file format that browsers export) and export
their collection back to that same format, so the app interoperates with browsers
and other bookmark tools.

**Why this priority**: Important for onboarding and portability, but not needed
to use the app day to day.

**Independent Test**: Import a Netscape bookmark file exported from a browser and
confirm the bookmarks (and their folders/tags where applicable) appear; export
the collection and confirm the file re-imports correctly into a browser or back
into the app.

**Acceptance Scenarios**:

1. **Given** a standard Netscape bookmark file, **When** the user imports it,
   **Then** its bookmarks are added to the collection with their addresses and
   titles preserved.
2. **Given** the user's collection, **When** they export, **Then** the app
   produces a standard Netscape bookmark file that browsers and the app can
   re-import.
3. **Given** an import that would introduce addresses already present, **When**
   importing, **Then** the app avoids creating duplicates (consistent with the
   duplicate rule in User Story 1).
4. **Given** a malformed or non-bookmark file, **When** the user imports it,
   **Then** the app reports the problem and imports nothing rather than
   corrupting the collection.

---

### User Story 9 - Tune the display (Priority: P3)

The person adjusts how the collection looks and reads. They set a default sort
order, how many items are shown per page/screen, and the font size.

**Why this priority**: Comfort and accessibility improvement; the app works with
defaults without it.

**Independent Test**: Change the default sort, items-per-view, and font size;
confirm each takes effect immediately and persists across reloads.

**Acceptance Scenarios**:

1. **Given** the display preferences, **When** the user changes the default sort
   order, **Then** lists use that order by default.
2. **Given** the display preferences, **When** the user changes how many items
   are shown, **Then** the list shows that many and the setting persists.
3. **Given** the display preferences, **When** the user changes the font size,
   **Then** the interface text resizes and the setting persists.

---

### Edge Cases

- **Metadata fetch fails or is partial**: If a page is unreachable or omits a
  description/preview image/favicon, the app saves the bookmark with sensible
  fallbacks and lets the user fill in the title/description manually.
- **Slow metadata fetch**: Saving is not blocked indefinitely; the bookmark is
  created promptly and details fill in when available, with a clear indicator.
- **Duplicate on save and on import**: Re-saving or importing an existing
  address routes to / keeps the existing bookmark instead of duplicating.
- **Address without a scheme** (e.g. `example.com`): normalized to a usable
  http/https address; non-web schemes are rejected.
- **PDF and other non-HTML targets**: Metadata is best-effort; a snapshot of a
  PDF keeps the original PDF.
- **Archived items**: never appear in the normal list or normal search; only in
  the archived view.
- **Large snapshots / large collection**: snapshots may be large; the app keeps
  the list responsive with hundreds of bookmarks and many snapshots, and handles
  running low on local storage gracefully.
- **Invalid or contradictory search expression**: unbalanced parentheses or
  empty boolean terms produce a clear explanation, not a crash.
- **Internet Archive unavailable**: reported as a recoverable failure; the
  bookmark is unaffected and the action can be retried.
- **Bulk "apply to all matching" on a large set**: reports progress/outcome and
  never partially corrupts bookmarks.

## Requirements *(mandatory)*

### Functional Requirements

#### Capture & metadata

- **FR-001**: System MUST let a user save a bookmark from a web address.
- **FR-002**: System MUST validate the address as a well-formed http/https
  address, normalizing a missing scheme, and reject empty/invalid input with a
  clear explanation.
- **FR-003**: On save, System MUST automatically fetch and store the page's
  title, description, favicon, and preview image where available.
- **FR-004**: System MUST let the user edit a bookmark's title and description,
  and MUST prefer the user's edits over the auto-fetched values.
- **FR-005**: System MUST apply clear fallbacks when metadata is missing or the
  page is unreachable, without failing the save.
- **FR-006**: When saving an address that already exists, System MUST open the
  existing bookmark for editing and MUST NOT create a duplicate.

#### Per-bookmark data & states

- **FR-007**: System MUST let a user attach a free-text note to a bookmark.
- **FR-008**: System MUST let a user assign multiple free-text tags to a
  bookmark and MUST suggest previously used tags while the user is typing.
- **FR-009**: System MUST let a user set a bookmark's read state
  (unread/read-later vs. read).
- **FR-010**: System MUST let a user archive and unarchive a bookmark.
- **FR-011**: System MUST record each bookmark's creation and last-updated
  timestamps.

#### Browsing & views

- **FR-012**: The normal list MUST show each bookmark's title, description, tags,
  and favicon, and MUST exclude archived bookmarks.
- **FR-013**: Users MUST be able to open a bookmark's original page in a new
  browser tab.
- **FR-014**: System MUST provide a separate unread view and a separate archived
  view, each showing exactly the bookmarks in that state.
- **FR-015**: System MUST present a friendly empty state when a view has no
  bookmarks.

#### Search & sort

- **FR-016**: Search MUST match, case-insensitively, against title, description,
  note, and address.
- **FR-017**: Search MUST support `#tag` queries that match bookmarks carrying
  that tag.
- **FR-018**: Search MUST support quoted exact-phrase queries.
- **FR-019**: Search MUST support boolean operators AND, OR, and NOT with
  parentheses for grouping, and MUST clearly report invalid expressions.
- **FR-020**: Normal search MUST exclude archived bookmarks.
- **FR-021**: System MUST let users sort lists and search results by supported
  orders (at least most-recently-saved, title, and read state).

#### Bulk actions

- **FR-022**: Users MUST be able to select multiple bookmarks and apply a single
  action to all of them (tag, untag, mark read/unread, archive/unarchive,
  delete).
- **FR-023**: Users MUST be able to apply an action to every bookmark matching
  the current view/search, including items not currently on screen.
- **FR-024**: Destructive bulk actions MUST require confirmation and report how
  many bookmarks were affected.

#### Saved searches

- **FR-025**: Users MUST be able to save a search (query, filters, and sort)
  under a name, and reopen, rename, and delete it later.
- **FR-026**: Opening a saved search MUST restore its query, filters, and sort.

#### Snapshots & Internet Archive

- **FR-027**: Users MUST be able to capture a local snapshot of a bookmark's page
  and reopen it later; a PDF target MUST be stored as the original PDF.
- **FR-028**: Users MUST be able to request Internet Archive saving of a
  bookmark's address, and the bookmark MUST record a link to the archived copy.
- **FR-029**: System MUST report snapshot or Internet Archive failures as
  recoverable and leave the bookmark otherwise intact.

#### Import & export

- **FR-030**: Users MUST be able to import a standard Netscape bookmark file,
  preserving addresses and titles and avoiding duplicates.
- **FR-031**: Users MUST be able to export their collection as a standard
  Netscape bookmark file that browsers and the app can re-import.
- **FR-032**: System MUST reject a malformed/non-bookmark import file with a
  clear message and import nothing rather than corrupting the collection.

#### Display preferences & persistence

- **FR-033**: Users MUST be able to set display preferences — default sort order,
  number of items shown, and font size — and these MUST persist across reloads.
- **FR-034**: System MUST persist all bookmarks, their data/states, tags, saved
  searches, snapshots, and preferences so they survive closing and reopening the
  app on the same device.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved reference to a web page. Attributes: address (required);
  title and description (auto-fetched, user-editable); favicon; preview image;
  note; tags (zero or more); read state (unread/read); archived flag; creation
  and last-updated timestamps; optional local snapshot; optional Internet
  Archive link.
- **Tag**: A short free-text label attached to bookmarks for grouping and
  filtering; many-to-many with bookmarks; drives tag suggestions and `#tag`
  search.
- **Saved Search**: A named, reusable query capturing keywords, filters (e.g.
  tags, read/archive scope), and sort order.
- **Snapshot**: A stored local copy of a bookmark's page content at capture time
  (original file kept as-is for PDFs), reopenable offline.
- **Display Preferences**: Per-user settings for default sort order, items shown
  per view, and font size.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save their first bookmark within 30 seconds of opening
  the app for the first time, and see auto-collected title, description, favicon,
  and preview image appear without extra typing.
- **SC-002**: In 100% of cases, saving an address that already exists opens the
  existing bookmark instead of creating a duplicate.
- **SC-003**: All saved data (bookmarks, notes, tags, states, saved searches,
  snapshots, preferences) is still present after closing and reopening the app,
  with no data loss.
- **SC-004**: A user can locate a specific bookmark in under 10 seconds using
  keyword, `#tag`, phrase, or boolean search when they remember something about
  it.
- **SC-005**: Archived bookmarks appear in 0% of normal-list and normal-search
  results, and 100% appear in the archived view.
- **SC-006**: A user can apply a change to at least 100 selected or matching
  bookmarks in a single bulk action and see all of them updated.
- **SC-007**: A Netscape bookmark file exported by the app re-imports
  successfully into a mainstream browser and back into the app with addresses and
  titles intact.
- **SC-008**: The list and search remain responsive (visible update in under 1
  second) with at least 500 saved bookmarks.
- **SC-009**: 95% of first-time users complete the core loop — save a bookmark,
  then find and reopen it — on their first attempt.

## Assumptions

- **Single user, personal use** on a **browser-based web app**; no accounts,
  sign-in, or sharing; no native mobile/desktop app or browser extension in v1.
  *(Confirmed by client.)*
- **Same-device persistence**: data survives reload on the same device;
  cross-device sync is out of scope for v1. *(Confirmed by client.)*
- **Standard web addresses only** (http/https). *(Confirmed by client.)*
- **Automatic metadata capture is in scope** (title, description, favicon,
  preview image), fetched from the page at save time on a best-effort basis with
  fallbacks. *(Revised: previously out of scope.)*
- **Browser import/export is in scope** via the standard Netscape bookmark-file
  format. *(Revised: previously out of scope.)*
- **Snapshots and Internet Archive saving** depend on the target page and the
  Internet Archive service being reachable; failures are surfaced as recoverable.
- **Local storage limits**: snapshots (especially PDFs) can be large; the app
  is expected to store them locally and degrade gracefully when device storage
  runs low.
- **English-language, single-locale UI** for v1.
