# UI Contract: Bookmark Manager

**Date**: 2026-09-18  
**Related API**: [openapi.yaml](./openapi.yaml)

## Primary Screen

The application has one landmark-based library screen containing:

1. A heading and active/archive view switch.
2. A save form with URL, title, description, tags, and favorite controls.
3. Search, tag filter, favorite filter, sort, active-filter summary, and clear action.
4. A result count and bookmark collection.
5. Contextual empty or no-results guidance.

The root application element receives `data-harness-ready="true"` only after the initial bookmark and tag request succeeds and the populated or valid empty state is rendered.

## Save Form Contract

- URL is the only field required from the user.
- A valid URL starts a debounced metadata-preview request; pasting may start it immediately.
- A visible, politely announced status communicates loading, success/partial success, or inability to load details.
- Save remains enabled while preview is loading, provided the URL itself is valid.
- Preview title/description populate only fields the user has not edited and only for the current URL request.
- Editing a populated field marks it user-owned. Later results cannot replace it.
- Changing the URL cancels or invalidates the prior preview and resets ownership only for fields the user has not manually changed.
- Saving without a title sends an omitted/blank title and relies on the server's URL fallback.
- A validation error keeps every entered field intact and focuses or links to the first invalid field.
- A duplicate response identifies the existing entry and offers an action that reveals/focuses it in the appropriate active or archived view.

## Collection Contract

- Each entry exposes title, destination host/address, optional description, tags, favorite state, date context, Open, Edit, Archive/Restore, and Delete actions.
- Open uses a normal link in a new browsing context with opener isolation; the library and its URL state remain unchanged.
- Search matches title, URL, description, and tags without case sensitivity.
- Multiple tag filters, favorite, search, and active/archive view combine. Active constraints are visible and individually or collectively removable.
- Supported sort choices are newest, oldest, and title.
- URL parameters are the source of truth for the current view so browser Back/Forward restores prior query state.

## Edit and Delete Contract

- Edit opens a labeled dialog on larger screens and may use a full-height modal treatment on narrow screens without changing semantics.
- The edit surface contains URL, title, description, tags, and favorite state. Archive state is changed through its distinct action.
- Delete opens a confirmation dialog naming the bookmark and distinguishing permanent deletion from archive.
- Cancel closes the dialog without a request. Confirm sends the delete request exactly once.
- Opening a modal moves focus into it; focus is contained while open and returns to the invoking control after close when that control still exists.

## Empty and Error States

| State | Required content and action |
|---|---|
| Empty active library | Explanation plus focusable action leading to the save form |
| Empty archive | Explanation plus action returning to active bookmarks |
| No matches | Current constraint summary plus clear-search/filter action |
| Metadata unavailable | Non-blocking explanation; save and manual title/description remain available |
| Initial load failure | Error message and retry action; readiness marker is absent |
| Mutation failure | Contextual error, unchanged local data, and retry path |

## Responsive and Accessibility Contract

- At widths from 320 pixels upward, the page has no horizontal document scrolling; long URLs, titles, descriptions, and tags wrap or truncate with an accessible full value.
- Every control has a visible label or accessible name and a visible keyboard focus indicator.
- Native elements are preferred. Custom dialogs follow dialog focus behavior and expose a label and description.
- Status and validation changes are announced without unexpectedly moving focus.
- Icon-only actions, if used, have bookmark-specific accessible names such as “Archive Example Domain.”
- Color is never the only indicator for favorite, archive, error, loading, filter, or focus state.
- Reduced-motion preferences disable nonessential transitions.

