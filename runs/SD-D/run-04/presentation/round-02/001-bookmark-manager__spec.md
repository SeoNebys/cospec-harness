# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-07-14

**Status**: Draft

**Input**: User description: "An app to save and manage bookmarks"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark with rich preview (Priority: P1)

A person finds a web page worth keeping and saves it by entering its web address.
The app records the page and, on its own, pulls a short description, the site's
icon, and a preview picture where available, so the saved item reads as a
recognizable card rather than a line of plain text. The app confirms it was saved.

**Why this priority**: Saving is the core purpose of the app. Without it, nothing
else has value. This single story — capturing links and seeing them as readable
cards — is a viable MVP.

**Independent Test**: Enter a valid web address, save it, and confirm a new
bookmark card appears showing title, address, and whatever preview details
(description, icon, image) could be gathered.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the person saves a valid web address, **Then** a new bookmark appears showing its title and address, enriched with a description, site icon, and preview image when those can be obtained.
2. **Given** the person saves an address without typing a title, **When** the bookmark is created, **Then** the app supplies a default title (the page's own title if obtainable, otherwise its address).
3. **Given** the person enters something that is not a valid web address, **When** they try to save, **Then** the app rejects the entry and explains what is wrong, saving nothing.
4. **Given** the app fetched an odd or unhelpful description, **When** the person edits the description, **Then** their edited text is kept and shown instead.
5. **Given** a page whose details cannot be reached at save time, **When** the person saves it, **Then** saving still succeeds using the address as the title, with preview details left blank.

---

### User Story 2 - Open, browse, and find bookmarks (Priority: P2)

A person returns to their collection to reach a page they saved. Clicking a
bookmark opens the page. When the collection has grown, they locate a specific
item by searching words, an exact quoted phrase, or by combining tags — for
example, everything tagged both *recipes* and *dinner*, or *recipes* but not
*dessert*. Capitalization never matters.

**Why this priority**: A saved link that cannot be opened or found again has no
value. Opening and retrieval are the second-most critical capability.

**Independent Test**: With several bookmarks saved, click one and confirm the
page opens; then search a term and a quoted phrase and confirm only matching
bookmarks remain; combine two tags and confirm the result narrows correctly.

**Acceptance Scenarios**:

1. **Given** a saved bookmark, **When** the person clicks it, **Then** its web page opens.
2. **Given** multiple saved bookmarks, **When** the person types a search term, **Then** only bookmarks matching that term (in title, address, description, notes, or tags) are shown, regardless of letter case.
3. **Given** a search, **When** the person wraps words in quotes, **Then** only bookmarks containing that exact phrase are shown.
4. **Given** bookmarks with tags, **When** the person combines tags with "all of" (e.g., *recipes* and *dinner*), **Then** only bookmarks carrying every selected tag are shown.
5. **Given** bookmarks with tags, **When** the person excludes a tag (e.g., *recipes* but not *dessert*), **Then** bookmarks carrying the excluded tag are removed from the results.
6. **Given** an active search or tag filter, **When** the person clears it, **Then** the full list of bookmarks is shown again.
7. **Given** a search or filter that matches nothing, **When** it runs, **Then** the app shows a clear "no results" message rather than an empty screen.

---

### User Story 3 - Organize, edit, and tidy bookmarks (Priority: P3)

A person curates their collection over time: correcting a title, description, or
the address itself; adding notes; applying tags with help from suggestions of
tags they've used before; reordering the view; archiving items to get them out of
the way without losing them; and permanently deleting what they no longer want.

**Why this priority**: Organization keeps the collection valuable long-term, but
the app is already useful for capture and retrieval without it.

**Independent Test**: Open an existing bookmark, change its title, description,
and address, add a tag (choosing from a suggestion), and save; confirm the
changes persist. Archive a bookmark and confirm it leaves the main list but is
still recoverable. Delete a bookmark and confirm it is gone for good.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the person edits its title, description, notes, tags, or web address and saves, **Then** the updated values are shown and persist across sessions.
2. **Given** the person is typing a tag, **When** part of a previously used tag matches, **Then** the app suggests the existing tag so the same concept is not duplicated under slightly different spellings.
3. **Given** a list of bookmarks, **When** the person chooses a sort order, **Then** the list reorders by newest saved (default), oldest saved, or title.
4. **Given** an existing bookmark, **When** the person archives it, **Then** it is removed from the main list but remains available in an archived view and can be restored.
5. **Given** an existing bookmark, **When** the person deletes it, **Then** the app asks for confirmation, and on confirming, the bookmark is permanently removed and does not reappear after reopening the app.

---

### User Story 4 - Read-later shortlist (Priority: P3)

A person saves many pages they intend to get back to. They flag such items as
"read later" and can switch to a view that shows only those, working through them
and clearing the flag as they go.

**Why this priority**: A meaningful share of saving is deferred reading; a
dedicated shortlist makes that intent actionable. It builds on saving and
retrieval, so it follows them.

**Independent Test**: Flag two bookmarks as "read later," switch to the read-later
view, confirm only those two appear, clear the flag on one, and confirm it drops
out of that view but remains in the collection.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the person marks it "read later," **Then** it appears in the read-later view.
2. **Given** the read-later view, **When** the person opens it, **Then** only bookmarks flagged "read later" are shown.
3. **Given** a "read later" bookmark, **When** the person clears the flag, **Then** it leaves the read-later view but stays in the collection.

---

### Edge Cases

- **Duplicate address**: When a person saves an address that already exists, the app does not create a second copy and does not dead-end them — instead it opens the existing bookmark for editing, having recognized the match.
- **Very long titles, descriptions, or notes**: The app displays long text gracefully (truncation with full text available) rather than breaking the layout.
- **Address without a scheme** (e.g., `example.com` with no `https://`): The app normalizes it to a usable web address rather than rejecting it.
- **Unreachable page at save time**: Saving succeeds even if the page cannot be reached; fetching title, description, icon, and preview image is best-effort and never blocks saving.
- **Partial preview data**: When only some preview details are available (e.g., icon but no image), the app shows what it has and leaves the rest blank.
- **Archived items in search**: Archived bookmarks are excluded from the main list and default search results; the archived view is where they surface.
- **Empty collection**: A first-time person sees a welcoming empty state explaining how to add their first bookmark.
- **Empty read-later / archived views**: Each shows its own clear empty state rather than a blank screen.
- **Editing an address to one that already exists**: Treated like the duplicate case — the app prevents creating a collision and tells the person the address is already saved.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST allow a person to save a bookmark by providing a web address.
- **FR-002**: The app MUST validate that a submitted address is a well-formed web address, normalize an address that omits its scheme, and reject malformed entries with an explanatory message.
- **FR-003**: The app MUST let a person optionally provide a title, description, notes, and one or more tags when saving or editing a bookmark.
- **FR-004**: When no title is provided, the app MUST supply a default title derived from the page (its own title if obtainable, otherwise its address).
- **FR-005**: On saving, the app MUST attempt, on a best-effort basis, to gather preview details for the page — a short description, the site icon, and a preview image — and MUST NOT block or fail the save if any of these cannot be obtained.
- **FR-006**: The app MUST let a person edit the gathered description and keep the edited version.
- **FR-007**: The app MUST display saved bookmarks as cards showing at least the title and address, plus available preview details (description, icon, image).
- **FR-008**: The app MUST open a bookmark's web page when the person selects/clicks it.
- **FR-009**: The app MUST let a person search bookmarks by text matching against title, address, description, notes, and tags, with matching that ignores letter case.
- **FR-010**: The app MUST support exact-phrase search when the person wraps text in quotes.
- **FR-011**: The app MUST let a person filter by tags, including requiring multiple tags together ("all of") and excluding a tag ("not"), and MUST let the person clear all filters.
- **FR-012**: The app MUST suggest previously used tags as a person types a tag, to discourage near-duplicate tags.
- **FR-013**: The app MUST let a person edit the title, description, notes, tags, and web address of an existing bookmark, with changes persisted.
- **FR-014**: The app MUST let a person sort the list by newest saved (default), oldest saved, or title.
- **FR-015**: The app MUST let a person mark a bookmark "read later," view only read-later bookmarks, and clear the flag.
- **FR-016**: The app MUST let a person archive a bookmark — removing it from the main list and default search results while keeping it in a separate archived view — and restore it from there.
- **FR-017**: The app MUST let a person permanently delete a bookmark, and MUST ask for confirmation before permanent removal.
- **FR-018**: The app MUST persist all bookmarks, tags, flags, and archived state so they remain available after the app is closed and reopened.
- **FR-019**: When a person saves an address that already matches an existing bookmark (including via editing another bookmark's address), the app MUST NOT create a duplicate and MUST bring up the existing bookmark for editing instead of blocking with a dead end.
- **FR-020**: The app MUST show a clear empty state when no bookmarks exist, and a clear "no results" state when a search or filter matches nothing, including for the read-later and archived views.
- **FR-021**: The app MUST record the date each bookmark was saved and the date it was last modified.

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved reference to a web page. Attributes: web address, title, description (auto-gathered, person-editable), notes, site icon, preview image, saved date, last-modified date, "read later" flag, archived state, and associated tags.
- **Tag**: A short label a person applies to bookmarks to group them by topic or purpose. A bookmark may carry several tags; a tag may apply to many bookmarks. Previously used tags are offered as suggestions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person can save a new bookmark in under 20 seconds from opening the app, without waiting on preview-detail gathering.
- **SC-002**: A person can locate a specific bookmark among at least 500 saved items in under 5 seconds using search or tag filtering.
- **SC-003**: 95% of first-time users successfully save, find, and open a bookmark without external instructions.
- **SC-004**: No saved bookmark is ever lost between sessions under normal use (100% persistence of confirmed saves); archiving never loses data.
- **SC-005**: Search and filtering return results with no perceptible delay (results appear effectively instantly) for collections up to 500 bookmarks.
- **SC-006**: For pages that publish standard preview information, at least 90% of saves display a description and site icon without the person editing anything.
- **SC-007**: Saving an already-saved address results in zero duplicate entries in 100% of cases.

## Assumptions

- **Single user, single device**: v1 serves one person on one device; multi-user accounts, sharing, and cross-device sync are out of scope. *(Confirmed by client.)*
- **No authentication in v1**: The collection is personal and local, so sign-in is not required. *(Confirmed by client.)*
- **Local persistence**: Bookmarks are stored locally on the person's device; cloud storage is out of scope for v1.
- **Manual capture**: Bookmarks are added by entering an address within the app; browser-extension "one-click" capture and bulk import from browsers are out of scope for v1. *(Confirmed by client.)*
- **Best-effort enrichment**: Retrieving a page's title, description, icon, and preview image is a convenience; if any cannot be fetched, saving still succeeds and the person can fill in details manually.
- **Tags over folders**: Organization uses flat tags rather than nested folders. *(Confirmed by client.)*
- **Duplicate = same normalized address**: Two entries are considered the same bookmark when their normalized web addresses match.
- **Archive is reversible; delete is permanent**: Archiving hides an item but keeps it; deletion (after confirmation) removes it for good.
- **Reasonable scale**: The collection is expected to hold up to a few thousand bookmarks, not millions.
