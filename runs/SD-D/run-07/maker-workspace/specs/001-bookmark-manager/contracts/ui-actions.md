# UI and Server Action Contract

All mutation inputs are validated on the server. Outcomes use `{ ok: true, data }` or `{ ok: false, error }`, with a stable error code, user-safe message, and field errors where relevant.

## Bookmark actions

### Create bookmark

Input: original URL, title, optional description, optional note, tag names, favorite state, read state, and optional accepted metadata/icon reference.

Outcomes:

- Created: returns bookmark ID and detail destination.
- Duplicate: returns `DUPLICATE_URL`, existing bookmark ID, and its detail destination; the UI navigates there.
- Validation failure: preserves the submitted draft and identifies invalid fields.

### Update bookmark

Input: bookmark ID and changed editable fields. URL changes rerun normalization and duplicate detection. A duplicate collision returns the existing bookmark without overwriting either record.

### Status actions

Separate idempotent actions set favorite, read, and archive status. Changing one never changes the others. Restore clears archive time.

### Delete bookmark

Requires bookmark ID plus explicit confirmation state. Success navigates back to the relevant collection view.

## Metadata preview

Specified by [metadata-api.yaml](metadata-api.yaml). The client cancels superseded requests when the URL changes and ignores any response whose requested normalized URL no longer matches the draft.

## Selection modes

- `explicit`: stable list of selected bookmark IDs from displayed results.
- `all_matching`: current validated search AST reference plus filters and active/archive scope. The server resolves it immediately into a snapshot.

Changing query/filter/scope clears the browser's explicit selection unless the user has already created a bulk preview snapshot.

## Bulk preview

Input: selection mode, action, and action payload. The server validates targets, writes the frozen operation/items, and returns operation ID, action label, target count, expiry, and whether permanent confirmation is required.

All bulk actions show the target count before execution. Deletion requires a second explicit confirmation. Non-delete actions may execute directly after the preview count is visibly presented.

## Bulk confirmation

Input: operation ID and confirmation token. An expired preview returns `OPERATION_EXPIRED` and requires a new count. A completed operation returns the stored result and does not execute again.

Result: target, success, and failure counts plus failed item IDs and actionable safe reason codes. Successful items remain changed if another item fails.

## Accessibility contract

- Every action is reachable and operable by keyboard.
- Selection controls expose selected state and an accessible label containing the bookmark title.
- Dialogs move focus inside on open, identify their title/description, keep focus contained, close on Escape when safe, and restore focus to their trigger.
- After mutations, focus moves predictably and a live region announces the result without relying on color.
- Search syntax errors associate their message with the query field and identify the error position in text.
