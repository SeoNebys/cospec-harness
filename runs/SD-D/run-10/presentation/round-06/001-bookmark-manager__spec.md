# Feature Specification: Bookmark Manager

**Feature Branch**: `[001-bookmark-manager]`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "Build an app to save and manage bookmarks, with automatic page metadata, read-later and archive workflows, flexible tagging, bulk actions, advanced and saved searches, and formatted notes."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a Rich Bookmark with Minimal Typing (Priority: P1)

As a user, I want to paste a web address and have the page title, short description, site icon, and preview image filled in automatically so saving a useful, recognizable bookmark takes little effort. I want to review and change every generated field before or after saving, and add a longer formatted note when I need more context.

**Why this priority**: Fast capture with useful context is the core value of the product and prevents the library from becoming a list of unrecognizable addresses.

**Independent Test**: Paste a publicly reachable web address with page metadata, verify that the title, description, site icon, and preview image are populated, change those values and add a formatted note, save the bookmark, and confirm that the edited result persists and displays correctly in its detail view.

**Acceptance Scenarios**:

1. **Given** a signed-in user and a valid public web address with available page metadata, **When** the user pastes the address, **Then** the system retrieves and proposes the page title, short description, site icon, and preview image before the user completes the save.
2. **Given** automatically retrieved metadata, **When** the user changes or removes any proposed field before saving, **Then** the user's choices are saved instead of the retrieved values.
3. **Given** a saved bookmark, **When** the user edits its title, short description, site icon, preview image, address, or formatted note, **Then** the changed details replace the previous values without altering unrelated fields.
4. **Given** a valid address whose page is unavailable or lacks some metadata, **When** retrieval completes or fails, **Then** the system identifies the missing information, provides sensible fallbacks where possible, and still allows the user to complete the bookmark manually.
5. **Given** a bookmark with a formatted note, **When** the user opens its detail view, **Then** paragraphs, headings, emphasis, lists, and links are presented as formatted content.
6. **Given** an invalid or unsupported address, **When** the user tries to save it, **Then** the bookmark is not created and the user receives a clear correction message.

---

### User Story 2 - Keep a Read-Later Queue (Priority: P2)

As a user, I want to flag bookmarks I have not read yet, see those unread bookmarks in one Read Later view, and mark them read when I am done.

**Why this priority**: A dedicated reading queue serves a different purpose from favorites and makes the product useful for capturing content to revisit soon.

**Independent Test**: Mark bookmarks for later, verify they appear in the Read Later view regardless of favorite status, mark one read, and confirm that it leaves the unread queue while remaining in the library.

**Acceptance Scenarios**:

1. **Given** an active bookmark, **When** the user adds it to Read Later, **Then** it is marked unread and appears in the Read Later view.
2. **Given** an unread Read Later bookmark, **When** the user marks it read, **Then** it disappears from the Read Later view but remains in the main library.
3. **Given** a read bookmark, **When** the user marks it unread, **Then** it reappears in the Read Later view.
4. **Given** a bookmark that is both a favorite and unread, **When** either state changes, **Then** the other state remains unchanged.

---

### User Story 3 - Organize with Tags and Optional Collections (Priority: P2)

As a user, I want to apply multiple reusable tags to each bookmark, receive suggestions from tags I already use, and optionally place a bookmark in one collection so tags remain my primary, flexible organization method.

**Why this priority**: Multiple tags let one bookmark belong to several meaningful contexts, while optional collections provide a secondary folder-like grouping for users who want it.

**Independent Test**: Apply several tags to one bookmark using existing-tag suggestions, add the same bookmark to an optional collection, and verify that it remains discoverable under every tag without requiring a collection.

**Acceptance Scenarios**:

1. **Given** a user with existing tags, **When** the user types in a bookmark's tag field, **Then** matching tags from that user's library are suggested and can be selected without creating a duplicate tag.
2. **Given** an active bookmark, **When** the user applies multiple tags, **Then** the bookmark appears under each tag and retains all of them independently of its collection.
3. **Given** a bookmark with no collection, **When** the user saves or organizes it using only tags, **Then** every tag-based organization and search feature remains available.
4. **Given** a user's library, **When** the user creates or renames a collection and optionally assigns bookmarks to it, **Then** the collection and its assigned bookmarks are displayed together without changing their tags.
5. **Given** an existing bookmark, **When** the user marks or unmarks it as a favorite, **Then** its favorite status updates and its tags, collection, and reading status remain unchanged.
6. **Given** two bookmarks with the same normalized destination, **When** the user attempts to save the destination again, **Then** the system warns that it already exists and offers a route to the existing bookmark without creating a duplicate by default.

---

### User Story 4 - Archive Without Losing a Bookmark (Priority: P2)

As a user, I want to archive bookmarks I no longer need in daily use, find them in a separate archived area, and restore them later. I want deletion to remain a separate, permanent action.

**Why this priority**: Reversible cleanup lets users keep valuable history without cluttering everyday browsing and search results.

**Independent Test**: Archive an active bookmark, verify it disappears from the main library and normal search but appears in the archive, restore it, and verify it returns with all metadata and organization intact.

**Acceptance Scenarios**:

1. **Given** an active bookmark, **When** the user archives it, **Then** it is removed from the main library, Read Later view, favorites view, and normal search results, and appears in the archive.
2. **Given** an archived bookmark, **When** the user restores it, **Then** it returns to the active library with its metadata, note, tags, collection, favorite state, and reading state intact.
3. **Given** the archive view, **When** the user searches or filters it, **Then** only archived bookmarks matching those criteria are shown.
4. **Given** an active or archived bookmark, **When** the user confirms permanent deletion, **Then** the bookmark is irreversibly removed; if the user cancels, no change is made.

---

### User Story 5 - Find Bookmarks with Precise Search (Priority: P3)

As a user, I want plain-text search, direct tag search, exact phrases, Boolean operators, filters, and sorting so I can express both simple and precise searches as my library grows.

**Why this priority**: Retrieval speed determines whether a large bookmark collection remains valuable.

**Independent Test**: Populate a library with varied metadata, tags, notes, states, and dates, then verify plain terms, `#tag` terms, quoted phrases, `AND`, `OR`, and `NOT`, filters, and sorts against a known expected result set.

**Acceptance Scenarios**:

1. **Given** a populated active library, **When** the user searches for ordinary text found in a bookmark's title, address, short description, note, or tag, **Then** matching active bookmarks are shown and non-matches are excluded.
2. **Given** bookmarks carrying different tags, **When** the user searches with a direct tag term such as `#news`, **Then** only bookmarks carrying that tag match that term.
3. **Given** bookmarks containing related words, **When** the user encloses words in quotation marks, **Then** only bookmarks containing that exact phrase in a searchable field match the phrase.
4. **Given** a search containing `AND`, `OR`, or `NOT`, **When** the search runs, **Then** the system combines or excludes matches according to the entered operators and clearly communicates any invalid expression.
5. **Given** a populated library, **When** the user applies tag, collection, favorite, or reading-status filters, **Then** only bookmarks satisfying the active search and filters are shown.
6. **Given** visible search results, **When** the user sorts by newest saved, oldest saved, title, or most recently updated, **Then** the visible bookmarks appear in that order.
7. **Given** a search or filter with no matches, **When** results are displayed, **Then** the user sees an informative empty state and can clear the active criteria.

---

### User Story 6 - Save and Reuse a Search (Priority: P3)

As a user, I want to name and save a useful combination of search terms, included or excluded tags, filters, and sorting so I can return to the same live view later.

**Why this priority**: Saved searches turn repeated multi-step retrieval into one action and make complex tag-based organization practical.

**Independent Test**: Configure a search with included and excluded tags plus another filter and a sort order, save it, change the library, reopen the saved search, and verify that its current matching results and saved configuration are restored.

**Acceptance Scenarios**:

1. **Given** an active search, filters, and sort order, **When** the user gives the combination a unique name and saves it, **Then** it appears in the user's saved-search list.
2. **Given** a saved search, **When** the user opens it later, **Then** the saved query, included and excluded tags, other filters, and sort order are restored and evaluated against the current library.
3. **Given** a saved search, **When** the user renames, updates, or deletes it, **Then** the saved-search list reflects the change without changing any bookmarks.

---

### User Story 7 - Tidy Many Bookmarks at Once (Priority: P3)

As a user, I want to select several bookmarks—or all bookmarks matching my current search and filters—and apply one action to the entire selection so large cleanup jobs are practical.

**Why this priority**: Bulk actions prevent repetitive work and become essential once the library contains many items.

**Independent Test**: Filter a result set that spans more than one displayed page, select all matches, apply each supported bulk action in turn, and verify that the action affects exactly the reported matches and nothing else.

**Acceptance Scenarios**:

1. **Given** a list of bookmarks, **When** the user selects individual items, **Then** the interface reports the exact selection count and makes bulk actions available.
2. **Given** active search or filter criteria, **When** the user chooses all matching bookmarks, **Then** the selection includes every current match, not only items presently visible, and the total count is shown before an action runs.
3. **Given** a selection, **When** the user applies or removes tags, marks items read or unread, archives or restores them, or changes favorite status, **Then** the action is applied to every selected eligible bookmark and a result summary is shown.
4. **Given** a selection, **When** the user chooses permanent deletion, **Then** the system shows the exact number of bookmarks to be irreversibly deleted and proceeds only after explicit confirmation.
5. **Given** a failed or partially completed bulk action, **When** processing ends, **Then** the user sees how many items changed, how many did not, and can identify the unsuccessful items.

---

### User Story 8 - Access a Private Library Across Sessions (Priority: P4)

As a user, I want to sign in and see only my own saved bookmarks and saved searches so my library is private and remains available when I return.

**Why this priority**: Persistent, private ownership is necessary for a dependable personal library, though the other workflows can be evaluated with a prepared account.

**Independent Test**: Save different bookmarks and saved searches in two user accounts, sign out and back in, and verify that each account sees its own unchanged data and cannot access the other account's content.

**Acceptance Scenarios**:

1. **Given** a valid user account, **When** the user signs in, **Then** that user's bookmark library and saved searches are displayed.
2. **Given** a signed-in user with saved data, **When** the user signs out and later signs back in, **Then** bookmarks, notes, metadata, organization, states, and saved searches are preserved.
3. **Given** two different user accounts, **When** either user views or modifies their library, **Then** the other user's bookmarks, collections, tags, and saved searches are not visible or changeable.

### Edge Cases

- Leading and trailing spaces in an address are ignored before validation and duplicate comparison.
- Addresses that differ only by a fragment or common presentation differences are treated consistently under documented normalization rules; the user's original saved address remains editable.
- Redirected destinations use the metadata returned by the final permitted page while preserving the address the user chose to save.
- Pages that are unavailable, slow, restricted, non-HTML, or missing some metadata do not block a valid address from being saved; the user sees which fields need manual input and can retry retrieval.
- A broken or unavailable site icon or preview image does not prevent other bookmark content from displaying or being edited.
- Automatically retrieved values never overwrite a field the user has already changed during the same save or edit session.
- User-authored formatted notes display supported formatting while unsafe or unsupported embedded content is not executed.
- Very long titles, descriptions, notes, addresses, collection names, tag names, and saved-search names produce clear length guidance and never silently lose text.
- Removing a collection does not remove its bookmarks. Affected bookmarks return to the unfiled state after confirmation and keep their tags.
- Renaming a tag to an existing tag name merges the tags only after confirmation; saved searches continue to target the resulting tag.
- Deleting a tag warns about affected bookmarks and saved searches, retains the bookmarks, and removes that tag from saved-search criteria after confirmation.
- Search is case-insensitive, ignores accidental surrounding whitespace, and clearly distinguishes no matches from an empty library.
- Boolean operators inside quotation marks are treated as phrase text rather than operators; outside quotes, `NOT` is evaluated before `AND`, and `AND` before `OR`.
- Archived bookmarks participate in duplicate detection even though they are excluded from the active library and its normal search.
- Archiving an unread item hides it from Read Later; restoring it restores its prior unread status.
- If the matching result set changes after “select all matches” is chosen, the system refreshes and reconfirms the exact affected count before a destructive or archival action.
- If a save, edit, archive, restore, or bulk operation fails, previously persisted data remains intact and the user receives an actionable result.
- Concurrent changes from two sessions must not silently overwrite a newer saved version; the user is told that the item changed and can reload the latest version.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let a user create an account, sign in, sign out, and regain access through a secure account-recovery flow.
- **FR-002**: The system MUST restrict bookmarks, collections, tags, and saved searches to their owning user.
- **FR-003**: A signed-in user MUST be able to begin saving a bookmark by entering a valid `http` or `https` address.
- **FR-004**: After a valid address is entered, the system MUST attempt to retrieve the destination's page title, short description, site icon, and representative preview image and present the retrieved values for review before saving.
- **FR-005**: Metadata retrieval MUST NOT prevent a valid address from being saved when the destination is unavailable, restricted, slow, non-HTML, or missing metadata; the system MUST identify missing fields and provide a recognizable fallback title.
- **FR-006**: A user MUST be able to retry metadata retrieval and to edit, replace, or remove every retrieved title, short description, site icon, and preview image before and after saving.
- **FR-007**: The system MUST NOT overwrite metadata that the user has manually changed during the current save or edit session.
- **FR-008**: A user MUST be able to add and edit a longer note supporting paragraphs, headings, bold text, italic text, bulleted lists, numbered lists, and links.
- **FR-009**: The system MUST render a bookmark's note as formatted content in its detail view and MUST prevent user-authored content from executing unsafe embedded behavior.
- **FR-010**: The system MUST record and display each bookmark's address, title, short description, site icon, preview image, note, tags, optional collection, favorite state, reading state, archive state, creation time, and last-updated time.
- **FR-011**: The system MUST reject empty, malformed, or unsupported addresses with a correction message and without creating or altering a bookmark.
- **FR-012**: The system MUST detect attempted duplicates across both active and archived bookmarks in the same user's library using consistent normalized-address rules, warn the user, and link to the existing bookmark instead of creating a duplicate by default.
- **FR-013**: A user MUST be able to open a saved destination while retaining access to the bookmark library and to open a bookmark detail view for its metadata and note.
- **FR-014**: A user MUST be able to mark or unmark a bookmark as a favorite independently of its reading, archive, tag, and collection state.
- **FR-015**: A user MUST be able to add an active bookmark to Read Later, which marks it unread, and MUST be able to mark it read or unread later.
- **FR-016**: The Read Later view MUST show active unread bookmarks only; marking one read MUST remove it from that view without deleting or archiving it.
- **FR-017**: A user MUST be able to archive an active bookmark and restore an archived bookmark without losing its metadata, note, tags, optional collection, favorite state, or reading state.
- **FR-018**: Archived bookmarks MUST be excluded from the main library, favorites, Read Later, normal searches, and normal saved-search results, and MUST be browsable, searchable, and filterable in a separate archive view.
- **FR-019**: A user MUST be able to permanently delete an active or archived bookmark only after explicit confirmation; permanent deletion MUST be presented as irreversible.
- **FR-020**: A user MUST be able to create, reuse, rename, and delete tags, assign multiple tags to a bookmark, and remove individual tags without affecting the other tags or the bookmark itself.
- **FR-021**: While a user enters tags on a bookmark, the system MUST suggest case-insensitive prefix matches from that user's existing tags and MUST prevent accidental duplicate tags that differ only by letter case or surrounding whitespace.
- **FR-022**: Tags MUST remain fully usable without collections and MUST serve as the primary many-to-many organization mechanism throughout browsing, filtering, searching, saved searches, and bulk actions.
- **FR-023**: A user MUST be able to create, rename, and delete optional collections and assign at most one collection to each bookmark without changing its tags.
- **FR-024**: Deleting a collection MUST require confirmation, retain its bookmarks, preserve their tags, and place them in an unfiled state.
- **FR-025**: Renaming a tag to an existing tag name MUST require confirmation to merge them; deleting a tag MUST require confirmation and retain every associated bookmark.
- **FR-026**: A user MUST be able to browse all active bookmarks and separately view unfiled bookmarks, favorites, Read Later bookmarks, and archived bookmarks.
- **FR-027**: Normal search MUST match case-insensitive terms across an active bookmark's title, address, short description, formatted note text, and tags.
- **FR-028**: Search MUST support direct tag terms using `#tag`, exact phrases enclosed in quotation marks, and the operators `AND`, `OR`, and `NOT`.
- **FR-029**: Search MUST treat adjacent terms as `AND` and evaluate operators in the order `NOT`, then `AND`, then `OR`; quoted operator words MUST be treated as phrase text.
- **FR-030**: The system MUST identify invalid search expressions without discarding the user's text and MUST explain how to correct them.
- **FR-031**: A user MUST be able to include or exclude one or more tags and filter by optional collection, favorite state, and reading state; active search terms and filters MUST all apply to the visible result set.
- **FR-032**: A user MUST be able to sort visible bookmarks by newest saved, oldest saved, title, or most recently updated, with newest saved as the default.
- **FR-033**: A user MUST be able to save the current search expression, included and excluded tags, other filters, archive context, and sort order under a unique name.
- **FR-034**: Opening a saved search MUST restore its configuration and evaluate it against the user's current library rather than preserve a fixed historical result list.
- **FR-035**: A user MUST be able to rename, update, and delete a saved search without modifying any bookmarks.
- **FR-036**: A user MUST be able to select individual bookmarks and select all bookmarks matching the current search and filters, including matches not presently visible; the system MUST show the exact selected count.
- **FR-037**: Bulk actions MUST allow users to add or remove tags, mark bookmarks read or unread, mark or unmark favorites, archive active bookmarks, and restore archived bookmarks when eligible.
- **FR-038**: Bulk permanent deletion MUST state the exact affected count and require explicit confirmation immediately before deletion.
- **FR-039**: Every bulk action MUST report the number of successful and unsuccessful items and identify items that were not changed.
- **FR-040**: Before a destructive or archival bulk action, the system MUST refresh a dynamic all-matches selection and require reconfirmation if its affected count has changed.
- **FR-041**: The system MUST preserve bookmarks, metadata, notes, organization, states, and saved searches across sign-out, sign-in, and normal service restarts.
- **FR-042**: The system MUST show distinct, actionable states for an empty library, empty archive, empty Read Later view, no search or filter matches, metadata retrieval failure, invalid input, and unsuccessful operations.
- **FR-043**: The primary save, detail, browse, organize, search, saved-search, selection, and bulk-action workflows MUST remain usable on phone-sized and desktop-sized screens.
- **FR-044**: The system MUST communicate conflicting concurrent updates and prevent an older edit from silently replacing a newer saved version.

### Key Entities

- **User**: The owner of a private bookmark library and its organizational data; identified by account credentials and profile details required for access and recovery.
- **Bookmark**: A saved web destination owned by one user, including user-editable retrieved metadata, a formatted note, favorite and reading states, archive state, timestamps, zero or more tags, and zero or one collection.
- **Collection**: An optional, secondary user-owned grouping that may contain many bookmarks; removing it does not remove those bookmarks or their tags.
- **Tag**: A reusable user-owned label in the primary many-to-many organization system; each tag may describe many bookmarks and each bookmark may carry multiple tags.
- **Saved Search**: A named, user-owned reusable search configuration containing a query expression, included and excluded tags, other filters, archive context, and sort order; its results are recalculated when opened.
- **Bulk Selection**: A temporary set of individually selected bookmarks or all bookmarks matching current criteria, with a known count and action outcome.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For at least 90% of representative public pages that publish a title and description, users see those values proposed within 3 seconds under expected operating conditions; available site icons and preview images are also proposed.
- **SC-002**: At least 90% of first-time users can paste a valid address, review the retrieved details, and save the bookmark without assistance in under 45 seconds.
- **SC-003**: At least 95% of bookmarks with unavailable or incomplete page metadata can still be saved manually on the first attempt without data loss.
- **SC-004**: At least 90% of users can add a bookmark to Read Later and later mark it read without assistance in under 20 seconds per action.
- **SC-005**: At least 90% of users can archive and subsequently restore a bookmark with all of its prior organization and states intact.
- **SC-006**: For a library containing 10,000 bookmarks, 95% of plain-text, tag, phrase, Boolean, filtered, saved-search, and sort actions show the updated visible result within 1 second under expected operating conditions.
- **SC-007**: Returning users can locate and open a known bookmark from a library of at least 1,000 active items in under 30 seconds using search, tags, filters, or a saved search.
- **SC-008**: At least 90% of users can apply two existing tags to a bookmark using suggestions in under 20 seconds without creating a duplicate tag.
- **SC-009**: Users can apply a supported action to all matches in a 1,000-bookmark result set with no more than one selection step and one confirmation step, and the reported outcome accounts for 100% of selected items.
- **SC-010**: In acceptance testing, 100% of attempts to access another user's bookmark, collection, tag, or saved search are denied without revealing its private content.
- **SC-011**: In acceptance testing, every confirmed successful save, edit, reading-state change, archive or restore, organization change, and saved-search change remains correct after signing out and back in.
- **SC-012**: At least 90% of representative participants rate the save-and-find experience as easy or very easy after completing the core scenarios on both a phone-sized and desktop-sized screen.

## Assumptions

- The first release is a responsive web application for individual users with private libraries.
- Email-based account access and recovery are sufficient for the first release; enterprise identity, teams, roles, and shared libraries are outside scope.
- Tags are the primary organization mechanism. A bookmark may have multiple tags whether or not it belongs to an optional collection; a bookmark belongs to at most one collection.
- Initial metadata retrieval occurs when a valid address is entered. The system may follow ordinary page redirects, but saving never depends on successful retrieval.
- Users may replace or remove retrieved visual metadata, but uploading and editing image files is outside scope; user changes identify an alternative image or no image.
- Formatted notes support only the formatting explicitly listed in FR-008; file attachments, embedded scripts, embedded interactive content, and collaborative editing are outside scope.
- `AND`, `OR`, and `NOT` are recognized as operators outside quotation marks; adjacent terms behave as `AND`. Parenthesized expressions are outside the first release.
- Saved searches store live criteria rather than copies of matching bookmarks. Renaming a referenced tag preserves the saved search; deleting a referenced tag removes that criterion after warning the user.
- Duplicate detection warns and avoids accidental duplicates by default; an explicit force-duplicate workflow is outside scope for the first release.
- Importing or exporting browser bookmarks, browser extensions, offline access, automated link-health checks, page-content archiving, sharing, public profiles, and collaborative curation are outside the first release.
- Users are expected to have network access while using the application.
