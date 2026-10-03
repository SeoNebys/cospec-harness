# Feature Specification: Personal Bookmark Manager

**Feature Branch**: `[001-bookmark-manager]`

**Created**: 2026-09-19

**Status**: Approved on 2026-09-19

**Input**: User description: "Build a personal bookmark manager with automatic page details, advanced search, reusable tag suggestions, favorites, and read-later tracking."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save a Link with Automatic Details (Priority: P1)

As a user, I want to paste a web address and have the app fill in useful page details so that saving a link requires almost no typing.

**Why this priority**: Fast, low-effort capture is the core value of the bookmark manager and determines whether the user will consistently save links.

**Independent Test**: A user can paste a valid public webpage address, review automatically filled details, optionally adjust them, and save a recognizable bookmark that remains in the collection after returning to the app.

**Acceptance Scenarios**:

1. **Given** the user is creating a bookmark, **When** they paste a valid webpage address, **Then** the app attempts to fill in the page title, short description, and site icon automatically.
2. **Given** page details are retrieved, **When** the user reviews the bookmark before saving, **Then** they can edit the title and description without those edits being overwritten.
3. **Given** the destination does not provide one or more page details, **When** retrieval finishes, **Then** the app uses a sensible title based on the site address and a placeholder icon, leaves an unavailable description empty, and still allows the bookmark to be saved.
4. **Given** page-detail retrieval is slow or fails, **When** the user continues, **Then** they can save the address without waiting indefinitely and receive a non-blocking explanation of which details could not be filled in.
5. **Given** the user is creating a bookmark, **When** they add optional personal notes, tags, favorite status, or read-later status, **Then** those details are retained with the saved bookmark.
6. **Given** the user enters an invalid or unsupported address, **When** they attempt to retrieve details or save it, **Then** the bookmark is not saved and the user sees how to correct the address.
7. **Given** an identical destination address is already saved, **When** the user attempts to save it again, **Then** the app prevents an accidental duplicate and offers to show the existing bookmark.

---

### User Story 2 - Find Bookmarks with Advanced Search (Priority: P2)

As a user, I want to search by content or tag and combine search expressions so that I can precisely retrieve bookmarks from a large collection.

**Why this priority**: A growing collection remains valuable only when the user can narrow it to the exact links they need.

**Independent Test**: With a varied collection, a user can retrieve known result sets using ordinary terms, `#tag` searches, Boolean operators, exact phrases, parentheses, and collection filters, then open a matching bookmark.

**Acceptance Scenarios**:

1. **Given** several bookmarks exist, **When** the user enters an ordinary search term, **Then** bookmarks containing that term in the title, address, description, personal notes, or tags are shown using case-insensitive matching.
2. **Given** bookmarks have tags, **When** the user searches for `#recipes`, **Then** only bookmarks carrying the complete `recipes` tag are shown, regardless of capitalization.
3. **Given** bookmarks contain different terms, **When** the user joins expressions with `AND`, **Then** only bookmarks matching every joined expression are shown.
4. **Given** bookmarks contain different terms, **When** the user joins expressions with `OR`, **Then** bookmarks matching at least one joined expression are shown.
5. **Given** bookmarks contain an unwanted term or tag, **When** the user places `NOT` before that expression, **Then** matching bookmarks are excluded from the results.
6. **Given** a bookmark contains a multi-word phrase, **When** the user encloses that phrase in quotation marks, **Then** only bookmarks containing the complete phrase in that order are shown.
7. **Given** a search combines operators, **When** the user adds parentheses, **Then** the parenthesized expression is evaluated as a group.
8. **Given** a search omits parentheses, **When** multiple operators appear, **Then** `NOT` is evaluated before `AND`, and `AND` before `OR`.
9. **Given** a search query is incomplete or has invalid syntax, **When** the user submits it, **Then** the app explains the problem without changing or discarding the query.
10. **Given** bookmarks have different tags, favorite states, or reading states, **When** the user applies those filters alongside a search query, **Then** a bookmark is shown only if it satisfies both the query and every active filter.
11. **Given** a bookmark is visible, **When** the user opens it, **Then** its saved address opens without losing the current collection search and filters.
12. **Given** no bookmarks match, **When** results are displayed, **Then** the user sees a clear no-results state and can reset the search and filters.

---

### User Story 3 - Organize with Consistent Tags (Priority: P3)

As a user, I want suggestions from tags I already use while tagging a bookmark so that my organization remains consistent.

**Why this priority**: Reusing established tags prevents near-duplicates that make filtering and tag search unreliable.

**Independent Test**: With existing tags in the collection, a user can type part of a tag, select a matching suggestion by mouse or keyboard, and save one normalized tag without losing the option to create a new one.

**Acceptance Scenarios**:

1. **Given** existing tags include `recipes` and `research`, **When** the user begins entering `re`, **Then** both matching tags are suggested without regard to capitalization.
2. **Given** tag suggestions are visible, **When** the user navigates and selects one with the keyboard, **Then** it is added to the bookmark and focus remains usable for adding another tag.
3. **Given** no existing tag matches the entered text, **When** the user confirms it, **Then** a new normalized tag is created and added.
4. **Given** a tag is already attached to the bookmark, **When** suggestions are shown, **Then** that tag is not offered again and cannot be added twice.

---

### User Story 4 - Track and Maintain the Collection (Priority: P4)

As a user, I want to track links I still need to read separately from favorites and update or remove bookmarks so that my collection reflects both intent and value.

**Why this priority**: Favorites identify enduring value, while read-later status tracks unfinished reading; keeping them independent supports two distinct workflows.

**Independent Test**: A user can independently change favorite and reading states, view only unread bookmarks, edit bookmark details, and remove a bookmark with protection against accidental deletion.

**Acceptance Scenarios**:

1. **Given** a bookmark exists, **When** the user marks it to read later, **Then** it appears as unread and is included in the unread view.
2. **Given** an unread bookmark exists, **When** the user marks it as read, **Then** it leaves the unread view while remaining in the full collection.
3. **Given** a bookmark is both a favorite and unread, **When** the user changes either state, **Then** the other state remains unchanged.
4. **Given** a bookmark is unread, **When** the user merely opens its destination, **Then** it remains unread until the user explicitly marks it as read.
5. **Given** a bookmark exists, **When** the user edits its address, title, description, personal notes, or tags and saves, **Then** the updated details replace the previous details.
6. **Given** a bookmark exists, **When** the user requests deletion, **Then** the app asks for confirmation before removing it.
7. **Given** deletion confirmation is displayed, **When** the user cancels, **Then** the bookmark remains unchanged.

### Edge Cases

- An address containing leading or trailing whitespace is trimmed before validation, retrieval, and storage.
- Only normal public webpages using `http` or `https` are eligible for automatic detail retrieval; unsupported or unsafe destinations are rejected.
- A redirected page is saved under its final public address, and duplicate detection is repeated against that final address before saving.
- Page-detail retrieval may encounter unavailable pages, redirects, access restrictions, malformed page data, or details in unexpected character sets; none may cause loss of the entered address or user edits.
- A page title or description containing unsafe formatting is displayed as plain content and cannot alter the app itself.
- If the user edits an automatically filled field while retrieval is still in progress, the user's value takes precedence.
- Tags that differ only by capitalization or surrounding whitespace are treated as the same tag; repeated tags on one bookmark are consolidated.
- A hashtag search with no tag name, unmatched quotation mark, misplaced operator, or unbalanced parentheses produces actionable syntax feedback rather than partial or misleading results.
- Boolean operator words are recognized without regard to capitalization; to search for those words literally, the user encloses them in quotation marks.
- Search ignores letter case and handles punctuation and non-English text without failing.
- Long titles, descriptions, addresses, notes, tag lists, and search queries remain readable without breaking collection navigation.
- If saving an update fails, the prior bookmark remains intact and the user receives a clear error message.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let the user begin creating a bookmark by entering only a valid public `http` or `https` web address.
- **FR-002**: After a valid address is entered, the system MUST attempt to retrieve the destination page's title, short description, and site icon automatically.
- **FR-003**: The system MUST let the user review and edit an automatically retrieved title and description before saving.
- **FR-004**: If a title cannot be retrieved, the system MUST create a recognizable fallback title from the destination address so the bookmark can still be saved without a manually entered title.
- **FR-005**: If a description or site icon cannot be retrieved, the system MUST allow saving with an empty description or placeholder icon and explain the fallback without treating it as a validation error.
- **FR-006**: The system MUST prevent late retrieval results from overwriting title or description changes already made by the user.
- **FR-007**: The system MUST support optional personal notes, zero or more tags, favorite status, and unread status on each bookmark.
- **FR-008**: The system MUST reject invalid, unsupported, or unsafe addresses and explain the validation failure without discarding the user's other entered values.
- **FR-009**: The system MUST preserve saved bookmarks and their details across separate visits to the app on the same installation.
- **FR-010**: The system MUST show a collection containing every saved bookmark, ordered by most recently saved first by default.
- **FR-011**: Each collection entry MUST show its title, destination address, available description and site icon, tags, favorite state, unread state, and saved date.
- **FR-012**: The user MUST be able to open a bookmark's destination without losing their current collection search and filters.
- **FR-013**: Ordinary search terms MUST use case-insensitive matching across title, destination address, description, personal notes, and tags.
- **FR-014**: A search token beginning with `#` MUST match the complete normalized tag name rather than partial text in other fields.
- **FR-015**: Search MUST support the Boolean operators `AND`, `OR`, and `NOT`, exact phrases enclosed in quotation marks, and grouped expressions enclosed in parentheses.
- **FR-016**: Search expressions MUST apply the precedence order `NOT`, then `AND`, then `OR` unless parentheses explicitly change the order.
- **FR-017**: Adjacent search expressions without an explicit Boolean operator MUST be treated as if joined by `AND`.
- **FR-018**: Boolean operators and tag matching MUST be case-insensitive; quoted text MUST allow operator words to be searched literally.
- **FR-019**: The system MUST identify invalid search syntax, retain the entered query, and provide actionable correction guidance instead of returning partial results.
- **FR-020**: The user MUST be able to filter the collection by one or more tags, favorite status, and unread status, with filters applied in addition to any search expression.
- **FR-021**: The system MUST clearly distinguish between an entirely empty collection and a search or filter with no matches.
- **FR-022**: The user MUST be able to clear all active search terms and filters in one action.
- **FR-023**: While the user enters a tag, the system MUST suggest previously used tags using case-insensitive prefix matching.
- **FR-024**: Tag suggestions MUST exclude tags already attached to the current bookmark and MUST be selectable using pointer or keyboard controls.
- **FR-025**: The user MUST remain able to create a new tag when no existing suggestion is appropriate.
- **FR-026**: The system MUST trim surrounding whitespace, consolidate tags that differ only by capitalization, and prevent the same normalized tag from being added twice to one bookmark.
- **FR-027**: The user MUST be able to mark and unmark any bookmark as a favorite.
- **FR-028**: The user MUST be able to mark a bookmark as unread for later reading and explicitly mark it as read afterward.
- **FR-029**: Favorite and unread states MUST be independent, and opening a destination MUST NOT automatically change its unread state.
- **FR-030**: The user MUST be able to edit a bookmark's address, title, description, personal notes, and tags, subject to the same validation and duplicate rules used at creation.
- **FR-031**: The user MUST be able to delete a bookmark only after confirming the deletion.
- **FR-032**: When an identical normalized destination address is already saved, including after redirection, the system MUST prevent an accidental duplicate and direct the user to the existing bookmark.
- **FR-033**: The system MUST provide clear success or failure feedback for retrieval, create, update, and delete actions.
- **FR-034**: The main collection, advanced search, tag suggestions, and all bookmark management actions MUST be usable with keyboard-only navigation.

### Key Entities

- **Bookmark**: A saved web destination with a unique identifier, title, destination address, optional retrieved description, optional personal notes, optional site icon, favorite state, unread state, saved date, last-updated date, and zero or more tags.
- **Tag**: A normalized user-defined label used for suggestions, organization, filtering, and hashtag search; a tag can belong to multiple bookmarks, and a bookmark can have multiple tags.
- **Search Expression**: A user-entered query containing ordinary terms, exact phrases, hashtag terms, Boolean operators, and optional grouping; it determines which bookmarks match.
- **Collection View State**: The current search expression, selected tag filters, favorite filter, and unread filter; it affects what is displayed but does not change bookmark data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of first-time users can save a recognizable bookmark by providing only a valid web address, without assistance, in under 30 seconds.
- **SC-002**: For pages that expose a title, description, and site icon through commonly available page information, at least 95% of saves present those available details for review without manual entry.
- **SC-003**: A user with 5,000 saved bookmarks sees the collection, a valid advanced-search result, or a filtered result become usable within 2 seconds for at least 95% of attempts under normal conditions.
- **SC-004**: At least 90% of users can locate and open a known bookmark from a collection of 100 items in under 30 seconds using hashtag, Boolean, phrase, or filtered search.
- **SC-005**: In usability testing, at least 90% of participants select an existing tag suggestion instead of unintentionally creating a capitalization or spelling variant.
- **SC-006**: At least 90% of users can mark a bookmark to read later, display only unread bookmarks, and mark one as read without assistance.
- **SC-007**: All saved bookmark details and independent favorite and unread states remain unchanged after the user leaves and returns, except when explicitly edited or deleted.
- **SC-008**: In usability testing, at least 90% of participants can create, edit, favorite, find, open, track reading status, and delete a bookmark without external guidance.
- **SC-009**: Keyboard-only users can complete every core bookmark workflow, including choosing tag suggestions and composing an advanced search, with no inaccessible control or keyboard trap.

## Assumptions

- The first release is a personal, single-user web application; accounts, authentication, multiple users, sharing, and permission roles are outside scope.
- Bookmark data belongs to one app installation. Synchronization across devices and browsers is outside scope for the first release.
- Automatic page details are limited to information the destination makes publicly available. Full page previews, screenshots, content archiving, and availability monitoring remain outside scope.
- The retrieved description and the user's personal notes are separate fields so automatic updates never replace the user's own writing.
- Read-later tracking is an explicit unread/read state. New bookmarks are not unread by default unless the user selects read-later, and merely opening an unread bookmark does not mark it as read.
- Tags, favorites, and unread status provide organization in the first release. Folders, nested collections, and custom sorting are outside scope.
- Importing bookmarks from browsers or files, exporting data, bulk editing, and browser extensions are outside scope.
- The user needs network access to retrieve page details and open a destination. If retrieval is unavailable, the user can still save and manage the address using fallback details.
