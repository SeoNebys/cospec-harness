# UI Interaction Contract

## Application shell

Persistent navigation exposes Collection, Read later, Archived, Saved views, and Settings. The global add-bookmark action is available from collection-oriented screens. After initial data or a valid empty state loads, the shell carries `data-harness-ready="true"`.

## Collection view

- Search input accepts the language in `search-grammar.md`, shows syntax help, preserves invalid text, and displays positioned errors without replacing the last valid result set.
- Filters cover tags, favorite state, read state, and active/archived state.
- Sort offers date saved, date updated, title, and destination in both directions.
- Each bookmark shows title/fallback, host, available favicon/preview, tags, favorite, read state, snapshot state, and saved date.
- Each item offers open live page, open snapshot when available, favorite toggle, read/unread toggle, edit, archive/restore, and delete.
- Empty-library and no-results presentations are visually and verbally distinct; no-results offers reset controls.

## Save/edit flow

- A valid URL is the only required initial input. Submission creates the record immediately and exposes independent metadata and snapshot progress.
- Retrieved title, description, favicon, and preview are editable. User-edited fields display that they will be protected from routine refresh.
- Refresh that would overwrite protected fields lists those fields and requires explicit confirmation.
- Read-later, favorite, notes, and tags can be set during creation or editing.
- Duplicate URL response opens a decision path to view or update the existing bookmark; it never silently creates another.
- Retrieval/capture failures preserve the bookmark and offer retry plus manual metadata editing.

## Snapshot viewer

- Opens the inert stored image, never the captured page's scripts.
- Displays original URL, capture timestamp, complete/partial status, and limitation message when relevant.
- Offers open-live and explicit refresh actions.
- While a refresh runs or fails, a prior successful snapshot remains viewable.

## Read later

- Contains active unread bookmarks only.
- Marking an item read removes it immediately with a short undo opportunity in the current client session; persistence uses the ordinary state endpoint.
- Read state remains independent of favorite and archive state.

## Selection and bulk actions

- Selecting a visible item enters selection mode and displays the explicit selected count.
- “Select all current results” clearly changes scope from visible/explicit items to every server-matching result, including unloaded items.
- Changing the query/filters invalidates an all-results selection and requires reselection.
- Add-tag and archive show scope before execution. Delete requires a modal naming the action and current server-confirmed count.
- Completion reports affected count and any failed items. Selection clears only after the result is acknowledged.

## Saved views

- Save captures the exact query text, active filters, and sort.
- Names are unique without regard to case; conflicts keep the editor open with a field error.
- Opening re-evaluates current data and visibly identifies the active saved view.
- If the active definition changes, the UI distinguishes unsaved changes and supports Update or Save as new.
- Rename and delete do not alter bookmarks; saved-view deletion requires lightweight confirmation.

## Settings

- Theme options: system, light, dark.
- Density options: comfortable, compact.
- Changes preview immediately, persist through the preferences endpoint, and survive reload.
- System theme reacts to device changes while the saved preference remains `system`.

## Responsive and accessibility requirements

- All core actions are keyboard reachable with visible focus.
- Selection, favorite, and read state are communicated by accessible names/state, not color alone.
- Dialogs trap focus, have labelled titles, support Escape for cancellation when safe, and restore focus to the invoking control.
- On narrow screens, filters and bulk controls may collapse into drawers but retain the same scope wording and capabilities.
- Compact density changes spacing and image sizing, not available information or action labels.

## Loading and error behavior

- Initial loading does not carry the harness-ready marker.
- Background metadata/snapshot work appears at item level and does not block collection interaction.
- Mutation failures retain user input/selection and offer retry.
- Network/offline errors are distinguished from validation and remote-page retrieval errors.
- Destructive success is never claimed until the API confirms it.
