# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-25

**Status**: Draft

**Input**: User description: "An app to save and manage bookmarks" (refined with
metadata capture, deduplication, Markdown notes, rich search, read-later,
bulk actions, archiving, saved filters, local/Internet Archive copies,
import/export, and display preferences)

## Clarifications

### Session 2026-09-25

- Q: How aggressively should near-identical addresses be treated as the same page for duplicate detection? → A: Light normalization — ignore scheme, `www.` prefix, host capitalization, trailing slash, and common tracking parameters (e.g. `utm_*`, `fbclid`); keep the path and other meaningful query parameters significant.
- Q: What read state should a newly saved bookmark have by default? → A: Read. Items appear in the "read later" (unread) view only when the user deliberately marks them for later reading.
- Q: On import, when an incoming address already exists, how should the two be reconciled? → A: Merge non-destructively — union tags, keep the earliest saved date, preserve existing title/description/note, and only fill fields that are currently empty.
- Q: What should the preserved local copy contain? → A: A full-page copy that preserves the page's appearance and content in a single self-contained file. For PDF links, keep the original PDF instead.
- Q: How should tags be carried through bookmark HTML import/export? → A: Use the common `TAGS="tag1,tag2"` attribute on each bookmark entry, so multiple tags survive a round-trip without duplicating bookmarks across folders.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark with rich metadata (Priority: P1)

A person finds a web page they want to keep. They enter its address and the app
automatically collects the page's title, description, site icon, and a preview
image. Before saving, the person can adjust the title and description. The
bookmark is stored and appears in their list.

**Why this priority**: Capturing a link with useful, editable context is the
core reason the app exists. It is a viable MVP on its own.

**Independent Test**: Save a bookmark by entering an address, confirm the fetched
title/description/icon/preview appear and can be edited before saving, then
confirm the bookmark persists after reload.

**Acceptance Scenarios**:

1. **Given** a valid address, **When** the user saves it, **Then** the app
   attempts to collect the page title, description, site icon, and preview image
   and shows them on the bookmark.
2. **Given** a bookmark being saved, **When** the user edits the title or
   description before saving, **Then** the edited values are stored instead of
   the fetched ones.
3. **Given** metadata cannot be retrieved, **When** the user saves, **Then** the
   bookmark is still created using the address as the title and blank optional
   fields, without blocking the save.
4. **Given** the user enters a value that is not a valid web address, **When**
   they try to save, **Then** the app rejects it with a clear message and does
   not create a bookmark.

---

### User Story 2 - Save the same address without duplicates (Priority: P1)

When a person saves an address they have saved before, the app does not create a
second copy. Instead it takes them to the existing bookmark so they can review
or edit it.

**Why this priority**: Duplicate-free saving protects the integrity of the
collection and is tightly coupled to the core save flow.

**Independent Test**: Save an address, then save the same address again and
confirm no second bookmark is created and the existing one is opened for editing.

**Acceptance Scenarios**:

1. **Given** an address already saved, **When** the user saves it again, **Then**
   no duplicate is created and the app navigates to the existing bookmark in an
   editable view.
2. **Given** two addresses that differ only by trivial variations (trailing
   slash, scheme, `www.` prefix, host capitalization, common tracking
   parameters such as `utm_*`/`fbclid`), **When** the second is saved, **Then**
   the app treats them as the same bookmark; distinct paths and other meaningful
   query parameters remain separate bookmarks.

---

### User Story 3 - Browse and find bookmarks (Priority: P2)

A person browses a readable list of their bookmarks and searches to find a
specific one. The list emphasizes readability, showing each bookmark's title,
description, tags, and site icon. Search covers the title, description, note, and
address, ignoring capitalization.

**Why this priority**: A growing collection is only useful if items can be read
and found again. Depends on saving existing.

**Independent Test**: With several bookmarks saved, confirm the list shows title,
description, tags, and icon; search a keyword found only in a note and confirm
the matching bookmark appears.

**Acceptance Scenarios**:

1. **Given** several saved bookmarks, **When** the user opens the app, **Then**
   each bookmark is shown with its title, description, tags, and site icon.
2. **Given** several saved bookmarks, **When** the user searches a term, **Then**
   the list shows only bookmarks whose title, description, note, or address
   matches, regardless of capitalization.
3. **Given** a search that matches nothing, **When** results are empty, **Then**
   a clear "no results" message is shown.
4. **Given** a listed bookmark, **When** the user activates its link, **Then**
   its web page opens in a new browser tab.

---

### User Story 4 - Rich search expressions (Priority: P2)

A person narrows a large collection using a search language: `#tag` to require a
tag, "quoted phrases" for exact matches, and the operators AND, OR, NOT with
parentheses to combine conditions.

**Why this priority**: Precise retrieval is a major differentiator for a serious
collection and builds directly on basic search.

**Independent Test**: Enter an expression such as `#work AND ("release notes" OR
changelog) NOT #archive` and confirm the results match the logic.

**Acceptance Scenarios**:

1. **Given** tagged bookmarks, **When** the user searches `#work`, **Then** only
   bookmarks tagged `work` are shown.
2. **Given** bookmarks with varied text, **When** the user searches a quoted
   phrase, **Then** only bookmarks containing that exact phrase match.
3. **Given** a combined expression using AND, OR, NOT and parentheses, **When**
   it is entered, **Then** results honor the boolean logic and grouping.
4. **Given** a malformed expression (e.g. unbalanced parentheses), **When** it is
   entered, **Then** the app shows a clear message and does not crash or return
   misleading results.

---

### User Story 5 - Read-later workflow (Priority: P2)

A person deliberately marks selected bookmarks as "read later" and works through
them in a dedicated read-later (unread) view, marking each as read when done.
Newly saved bookmarks are read by default and do not clutter this view.

**Why this priority**: A read-later queue is a primary everyday workflow for a
bookmarking tool and shapes how items are triaged.

**Independent Test**: Save a bookmark (confirm it is not in the read-later view),
mark it "read later", confirm it appears there, mark it read, and confirm it
leaves the view.

**Acceptance Scenarios**:

1. **Given** a newly saved bookmark, **When** the user opens the read-later
   view, **Then** the bookmark does not appear there, because new saves default
   to read.
2. **Given** a bookmark, **When** the user marks it "read later" (unread),
   **Then** it appears in the read-later view.
3. **Given** an item in the read-later view, **When** the user marks it read,
   **Then** it no longer appears there but remains in the main collection.

---

### User Story 6 - Organize with tags (Priority: P3)

A person groups related bookmarks with flexible tags and filters the list to a
chosen tag. A bookmark may carry several tags at once.

**Why this priority**: Tagging adds meaningful organization at scale but is not
required for the app to be useful.

**Independent Test**: Apply a tag to two bookmarks, filter by that tag, and
confirm only those two appear.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user adds or removes tags, **Then** the
   change is saved and the tags are displayed with the bookmark.
2. **Given** bookmarks with different tags, **When** the user filters by a tag,
   **Then** only bookmarks carrying that tag appear.
3. **Given** an active tag filter, **When** the user clears it, **Then** the full
   list returns.

---

### User Story 7 - Personal notes with Markdown (Priority: P3)

A person adds a personal note to a bookmark, written with Markdown formatting
(headings, lists, links, emphasis), which is displayed formatted when viewing the
bookmark.

**Why this priority**: Notes turn a link list into a personal knowledge store,
but are secondary to capture and retrieval.

**Independent Test**: Add a Markdown note to a bookmark, save, and confirm it is
displayed with its formatting applied and persists after reload.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user writes a note using Markdown and
   saves, **Then** the note is stored and shown with its formatting rendered.
2. **Given** a note containing text, **When** the user searches for a word only
   present in the note, **Then** the bookmark is found.

---

### User Story 8 - Edit and delete bookmarks (Priority: P3)

A person keeps the collection accurate by editing a bookmark's details (title,
description, address, tags, note, read state) or deleting links they no longer
need.

**Why this priority**: Maintenance keeps the collection trustworthy, but the app
delivers value before it exists.

**Independent Test**: Edit a bookmark's title and note, confirm they persist,
then delete a bookmark and confirm it is gone after reload.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user edits any of its fields and
   saves, **Then** the updated values are shown and persist after reload.
2. **Given** an existing bookmark, **When** the user deletes it and confirms,
   **Then** it is removed and does not reappear after reload.
3. **Given** a delete action, **When** the user is asked to confirm, **Then**
   nothing is removed unless the user confirms.

---

### User Story 9 - Sort and act on many bookmarks at once (Priority: P3)

A person sorts the list and selects multiple bookmarks to apply one action to all
of them: change tags, change read status, archive, or delete. They can also apply
an action to every bookmark matching the current search or filter, not only the
visible page.

**Why this priority**: Bulk maintenance makes a large collection manageable and
saves substantial effort.

**Independent Test**: Select three bookmarks, add a tag to all three in one
action, and confirm all three carry the tag; then apply an action to "all
matching" a search and confirm items beyond the current page are affected.

**Acceptance Scenarios**:

1. **Given** a list of bookmarks, **When** the user chooses a sort order, **Then**
   the list reorders accordingly.
2. **Given** several selected bookmarks, **When** the user applies a bulk action
   (add/remove tags, mark read/unread, archive, or delete), **Then** the action
   applies to all selected items.
3. **Given** an active search or filter, **When** the user chooses "apply to all
   matching results", **Then** the action affects every matching bookmark,
   including those not on the current page, and excludes non-matching items.
4. **Given** a bulk delete, **When** the user confirms, **Then** all selected
   items are removed; **When** the user cancels, **Then** none are removed.

---

### User Story 10 - Archive bookmarks (Priority: P3)

A person moves bookmarks they want to keep but no longer see day-to-day into an
archive. Archived items live in their own view and are excluded from the normal
list and ordinary searches. Archiving is reversible and distinct from deleting.

**Why this priority**: Archiving keeps the working list focused without losing
history; it complements, and is safer than, deletion.

**Independent Test**: Archive a bookmark, confirm it disappears from the main
list and ordinary search, appears in the archive view, and can be restored.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user archives it, **Then** it leaves the
   main list and ordinary search results and appears in the archive view.
2. **Given** an archived bookmark, **When** the user restores it, **Then** it
   returns to the main list.
3. **Given** archived bookmarks, **When** the user searches the normal
   collection, **Then** archived items are excluded unless the user explicitly
   searches the archive.

---

### User Story 11 - Saved reusable filters (Priority: P4)

A person saves a named, reusable filter that combines a search expression with a
set of included tags and a set of excluded tags, then applies it later in one
action.

**Why this priority**: Saved filters speed up recurring retrieval but build on
search, tags, and archiving already existing.

**Independent Test**: Create a saved filter combining a search term with an
included and an excluded tag, apply it later, and confirm the same results
return.

**Acceptance Scenarios**:

1. **Given** a search with included and excluded tags, **When** the user saves it
   with a name, **Then** it appears in a list of saved filters.
2. **Given** a saved filter, **When** the user applies it, **Then** the list
   shows exactly the bookmarks matching its search, including its included tags
   and excluding its excluded tags.
3. **Given** a saved filter, **When** the user edits or deletes it, **Then** the
   change is reflected in the saved-filter list.

---

### User Story 12 - Preserve a local and Internet Archive copy (Priority: P4)

When a person saves a page, the app keeps a local copy of the saved content so it
remains available if the original changes or disappears. When the saved link is a
PDF, the original PDF is preserved. The app also offers an Internet Archive copy
of the page.

**Why this priority**: Durable copies protect against link rot, a valued but
advanced capability layered on top of saving.

**Independent Test**: Save a normal page and confirm a local copy can be opened;
save a PDF link and confirm the original PDF is preserved; confirm an Internet
Archive link is offered for a saved page.

**Acceptance Scenarios**:

1. **Given** a saved web page, **When** the bookmark is created, **Then** a
   full-page local copy is preserved as a single self-contained file that
   reproduces the page's appearance and can be opened from the bookmark.
2. **Given** a saved link that is a PDF, **When** the bookmark is created, **Then**
   the preserved local copy is the original PDF.
3. **Given** a saved page, **When** the user views the bookmark, **Then** a link
   to the most recent Internet Archive snapshot is offered; if no snapshot
   exists, the app indicates none is available and offers to request one be
   archived.
4. **Given** the local copy cannot be captured, **When** saving, **Then** the
   bookmark is still created and the absence of a local copy is indicated rather
   than blocking the save.

---

### User Story 13 - Import and export bookmarks (Priority: P4)

A person imports bookmarks from a standard browser bookmark file and exports their
collection to the same format, preserving titles, tags, and saved dates so they
can move between tools.

**Why this priority**: Portability protects the user's investment and eases
adoption, but is not needed to use the app day to day.

**Independent Test**: Export the collection to the standard bookmark file format,
re-import it, and confirm titles, tags, and saved dates are preserved without
duplicates.

**Acceptance Scenarios**:

1. **Given** a standard browser bookmark file, **When** the user imports it,
   **Then** its bookmarks are added with their titles, tags, and saved dates
   preserved.
2. **Given** an import that includes an address already saved, **When** it is
   imported, **Then** no duplicate is created; the existing bookmark is merged
   non-destructively — new tags are added, the earliest saved date is kept, the
   existing title/description/note are preserved, and only empty fields are
   filled from the import.
3. **Given** the collection, **When** the user exports it, **Then** a standard
   browser bookmark file is produced containing titles, tags, and saved dates.

---

### User Story 14 - Personal display preferences (Priority: P4)

A person sets personal display preferences: the default sort order, how many
items are shown at once, and the text size.

**Why this priority**: Personalization improves comfort and readability but is a
finishing touch.

**Independent Test**: Change the default sort, items-per-view, and text size,
reload, and confirm the preferences are remembered and applied.

**Acceptance Scenarios**:

1. **Given** the preferences, **When** the user sets a default sort order, **Then**
   the list opens in that order on next visit.
2. **Given** the preferences, **When** the user sets how many items are shown,
   **Then** the list shows that many per view.
3. **Given** the preferences, **When** the user changes the text size, **Then**
   the list text is displayed at that size and the choice persists.

---

### Edge Cases

- **Metadata failures**: If title, description, icon, or preview cannot be
  fetched, the bookmark still saves with sensible fallbacks (address as title,
  blank optional fields, generic icon).
- **Duplicate on save**: Saving a known address opens the existing bookmark
  rather than creating a copy; near-duplicate addresses are matched using light
  normalization (ignore scheme, `www.`, host case, trailing slash, and common
  tracking parameters), while distinct paths and meaningful query parameters
  stay separate.
- **Malformed search**: Unbalanced quotes/parentheses or a stray operator yield a
  clear message, not a crash or misleading results.
- **Empty states**: Distinct, clear messages for an empty collection, no search
  matches, an empty unread view, and an empty archive.
- **Archived items and search**: Archived items are excluded from ordinary search
  and the main list; they are only found via the archive view.
- **Bulk "apply to all matching"**: The action set is defined by the active
  search/filter at the moment of applying and excludes archived items unless the
  archive is the active view.
- **Local copy limits**: Pages requiring login, or that block capture, may yield
  an incomplete or missing local copy; this is indicated and does not block
  saving. Very large pages/PDFs above the configured size limit are bookmarked
  with the local copy marked unavailable.
- **Internet Archive gaps**: If no snapshot exists, the app indicates none is
  available and offers to request one be archived.
- **Import format variance**: Bookmark files without tags or dates still import;
  missing fields fall back to defaults (e.g., import date as saved date).
- **Very long text**: Long titles, descriptions, and notes are stored in full and
  shown in a readable, truncated form.
- **Markdown safety**: Rendered notes must not execute embedded active content;
  formatting is displayed safely.

## Requirements *(mandatory)*

### Functional Requirements

#### Saving & metadata

- **FR-001**: System MUST let a user save a bookmark by providing a web address.
- **FR-002**: System MUST validate the address is well-formed and reject invalid
  entries with a clear message.
- **FR-003**: On save, System MUST attempt to collect the page's title,
  description, site icon, and preview image.
- **FR-004**: System MUST let the user edit the title and description both before
  saving and at any time afterward.
- **FR-005**: System MUST still create a usable bookmark when metadata retrieval
  fails, using the address as the title and leaving optional fields blank.
- **FR-006**: System MUST prevent duplicate bookmarks for the same address,
  comparing addresses after light normalization (ignore scheme, `www.` prefix,
  host capitalization, trailing slash, and common tracking parameters such as
  `utm_*` and `fbclid`; keep the path and other meaningful query parameters
  significant); when the user saves an already-saved address, System MUST open
  the existing bookmark for editing instead of creating a copy.

#### Notes

- **FR-007**: System MUST let a user attach a personal note to a bookmark written
  in Markdown, and MUST display the note with its formatting rendered safely
  (without executing embedded active content).

#### Display, search & sort

- **FR-008**: System MUST present bookmarks in a readable list showing each
  bookmark's title, description, tags, and site icon.
- **FR-009**: System MUST let a user open a bookmark's web page in a new tab.
- **FR-010**: System MUST provide search across title, description, note, and
  address, ignoring capitalization.
- **FR-011**: System MUST support a search expression language including `#tag`
  membership, quoted exact phrases, and the operators AND, OR, and NOT with
  parenthesized grouping.
- **FR-012**: System MUST handle malformed search expressions gracefully with a
  clear message and no misleading results.
- **FR-013**: System MUST let a user sort the list by saved date (newest or
  oldest first), by title (A–Z or Z–A), and by most recently updated.
- **FR-014**: System MUST show clear, distinct empty states for an empty
  collection and for no-match search/filter results.

#### Tags & saved filters

- **FR-015**: System MUST let a user add and remove multiple tags on a bookmark
  and filter the list by a chosen tag.
- **FR-016**: System MUST let a user create, apply, edit, and delete named saved
  filters that combine a search expression with a set of included tags and a set
  of excluded tags.

#### Read-later & archive

- **FR-017**: System MUST maintain a read/unread state per bookmark, defaulting
  newly saved bookmarks to read, and provide a dedicated read-later (unread)
  view listing only bookmarks the user has explicitly marked "read later"; users
  MUST be able to mark items read or "read later" both individually and in bulk.
- **FR-018**: System MUST let a user archive and restore bookmarks; archiving MUST
  be reversible and distinct from deletion.
- **FR-019**: System MUST exclude archived bookmarks from the main list and from
  ordinary searches, and MUST provide a separate archive view for them.

#### Bulk actions

- **FR-020**: System MUST let a user select multiple bookmarks and apply a single
  action to all of them: add/remove tags, mark read/unread, archive/restore, or
  delete.
- **FR-021**: System MUST let a user apply a bulk action to all bookmarks matching
  the current search or filter (not only the visible page), and MUST exclude
  non-matching bookmarks from that action.
- **FR-022**: System MUST require confirmation before bulk deletion.

#### Editing & deletion

- **FR-023**: Users MUST be able to edit a bookmark's title, description, address,
  tags, note, and read state.
- **FR-024**: Users MUST be able to delete a bookmark, with confirmation before
  removal.

#### Preserved copies

- **FR-025**: On save, System MUST preserve a full-page local copy of the saved
  page as a single self-contained file that reproduces the page's appearance and
  content, openable from the bookmark.
- **FR-026**: When the saved link is a PDF, the preserved local copy MUST be the
  original PDF.
- **FR-027**: System MUST offer a link to the most recent Internet Archive
  snapshot of a saved page; when no snapshot is available, System MUST indicate
  this and offer to request the page be archived.
- **FR-028**: When a local copy cannot be captured, System MUST still create the
  bookmark and indicate that no local copy is available.

#### Import & export

- **FR-029**: System MUST import bookmarks from the standard browser bookmark HTML
  format, preserving titles, saved dates, and tags carried via the common
  `TAGS="tag1,tag2"` attribute on each entry.
- **FR-030**: System MUST export the collection to the standard browser bookmark
  HTML format, preserving titles and saved dates and writing tags via the common
  `TAGS="tag1,tag2"` attribute so multiple tags survive a round-trip without
  duplicating bookmarks.
- **FR-031**: On import, System MUST not create duplicates for addresses already
  saved; it MUST merge non-destructively — union the tags, keep the earliest
  saved date, preserve any existing title/description/note, and fill only fields
  that are currently empty.

#### Persistence & preferences

- **FR-032**: System MUST persist all bookmarks and their data so they remain
  available across app restarts and reloads.
- **FR-033**: System MUST let a user set and persist display preferences: default
  sort order, number of items shown at once, and text size.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved reference to a web page. Attributes: web address
  (normalized for duplicate detection), display title, description, site icon,
  preview image, Markdown note, tags, saved date, read/unread state, archived
  state, and references to preserved copies (local copy and Internet Archive
  link). Relationships: carries many tags; has one local copy.
- **Tag**: A short user-defined label used to group bookmarks. Attribute: name.
  Relationship: applies to many bookmarks.
- **Saved Filter**: A named, reusable retrieval definition. Attributes: name,
  search expression, included tags, excluded tags. Relationship: references tags.
- **Preserved Copy**: A stored capture of a bookmark's page. Attributes: type
  (page snapshot or original PDF), capture date, availability status.
  Relationship: belongs to one bookmark.
- **Display Preferences**: The user's personal presentation settings. Attributes:
  default sort order, items shown per view, text size.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark, with metadata fetched and editable,
  in under 30 seconds.
- **SC-002**: A user can locate a specific bookmark within a collection of 1,000+
  bookmarks in under 10 seconds using search, tag, or a saved filter.
- **SC-003**: 100% of saved bookmarks and their data (notes, tags, states,
  preserved-copy references) remain present and unchanged after closing and
  reopening the app.
- **SC-004**: Saving an already-saved address results in zero duplicates in 100%
  of attempts and opens the existing bookmark.
- **SC-005**: A rich search expression using tags, quoted phrases, and boolean
  operators returns logically correct results in 100% of well-formed cases, and a
  clear message in 100% of malformed cases.
- **SC-006**: A bulk action applied to "all matching results" affects every
  matching bookmark and no non-matching bookmark, verified across a collection
  spanning multiple pages.
- **SC-007**: Archived bookmarks appear in 0% of ordinary searches and the main
  list, and 100% remain restorable.
- **SC-008**: Exporting then re-importing a collection preserves 100% of titles,
  tags, and saved dates and creates zero duplicates.
- **SC-009**: 95% of first-time users can save, find, and open a bookmark without
  external instructions.

## Assumptions

- **Single user, private, browser-based (v1)**: The app manages one person's
  private collection with no sign-in or multi-user accounts, delivered as a
  browser-based web app reviewed at the project's runtime addresses. Sharing
  between users is out of scope for v1.
- **Organization by flexible tags**: Grouping uses tags (a bookmark may hold
  several) rather than a strict folder hierarchy.
- **Metadata and copies are best-effort**: Fetching title/description/icon/preview
  and capturing local or Internet Archive copies may fail for some pages; such
  failures never block saving and are indicated to the user.
- **Standard bookmark file format**: Import/export uses the common browser
  bookmark HTML (Netscape) format widely supported by mainstream browsers; tags
  are carried via the common `TAGS="tag1,tag2"` attribute on each bookmark entry.
- **Markdown notes are rendered safely**: Notes support common Markdown and are
  displayed without executing embedded scripts or active content.
- **Modern desktop browser**: Users access the app with a current mainstream
  desktop browser; a dedicated mobile layout is a later enhancement.
- **Reasonable capture limits**: Full-page local copies are subject to a
  sensible maximum size to keep storage manageable; pages exceeding it are still
  bookmarked with the oversize copy indicated as unavailable. The exact limit is
  an implementation detail to confirm during planning.
