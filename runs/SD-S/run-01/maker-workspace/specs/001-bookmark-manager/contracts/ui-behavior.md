# UI Behavior Contract: Personal Bookmark Manager

**Date**: 2026-09-16  
**Related API**: [openapi.yaml](openapi.yaml)

This contract defines observable user-interface behavior. Visual styling may evolve during implementation, but these interactions and states must remain true.

## Global Shell and Readiness

- The application has one clear page title, primary navigation between **Bookmarks** and **Archive**, and an obvious **Add bookmark** action in the active view.
- The current view is programmatically and visually identifiable.
- Initial loading shows a non-ready loading state.
- `data-harness-ready="true"` appears on the application root only after the first list request resolves to a valid loaded collection or loaded empty state.
- An initial-load error is not marked ready and offers a visible retry action.
- Success and failure results are announced through an accessible status region without unexpectedly moving keyboard focus.

## Active Collection

- Each bookmark exposes title, address/domain context, notes when present, tags, favorite state, and primary actions.
- The title/address action opens the destination in a new browser context using safe external-link behavior, leaving collection state intact.
- Search is labeled, applies across title/address/notes/tags, and updates results without requiring a page reload.
- Tag, favorite, and sort controls have visible labels. Active criteria remain visible and can be cleared in one action.
- Search, tag, and favorite criteria combine; changing sort never clears filters.
- The collection distinguishes:
  - a new collection with an **Add your first bookmark** action;
  - a loaded collection with matching items;
  - a no-results state that summarizes active criteria and offers **Clear filters**;
  - a recoverable load error with **Try again**.

## Create and Edit Form

- The same form pattern may serve create and edit, but its heading and submit label identify the current action.
- Fields are labeled **Web address**, **Title**, **Notes**, and **Tags**; title is always entered by the user in this release.
- Required fields and length constraints are exposed before submission where browser semantics support them.
- Validation errors are associated with their fields and a submit attempt focuses or summarizes the first invalid field.
- Tags can be entered and removed without a pointer; their de-duplicated result is visible before saving.
- Cancel returns to the previous collection context without modifying data.
- A failed request leaves all entered values available for correction or retry.
- On success, the form closes, the affected bookmark is visible when it matches current criteria, and a status message identifies the result.

## Duplicate Decision

- If create returns `DUPLICATE_BOOKMARK`, entered values remain intact.
- The UI identifies the existing bookmark and explains that the address is already saved.
- The user receives two explicit choices: cancel/return to the existing item, or save another copy.
- Another copy is submitted only after that explicit choice, using `allowDuplicate: true`.

## Favorite and Archive Actions

- Favorite state is conveyed by text or an accessible name, not color alone.
- Favorite/unfavorite and archive actions provide immediate busy protection against repeated activation while pending.
- On success, visible state updates consistently with current filters. For example, unfavoriting in a favorites-only view removes the item from results.
- On failure, the item remains in its previous state and an actionable message is announced.

## Archive View

- Archive is visually distinct from the active collection and does not show **Add bookmark**.
- Archived bookmarks expose **Restore** and **Delete permanently** actions.
- Restore returns the bookmark to the active collection with content, tags, and favorite state intact.
- Empty archive and filtered no-results states are distinct.

## Permanent Delete Confirmation

- Activating **Delete permanently** opens a modal confirmation that names the bookmark and states that the action cannot be undone.
- Focus moves into the dialog, stays within it while open, and returns to the triggering control after cancellation when that control still exists.
- Cancel is the safe default; closing the dialog by Escape behaves as cancel.
- The delete request is issued only from the dialog's explicit destructive action.
- While deletion is pending, repeated submission is prevented.
- On success, the dialog closes, the item is removed, and completion is announced.
- On failure, the dialog remains usable or returns to a retryable archive state without falsely removing the item.

## Responsive and Input Behavior

- At 375px CSS viewport width, primary tasks are complete without horizontal page scrolling; controls may stack and secondary filters may use a labeled disclosure.
- At 1440px width, content uses the available space without stretching reading lines or controls excessively.
- All controls work with keyboard input and have visible focus indicators.
- Pointer targets are comfortably selectable on touch-sized screens.
- Content wrapping handles 300-character titles, 2048-character addresses, long notes, and 20 tags without overlapping actions or forcing page-level horizontal scrolling.
- Motion is non-essential and respects reduced-motion preferences.

## Requirement Traceability

| Spec area | Contract coverage |
|---|---|
| FR-001–FR-006 | Create/edit form, active collection, opening behavior |
| FR-007–FR-010 | Favorite action, search/filter/sort behavior |
| FR-011–FR-013 | Archive view, restore, permanent-delete dialog |
| FR-014–FR-015 | Field errors and duplicate decision |
| FR-016–FR-017 | Empty/error/status states |
| FR-018 | Responsive and input behavior |
| SC-001–SC-006 | Readiness, performance validation, task flows, criteria visibility, responsive checks, deletion confirmation |
