# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-09-16

**Status**: Draft (rev 2 — scope updated: tags, notes, auto-enrichment, duplicate-to-edit, enriched search)

**Input**: User description: "Build an app to save and manage bookmarks."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark with automatic enrichment (Priority: P1)

A person finds a web page they want to return to later. They paste or enter the
page's address and save it. The app automatically fills in the page's title,
description, favicon, and a preview image when it can retrieve them, so the
user doesn't have to type these details. The bookmark then appears in their
list of saved bookmarks.

**Why this priority**: Saving is the core purpose of the app. Without it there
is nothing to manage. Automatic enrichment is what makes saving effortless and
the collection recognizable at a glance, so it belongs in the core slice.

**Independent Test**: Enter a valid web address, save it, and confirm it appears
in the list — with title/description/favicon/preview populated when the page
provides them — and is still present after reloading or reopening the app.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the user enters a valid web
   address for a reachable page and saves, **Then** the bookmark is saved and
   its title, description, favicon, and preview image are filled in
   automatically from the page.
2. **Given** a page whose details cannot be retrieved (unreachable, or no
   metadata available), **When** the user saves, **Then** the bookmark is still
   saved and shown using the user-entered title or a name derived from the
   address, without blocking on the missing details.
3. **Given** the automatic title/description is not what the user wants, **When**
   they save, **Then** they can override any auto-filled field before or after
   saving.
4. **Given** a saved bookmark, **When** the user reloads or reopens the app,
   **Then** the bookmark and its enriched details are still present.

---

### User Story 2 - Browse and open saved bookmarks (Priority: P1)

A person opens the app to see everything they have saved and clicks a bookmark
to open the original page in their browser.

**Why this priority**: Saved links have no value unless they can be viewed and
revisited. Combined with Story 1 this forms the minimum useful product.

**Independent Test**: With several bookmarks saved, view the full list and click
one to confirm it opens the correct destination in a new browser tab.

**Acceptance Scenarios**:

1. **Given** several saved bookmarks, **When** the user opens the app, **Then**
   all saved bookmarks are listed with their titles and addresses.
2. **Given** a bookmark in the list, **When** the user activates it, **Then**
   the original web page opens in a new browser tab.
3. **Given** no bookmarks have been saved, **When** the user opens the app,
   **Then** a clear empty state invites them to add their first bookmark.

---

### User Story 3 - Organize with tags and notes (Priority: P2)

A person adds their own tags and a free-text note to a bookmark to organize and
annotate their collection, and can later view or change these.

**Why this priority**: Tags and notes are the primary organizing mechanism the
client requested. They make a growing collection meaningful, but the collection
is still usable to save and revisit links without them.

**Independent Test**: Add two tags and a note to a bookmark, confirm they are
shown with the bookmark and persist after reload; edit and remove them and
confirm the changes persist.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user adds one or more tags,
   **Then** the tags are shown with the bookmark and persist after reload.
2. **Given** an existing bookmark, **When** the user writes a free-text note and
   saves, **Then** the note is stored and shown with the bookmark and persists
   after reload.
3. **Given** a bookmark with tags, **When** the user removes a tag, **Then** the
   tag no longer appears on that bookmark.
4. **Given** the user is entering tags, **When** they type, **Then** previously
   used tags are suggested to encourage reuse and avoid near-duplicates.

---

### User Story 4 - Edit and delete bookmarks (Priority: P2)

A person corrects a bookmark's title, address, or other details, or removes a
bookmark they no longer need.

**Why this priority**: Management (keeping the collection tidy and accurate) is
the second half of the request, but the collection is still useful without it.

**Independent Test**: Edit an existing bookmark's title and confirm the change
persists; delete a bookmark and confirm it disappears and stays gone after
reload.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the user edits its title, address,
   description, tags, or note and saves, **Then** the updated values are shown
   and persist after reload.
2. **Given** an existing bookmark, **When** the user deletes it and confirms,
   **Then** it is removed from the list and does not reappear after reload.
3. **Given** a delete action, **When** the user is asked to confirm, **Then**
   they can cancel and the bookmark remains.
4. **Given** a bookmark whose auto-filled details are stale or missing, **When**
   the user requests a refresh, **Then** the app attempts to re-fetch the
   title, description, favicon, and preview.

---

### User Story 5 - Find bookmarks quickly (Priority: P3)

A person with many saved bookmarks searches or filters by keyword to locate a
specific one without scrolling through the whole list.

**Why this priority**: Improves usability at scale but is not needed for a
functional first version.

**Independent Test**: With many bookmarks saved, type a keyword and confirm only
matching bookmarks (by title, address, description, tags, or note) are shown.

**Acceptance Scenarios**:

1. **Given** many saved bookmarks, **When** the user types a keyword, **Then**
   only bookmarks whose title, address, description, tags, or note matches the
   keyword are shown.
2. **Given** many saved bookmarks, **When** the user selects a tag, **Then** only
   bookmarks carrying that tag are shown.
3. **Given** a search with no matches, **When** results are displayed, **Then** a
   clear "no results" message is shown.
4. **Given** an active search or tag filter, **When** the user clears it, **Then**
   the full list is shown again.

---

### Edge Cases

- What happens when the user submits an empty address or one that is not a valid
  web address? The app rejects it with a clear message and does not save.
- What happens when the user tries to save an address that is already bookmarked?
  The app recognizes the duplicate and guides the user to open and edit the
  existing bookmark instead of creating a second entry (see FR-009).
- What happens when a page's details cannot be fetched (offline, timeout, blocked,
  or no metadata)? The bookmark is still saved; enrichment fields are left empty
  or fall back to the address, and saving is never blocked by enrichment.
- What happens when enrichment is slow? Saving completes promptly and enrichment
  may fill in shortly afterward without the user waiting on it.
- How does the app handle a very long title, address, note, or many tags? It
  stores the full value and displays it without breaking the layout (e.g.,
  truncates visually).
- What happens when a preview image is very large or unavailable? The app uses a
  sensible placeholder and does not break the layout.
- What happens when the list is empty? A friendly empty state is shown.
- What happens if the user cancels an edit midway? No changes are saved.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a user to save a bookmark by providing a web
  address; a title and other details are optional at save time.
- **FR-002**: System MUST validate that the address is a well-formed web address
  before saving and reject invalid input with a clear message.
- **FR-003**: System MUST, when no title is available, display the bookmark using
  the address or a name derived from it.
- **FR-004**: System MUST persist saved bookmarks and all their details so they
  remain available after the app is reloaded or reopened.
- **FR-005**: System MUST display all saved bookmarks in a list showing each
  bookmark's title, address, favicon, tags, and (when available) preview image.
- **FR-006**: Users MUST be able to open a bookmark's original web page from the
  list (in a new browser tab).
- **FR-007**: System MUST, when a bookmark is saved, automatically attempt to
  retrieve the page's title, description, favicon, and preview image, and store
  whatever it successfully retrieves.
- **FR-008**: System MUST treat automatic enrichment as best-effort: if any
  detail cannot be retrieved (unreachable page, timeout, or missing metadata),
  the bookmark is still saved and unavailable fields are left empty or fall back
  to the address. Saving MUST NOT be blocked by enrichment.
- **FR-009**: System MUST detect when a user saves an address that is already
  bookmarked and, instead of rejecting it, guide the user to open and edit the
  existing bookmark.
- **FR-010**: Users MUST be able to add, view, edit, and remove their own tags on
  a bookmark, and to add and edit a free-text note on a bookmark.
- **FR-011**: System MUST suggest previously used tags while the user is entering
  tags, to encourage reuse.
- **FR-012**: Users MUST be able to edit an existing bookmark's title, address,
  description, tags, and note, with changes persisted; and MUST be able to
  override any automatically filled field.
- **FR-013**: Users MUST be able to request a refresh of a bookmark's
  automatically filled details (title, description, favicon, preview).
- **FR-014**: Users MUST be able to delete a bookmark, with a confirmation step
  before removal.
- **FR-015**: System MUST show a clear empty state when no bookmarks exist.
- **FR-016**: Users MUST be able to search bookmarks by keyword matching the
  title, address, description, tags, or note, and MUST be able to filter the
  list by selecting a tag.
- **FR-017**: System MUST record when each bookmark was added and present
  bookmarks in a predictable order (most recently added first by default).

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved reference to a web page. Key attributes: web address,
  display title, description, favicon, preview image, a free-text note, the set
  of tags applied to it, and the date/time it was added. Title, description,
  favicon, and preview may be populated automatically from the page or overridden
  by the user.
- **Tag**: A short user-defined label used to group and filter bookmarks. A
  bookmark may carry many tags, and a tag may apply to many bookmarks. Reused
  across bookmarks and offered as suggestions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can save a new bookmark in under 15 seconds from opening the
  app.
- **SC-002**: 100% of saved bookmarks remain available after the app is reloaded
  or reopened.
- **SC-003**: A user can locate a specific bookmark among at least 100 saved
  bookmarks in under 10 seconds using search across title, address, description,
  tags, and note, or by filtering on a tag.
- **SC-004**: Invalid addresses are rejected in 100% of attempts with a clear
  explanation, and 100% of attempts to save an already-bookmarked address route
  the user to edit the existing bookmark rather than creating a duplicate.
- **SC-005**: The bookmark list renders and becomes usable within 2 seconds for
  a collection of up to 500 bookmarks.
- **SC-006**: For reachable pages that expose standard metadata, automatic
  enrichment populates at least the title and favicon in at least 90% of saves,
  and a failed or slow enrichment never prevents a bookmark from being saved.

## Assumptions

- This is a single-user application for a first version; multi-user accounts,
  sign-in, and sharing are out of scope for v1.
- Bookmarks are stored locally/persistently for that single user; cloud sync
  across devices is out of scope for v1.
- Tags and free-text notes ARE in scope for v1. Folders/hierarchical
  organization are out of scope for v1, but the data model should not preclude
  adding them later.
- Automatic enrichment (title, description, favicon, preview image) IS in scope
  for v1, on a best-effort basis: it relies on the target page being reachable
  and exposing standard metadata, and never blocks saving. Enrichment quality
  depends on what each page publishes.
- Enrichment fetches page metadata from the target web pages themselves; no
  third-party enrichment service is assumed. Pages behind logins, or that block
  automated fetching, may yield little or no metadata.
- The app is used through a modern web browser on desktop; dedicated mobile apps
  are out of scope for v1, though the layout should remain readable on smaller
  screens.
- "Valid web address" means an http or https URL.
