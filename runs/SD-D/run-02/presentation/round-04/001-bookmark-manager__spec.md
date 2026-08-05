# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-07-13

**Status**: Approved (revision 4)

**Input**: User description: "An app to save and manage bookmarks" (revised after client review to
pull page-metadata capture, import/export, read-later, archiving, page snapshots, richer search,
sorting, and bulk actions into v1)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark with automatic page details (Priority: P1)

The user finds a web page they want to keep and saves it by giving the app its address. The
app then goes and looks at the page itself and fills in the details — its title, a short
description, the site's icon, and a preview image — so the user doesn't have to type any of
it. The user can adjust anything the app grabbed, either before saving or later.

**Why this priority**: Saving is the reason the app exists, and having the details filled in
automatically is what makes saving feel effortless. This alone is a usable product.

**Independent Test**: Save a valid link and confirm a new bookmark appears with a title,
description, icon, and preview that the app fetched from the page — with none of it typed by
the user — and that the user can edit those details.

**Acceptance Scenarios**:

1. **Given** a valid web address, **When** the user saves it, **Then** the app retrieves the
   page's title, description, site icon, and preview image and shows them on the new bookmark
   without the user typing them.
2. **Given** the app has fetched page details, **When** the user changes the title,
   description, or other fields before or after saving, **Then** the edited values are kept.
3. **Given** a page whose details cannot be fetched (unreachable, times out, or behind a
   login), **When** the user saves it, **Then** the bookmark is still saved with a fallback
   title derived from the address, and the user can fill in details manually.
4. **Given** an address missing its scheme (e.g. "example.com"), **When** the user saves it,
   **Then** the app normalizes it to a valid web address before saving.
5. **Given** a malformed or empty address, **When** the user tries to save it, **Then** the
   app rejects it with a clear message and saves nothing.
6. **Given** an address the user has already saved, **When** they save it again, **Then** the
   app quietly opens the existing bookmark for editing instead of creating a second copy — no
   duplicate is stored and no warning needs dismissing.

---

### User Story 2 - Browse, sort, and open bookmarks (Priority: P1)

The user opens the app, sees their saved bookmarks, arranges the list the way they like, and
clicks one to go to the actual web page.

**Why this priority**: Viewing and actually opening saved pages is the payoff of saving. A
collection you can't see or visit has no value. Together with Story 1 this is the MVP.

**Independent Test**: Pre-load several bookmarks, open the app, confirm they all appear, change
the sort order, and click a bookmark to confirm it navigates to its web page.

**Acceptance Scenarios**:

1. **Given** several saved bookmarks, **When** the user opens the app, **Then** all
   (non-archived) bookmarks are listed with title, address, the tags applied to each, and any
   icon/preview.
2. **Given** the list of bookmarks, **When** the user clicks or opens a bookmark, **Then** the
   app takes them to that bookmark's web page.
3. **Given** the list of bookmarks, **When** the user chooses a sort order (newest first,
   oldest first, or by title), **Then** the list reorders accordingly and newest-first is the
   default.
4. **Given** no bookmarks saved yet, **When** the user opens the app, **Then** a friendly empty
   state explains how to add the first bookmark.

---

### User Story 3 - Search and filter the collection (Priority: P2)

The user narrows a large collection to what they want by searching across everything they've
stored and combining criteria.

**Why this priority**: Once a collection grows, finding things is what keeps it useful. It
builds on the browsing view but is not required for the very first usable version.

**Independent Test**: Load bookmarks with varied titles, addresses, notes, and tags, then run
searches (keyword, tag typed inline, combined terms, exclusion, grouped conditions, exact
phrase) and confirm the results match.

**Acceptance Scenarios**:

1. **Given** a collection of bookmarks, **When** the user searches a keyword, **Then** matches
   are found across title, address, description, notes, and tags, ignoring capitalization.
2. **Given** bookmarks with tags, **When** the user types a tag directly into the search box
   alongside their words, **Then** the app understands it as a tag and narrows to bookmarks
   carrying it (in addition to clicking a tag to filter).
3. **Given** a search, **When** the user combines terms (for example, tagged "recipe" OR tagged
   "dinner", or requires two words together), **Then** the results respect that combination.
4. **Given** a search, **When** the user excludes a term (for example, articles but NOT those
   tagged "work"), **Then** matching-but-excluded bookmarks are left out of the results.
5. **Given** a search with several conditions, **When** the user groups conditions together (for
   example, "(recipe OR dinner) but not work"), **Then** the results respect that grouping.
6. **Given** a search, **When** the user wraps text in quotes to search an exact phrase,
   **Then** only bookmarks containing that exact phrase are returned.
7. **Given** a search or filter that matches nothing, **When** it runs, **Then** the app shows a
   clear "no matching bookmarks" state.
8. **Given** archived bookmarks exist, **When** the user searches the main collection, **Then**
   archived bookmarks are excluded unless the user is looking in the archive.

---

### User Story 4 - Organize with tags (Priority: P2)

The user labels bookmarks with tags and, while typing a tag, is offered tags they've used
before so the collection stays tidy.

**Why this priority**: Tagging is the main organizing tool and directly powers filtering, but
the app is usable before it exists.

**Independent Test**: Tag several bookmarks, confirm that typing a partial tag suggests
matching existing tags, and confirm filtering by a tag shows only bookmarks carrying it.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user adds one or more tags, **Then** the tags are stored
   and displayed with the bookmark, and the user can remove tags.
2. **Given** the user has used tags before, **When** they begin typing a tag, **Then** the app
   suggests existing tags that match so they can reuse one instead of creating a near-duplicate
   (e.g. avoiding both "recipe" and "recipes").
3. **Given** bookmarks with various tags, **When** the user filters by a tag, **Then** only
   bookmarks carrying that tag are shown.

---

### User Story 5 - Edit, notes, and delete (Priority: P2)

The user keeps bookmarks accurate: correcting details, jotting their own longer notes, and
permanently removing ones they no longer want.

**Why this priority**: Keeping the collection correct and adding personal notes matters for
long-term use, but is not needed on day one.

**Independent Test**: Edit a bookmark's fields and confirm they persist; write notes with basic
formatting and confirm it is kept; delete a bookmark and confirm it is gone after confirmation.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user edits its title, address, description, or
   tags, **Then** the updated values are saved and displayed.
2. **Given** an existing bookmark, **When** the user writes personal notes using basic
   formatting (such as headings and lists), **Then** the notes and their formatting are saved
   and shown with the bookmark.
3. **Given** an existing bookmark, **When** the user deletes it and confirms, **Then** it is
   permanently removed and no longer appears anywhere in the app.
4. **Given** a delete action, **When** it is triggered, **Then** the user is asked to confirm
   before the bookmark is permanently removed.

---

### User Story 6 - Read-later pile (Priority: P2)

The user marks pages as "to read," views just those, and marks them done so they drop off the
pile.

**Why this priority**: A dedicated reading queue is a distinct, valued workflow but separate
from the core save/find loop.

**Independent Test**: Mark several bookmarks as to-read, open the to-read view and confirm only
those appear, mark one as read, and confirm it leaves the to-read view.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user marks it as to-read (unread), **Then** it is flagged
   as to-read.
2. **Given** bookmarks flagged to-read, **When** the user opens the read-later view, **Then**
   only to-read bookmarks are shown.
3. **Given** a to-read bookmark, **When** the user marks it as read/done, **Then** it drops off
   the read-later view while remaining in the main collection.

---

### User Story 7 - Archive bookmarks (Priority: P2)

The user tucks away bookmarks they're finished with but don't want to lose — hidden from the
main list and searches, yet retrievable — as distinct from deleting, which is permanent.

**Why this priority**: Archiving keeps the working list uncluttered without the anxiety of
permanent loss; valuable, but not part of the minimal loop.

**Independent Test**: Archive a bookmark, confirm it disappears from the main list and default
searches, open the archive and confirm it's there, then unarchive it and confirm it returns.

**Acceptance Scenarios**:

1. **Given** a bookmark, **When** the user archives it, **Then** it is removed from the main
   list and excluded from default searches but preserved in the archive.
2. **Given** an archived bookmark, **When** the user views the archive, **Then** it is shown
   there and can be opened and unarchived.
3. **Given** an archived bookmark, **When** the user unarchives it, **Then** it returns to the
   main list. Archiving never deletes; deleting remains a separate, permanent action.

---

### User Story 8 - Keep a snapshot of the page (Priority: P3)

When the user saves a bookmark, the app also stores a copy of the page as it was at that
moment, so the user can still read it later even if the original page changes or disappears.

**Why this priority**: A durable copy is a strong safeguard against link rot and highly valued,
but the app delivers value before it exists.

**Independent Test**: Save a bookmark, confirm a snapshot is captured, then view the snapshot
and confirm the page content is readable from the stored copy.

**Acceptance Scenarios**:

1. **Given** a saved bookmark that points to a web page, **When** it is saved, **Then** the app
   captures a snapshot of the page's readable content as it was at save time.
2. **Given** a saved bookmark whose link is a PDF, **When** it is saved, **Then** the snapshot is
   the actual PDF file kept as-is (not a stripped-down web copy).
3. **Given** a bookmark with a snapshot, **When** the user opens the snapshot, **Then** they can
   read the stored copy — the readable page for a web page, or the original PDF for a PDF link.
4. **Given** a page whose content cannot be captured (e.g. behind a login or uncapturable),
   **When** it is saved, **Then** the bookmark is still saved and the app indicates a snapshot is
   unavailable.
5. *(Optional / nice-to-have)* **Given** the user has opted in, **When** they save a bookmark,
   **Then** the app also submits the page to a public web-archive service as a second safety net,
   and failing to do so never blocks saving or the local snapshot.

---

### User Story 9 - Bulk actions (Priority: P3)

The user selects many bookmarks at once and applies a single action to all of them — tagging,
archiving, or deleting them together.

**Why this priority**: Bulk operations are a big time-saver for tidying large collections, but
every action they perform also exists individually.

**Independent Test**: Select several bookmarks, apply a bulk action (e.g. add a tag or archive),
and confirm it applied to exactly the selected bookmarks.

**Acceptance Scenarios**:

1. **Given** the list of bookmarks, **When** the user selects several, **Then** the app shows
   which are selected and which bulk actions are available.
2. **Given** a set of selected bookmarks, **When** the user applies a bulk action — add a tag,
   remove a tag, mark read, mark to-read, archive, or delete — **Then** it is applied to all
   selected bookmarks.
3. **Given** the user has searched or filtered down to a set, **When** they choose "select all
   matching", **Then** every bookmark in that result set is selected at once without ticking
   each one.
4. **Given** a bulk delete, **When** it is triggered, **Then** the user is asked to confirm
   before permanent removal.

---

### User Story 10 - Import and export (Priority: P3)

The user brings an existing collection in from a browser bookmarks file and can export their
collection back out to a file, so they never feel locked in.

**Why this priority**: Import/export protects the user's investment and eases migration, but is
not part of the everyday save/find loop.

**Independent Test**: Import a standard browser bookmarks file and confirm its entries appear in
the collection; export the collection and confirm a file is produced containing the bookmarks.

**Acceptance Scenarios**:

1. **Given** a standard browser bookmarks file, **When** the user imports it, **Then** its
   entries are added to the collection.
2. **Given** an import that includes addresses already saved, **When** it runs, **Then**
   duplicates are not created (the same dedupe rule as manual saving applies).
3. **Given** a malformed or unsupported import file, **When** the user imports it, **Then** the
   app reports the problem clearly and imports nothing.
4. **Given** a collection of bookmarks, **When** the user exports, **Then** the app produces a
   file containing the user's bookmarks.

---

### User Story 11 - Saved searches (Priority: P3)

The user saves a search they run often — a combination of a tag and a keyword, say — under a
name, and re-runs it later with a single click instead of retyping it.

**Why this priority**: A convenience that speeds up repeated workflows, but every saved search
can still be performed manually.

**Independent Test**: Build a search (tag plus keyword), save it under a name, change the view,
then click the saved search and confirm it reproduces the same results.

**Acceptance Scenarios**:

1. **Given** a search the user has built, **When** they save it under a name, **Then** it is
   stored and appears in their list of saved searches.
2. **Given** a saved search, **When** the user clicks it, **Then** the app re-runs that search
   and shows the matching bookmarks.
3. **Given** a saved search, **When** the user no longer wants it, **Then** they can remove it.

---

### User Story 12 - Remembered preferences (Priority: P3)

The app remembers the user's preferences — such as their default sort order and a larger text
size for readability — so they are not reset every session.

**Why this priority**: Quality-of-life polish that improves comfort over time but is not part of
the core save/find loop.

**Independent Test**: Set a default sort order and a larger text size, close and reopen the app,
and confirm both preferences are still applied.

**Acceptance Scenarios**:

1. **Given** the user sets a preferred default sort order, **When** they reopen the app, **Then**
   the list is sorted that way by default.
2. **Given** the user increases the text size for readability, **When** they reopen the app,
   **Then** the larger text size is still applied.

---

### Edge Cases

- **Metadata fetch fails/times out or page is behind a login**: the bookmark still saves; the
  app uses a fallback title from the address and lets the user fill details in manually.
- **Missing icon or preview image**: the bookmark saves and displays cleanly without them.
- **Snapshot cannot be captured** (login-only or uncapturable page): the bookmark saves and the
  app marks the snapshot as unavailable rather than blocking the save.
- **PDF link**: the snapshot keeps the actual PDF file as-is rather than producing a stripped-down
  web copy.
- **Duplicate detection**: addresses are normalized before comparison so trivially different
  forms of the same address are treated as the same bookmark (redirects to the existing one).
- **Import contains duplicates**: handled by the same dedupe rule; no second copies created.
- **Import file malformed/unsupported**: rejected with a clear message, nothing imported.
- **Search/filter matches nothing**: a clear "no matching bookmarks" state is shown.
- **Archived items**: excluded from the main list, default searches, and the read-later pile
  unless the user is explicitly looking in the archive.
- **Very long title, address, or notes**: stored in full and displayed without breaking layout
  (e.g. truncated with the full value available).
- **Large collections**: the list, search, and sort remain responsive (see Success Criteria).
- **Bulk action on a large selection**: applies to exactly the selected items; destructive bulk
  actions require confirmation.

## Requirements *(mandatory)*

### Functional Requirements

**Saving & page details**

- **FR-001**: System MUST allow a user to save a bookmark by providing a web address.
- **FR-002**: On save, System MUST automatically fetch the page's details — title, short
  description, site icon, and preview image — and populate the bookmark with them without
  requiring the user to type them.
- **FR-003**: Users MUST be able to edit any fetched detail (title, description, etc.) both
  before saving and after the bookmark is saved.
- **FR-004**: When page details cannot be fetched, System MUST still save the bookmark using a
  fallback title derived from the address and allow the user to enter details manually.
- **FR-005**: System MUST validate that a submitted address is a well-formed web (http/https)
  address, normalize an address missing its scheme, and reject invalid input with a clear
  message while saving nothing.
- **FR-006**: When a user saves an address that already exists in the collection, System MUST
  open the existing bookmark for editing instead of creating a second copy — without requiring
  the user to dismiss a warning.
- **FR-007**: System MUST persist saved bookmarks so they remain available across sessions.
- **FR-008**: System MUST record when each bookmark was saved.

**Browsing, opening & sorting**

- **FR-009**: System MUST display the user's non-archived bookmarks in a list showing at least
  title, address, and the tags applied to each, plus icon/preview when available.
- **FR-010**: Users MUST be able to open a bookmark and be taken to its web page.
- **FR-011**: Users MUST be able to sort the list by newest first, oldest first, and by title,
  with newest first as the default.
- **FR-012**: System MUST present a clear empty state when no bookmarks exist and a clear "no
  results" state when a search or filter matches nothing.

**Search & filter**

- **FR-013**: Users MUST be able to search bookmarks across title, address, description, notes,
  and tags, ignoring capitalization.
- **FR-014**: Users MUST be able to filter by tag both by clicking a tag and by typing a tag
  directly into the search box alongside other words, where the app recognizes it as a tag.
- **FR-015**: Users MUST be able to combine search conditions — requiring multiple terms
  together, matching either of alternatives (OR across tags), **excluding** terms (NOT), and
  **grouping** conditions together — as well as searching for an exact phrase.
- **FR-016**: System MUST exclude archived bookmarks from default searches unless the user is
  searching within the archive.

**Tags**

- **FR-017**: Users MUST be able to assign zero or more tags to a bookmark and remove tags.
- **FR-018**: While the user types a tag, System MUST suggest previously used tags that match,
  to encourage reuse and avoid near-duplicate tags.

**Editing, notes & deletion**

- **FR-019**: Users MUST be able to edit an existing bookmark's title, address, description, and
  tags, with changes persisted.
- **FR-020**: Users MUST be able to write personal notes on a bookmark using basic rich
  formatting (such as headings and lists), and the formatting MUST be preserved.
- **FR-021**: Users MUST be able to delete a bookmark permanently, with a confirmation step
  before removal.

**Read-later**

- **FR-022**: Users MUST be able to mark a bookmark as to-read (unread) and as read/done.
- **FR-023**: System MUST provide a read-later view showing only to-read bookmarks, and a
  bookmark marked read MUST drop off that view while remaining in the collection.

**Archiving**

- **FR-024**: Users MUST be able to archive a bookmark, removing it from the main list and
  default searches while preserving it in an archive.
- **FR-025**: Users MUST be able to view archived bookmarks and unarchive them to return them to
  the main list. Archiving MUST be distinct from and never perform a permanent delete.

**Snapshots**

- **FR-026**: On save, System MUST capture a snapshot of the linked content as it was at save
  time: the page's readable content for a web page, or the actual PDF file kept as-is when the
  link is a PDF.
- **FR-027**: Users MUST be able to view a bookmark's snapshot later, including when the original
  page is unavailable; when a snapshot could not be captured, System MUST indicate it is
  unavailable without blocking the save.

- **FR-027a** *(Optional / nice-to-have)*: System SHOULD offer an opt-in to also submit a saved
  page to a public web-archive service as an additional safety net; a failure to submit MUST NOT
  block saving or the local snapshot. This is a nice-to-have and may be deferred without holding
  up the rest of v1.

**Bulk actions**

- **FR-028**: Users MUST be able to select multiple bookmarks at once, including a "select all
  matching" option that selects every bookmark in the current search/filter result set.
- **FR-029**: Users MUST be able to apply a single action — add a tag, remove a tag, mark read,
  mark to-read, archive, or delete — to all selected bookmarks at once, with destructive bulk
  actions requiring confirmation.

**Import & export**

- **FR-030**: Users MUST be able to import bookmarks from a standard browser bookmarks file,
  adding the entries to their collection using the same dedupe rule as manual saving.
- **FR-031**: System MUST reject a malformed or unsupported import file with a clear message,
  importing nothing.
- **FR-032**: Users MUST be able to export their collection to a file.

**Saved searches**

- **FR-033**: Users MUST be able to save a search (its terms, tags, and conditions) under a name,
  re-run it with a single action, and remove it when no longer needed.

**Preferences**

- **FR-034**: System MUST remember the user's preferences across sessions, including at least a
  preferred default sort order and a larger text size for readability, and apply them on reopen.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved reference to a web page. Attributes: web address, title, short
  description, personal notes (rich text), site icon, preview image, the tags applied to it,
  read state (to-read / read), archived state, date/time saved, and a reference to its snapshot.
- **Tag**: A short user-defined label used to group bookmarks. A tag may apply to many
  bookmarks, and a bookmark may carry many tags.
- **Snapshot**: A stored copy of the linked content captured at the time a bookmark was saved —
  the page's readable content for a web page, or the original PDF file kept as-is for a PDF
  link — linked to that bookmark and viewable even if the original later changes or disappears.
- **Saved Search**: A named, reusable search — its terms, tags, and conditions — that the user
  can re-run with a single action.
- **Preferences**: The user's remembered settings, including at least default sort order and
  text size, applied across sessions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark in under 15 seconds without typing any page
  details, and the fetched title/description/icon/preview appear on the bookmark within a few
  seconds without blocking further use of the app.
- **SC-002**: A user can locate a specific bookmark in a collection of at least 500 entries
  within 10 seconds using search, tag filtering, or sorting.
- **SC-003**: 95% of first-time users successfully save, find, and open a bookmark without
  external guidance.
- **SC-004**: Search, filter, and sort results appear to the user as immediate (perceived within
  1 second) for collections up to 1,000 bookmarks.
- **SC-005**: No saved bookmark is lost between sessions — 100% of saved (and archived)
  bookmarks are present when the user returns.
- **SC-006**: A user can import a browser bookmarks file of at least 500 entries and see them in
  their collection, with no duplicates created for addresses they already had.
- **SC-007**: A user can open a saved snapshot and read the page's content even when the original
  page is unreachable, for 100% of bookmarks whose snapshot was captured.

## Assumptions

- This is a single-user personal app for the first version; multi-user accounts, sharing, and
  collaboration are out of scope for v1.
- User authentication is out of scope for v1; the collection belongs to the local user.
- **Multi-device sync is out of scope for v1** (confirmed with client).
- Bookmarks reference web addresses (http/https); other schemes are out of scope for v1.
- Automatic page-detail fetching, page snapshots, and import/export are **in scope for v1**
  (pulled in during client review).
- "Basic rich formatting" for notes means a small, common set such as headings, bold/italic, and
  lists — not a full document editor.
- Snapshots capture the page's readable content; perfectly faithful reproduction of every page
  (complex scripts, media, paywalled content) is not guaranteed.
- Import targets the standard bookmarks file format that browsers export; format-specific edge
  cases beyond that are out of scope for v1.
- The specific platform (web, desktop, mobile) is deferred to the planning phase.
- Submitting pages to a public web-archive service (FR-027a) is an opt-in nice-to-have; it is a
  second safety net on top of the app's own snapshot, and may be deferred without holding up v1.
