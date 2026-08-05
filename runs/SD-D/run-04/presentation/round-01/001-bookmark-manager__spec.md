# Feature Specification: Bookmark Manager

**Feature Branch**: `001-bookmark-manager`

**Created**: 2026-07-14

**Status**: Draft

**Input**: User description: "An app to save and manage bookmarks"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a bookmark (Priority: P1)

A person finds a web page worth keeping and saves it to the app by entering its
web address. The app records the page and confirms it was saved, so the person
can return to it later without relying on memory or browser history.

**Why this priority**: Saving is the core purpose of the app. Without it, nothing
else has value. This single story is a viable MVP: a person can capture links and
see them in a list.

**Independent Test**: Enter a valid web address, save it, and confirm the new
bookmark appears in the saved list with a recognizable title.

**Acceptance Scenarios**:

1. **Given** an empty bookmark list, **When** the person saves a valid web address, **Then** a new bookmark appears in the list showing its title and address.
2. **Given** the person saves an address without typing a title, **When** the bookmark is created, **Then** the app supplies a sensible default title (e.g., the page's own title or its address).
3. **Given** the person enters something that is not a valid web address, **When** they try to save, **Then** the app rejects the entry and explains what is wrong, saving nothing.

---

### User Story 2 - Browse and find bookmarks (Priority: P2)

A person who has saved many bookmarks needs to locate a specific one quickly by
searching for words in its title, address, or notes, or by narrowing the list to
a chosen tag.

**Why this priority**: Saving loses value once the collection grows if items
cannot be found again. Retrieval is the second-most critical capability.

**Independent Test**: With several bookmarks saved, type a search term and confirm
only matching bookmarks remain visible; clear the search and confirm all reappear.

**Acceptance Scenarios**:

1. **Given** multiple saved bookmarks, **When** the person types a search term, **Then** only bookmarks matching that term (in title, address, notes, or tags) are shown.
2. **Given** bookmarks labeled with tags, **When** the person selects a tag, **Then** only bookmarks carrying that tag are shown.
3. **Given** an active search or tag filter, **When** the person clears it, **Then** the full list of bookmarks is shown again.
4. **Given** a search term that matches nothing, **When** the search runs, **Then** the app shows a clear "no results" message rather than an empty screen.

---

### User Story 3 - Organize and edit bookmarks (Priority: P3)

A person curates their collection over time: correcting a title, adding notes,
applying or removing tags, and deleting bookmarks that are no longer useful.

**Why this priority**: Organization keeps the collection valuable long-term, but
the app is already useful for capture and retrieval without it.

**Independent Test**: Open an existing bookmark, change its title and tags, save,
and confirm the changes persist; then delete a bookmark and confirm it is gone.

**Acceptance Scenarios**:

1. **Given** an existing bookmark, **When** the person edits its title, notes, or tags and saves, **Then** the updated values are shown and persist across sessions.
2. **Given** an existing bookmark, **When** the person deletes it, **Then** it is removed from the list and does not reappear after reopening the app.
3. **Given** a delete action, **When** the person triggers it, **Then** the app asks for confirmation before permanently removing the bookmark.

---

### Edge Cases

- **Duplicate address**: When a person saves an address that already exists, the app warns that it is already saved and does not create a silent duplicate.
- **Very long titles or notes**: The app displays long text gracefully (truncation with full text available) rather than breaking the layout.
- **Address without a scheme** (e.g., `example.com` with no `https://`): The app normalizes it to a usable web address rather than rejecting it.
- **Unreachable page**: Saving succeeds even if the page cannot be reached at save time; retrieving a title is best-effort and never blocks saving.
- **Empty collection**: A first-time person sees a welcoming empty state that explains how to add their first bookmark.
- **Deleting the last bookmark**: Returns cleanly to the empty state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST allow a person to save a bookmark by providing a web address.
- **FR-002**: The app MUST validate that a submitted address is a well-formed web address and reject malformed entries with an explanatory message.
- **FR-003**: The app MUST let a person optionally provide a title, notes, and one or more tags when saving or editing a bookmark.
- **FR-004**: When no title is provided, the app MUST supply a default title derived from the page (its own title if obtainable, otherwise its address).
- **FR-005**: The app MUST display saved bookmarks in a list showing at least the title and address of each.
- **FR-006**: The app MUST let a person search bookmarks by text matching against title, address, notes, and tags.
- **FR-007**: The app MUST let a person filter the list to a single selected tag and clear that filter.
- **FR-008**: The app MUST let a person edit the title, notes, and tags of an existing bookmark, with changes persisted.
- **FR-009**: The app MUST let a person delete a bookmark, and MUST ask for confirmation before permanent removal.
- **FR-010**: The app MUST persist all bookmarks so they remain available after the app is closed and reopened.
- **FR-011**: The app MUST warn a person when they attempt to save an address that already exists in their collection.
- **FR-012**: The app MUST show a clear empty state when no bookmarks exist and a clear "no results" state when a search or filter matches nothing.
- **FR-013**: The app MUST record the date each bookmark was saved and present bookmarks in a predictable default order (most recently saved first).

### Key Entities *(include if feature involves data)*

- **Bookmark**: A saved reference to a web page. Attributes: web address, title, optional notes, saved date, last-modified date, and associated tags.
- **Tag**: A short label a person applies to bookmarks to group them by topic or purpose. A bookmark may carry several tags; a tag may apply to many bookmarks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person can save a new bookmark in under 20 seconds from opening the app.
- **SC-002**: A person can locate a specific bookmark among at least 500 saved items in under 5 seconds using search or tag filtering.
- **SC-003**: 95% of first-time users successfully save and later retrieve a bookmark without external instructions.
- **SC-004**: No saved bookmark is ever lost between sessions under normal use (100% persistence of confirmed saves).
- **SC-005**: Search and filtering return results with no perceptible delay (results appear effectively instantly) for collections up to 500 bookmarks.

## Assumptions

- **Single user, single device**: v1 serves one person on one device; multi-user accounts, sharing, and cross-device sync are out of scope.
- **No authentication in v1**: Because the collection is personal and local, sign-in is not required; this can be revisited if sync is added later.
- **Local persistence**: Bookmarks are stored locally on the person's device; cloud storage is out of scope for v1.
- **Manual capture**: Bookmarks are added by entering an address within the app; browser-extension "one-click" capture and bulk import from browsers are out of scope for v1.
- **Best-effort title fetch**: Automatically retrieving a page's title is a convenience; if it cannot be fetched, saving still succeeds using the address as the title.
- **Tags over folders**: Organization uses flat tags rather than nested folders in v1.
- **Reasonable scale**: The collection is expected to hold up to a few thousand bookmarks, not millions.
