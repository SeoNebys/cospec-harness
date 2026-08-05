# Contract: Capture & Saved-Copy Operations (UI ↔ core)

Capture runs in the background (Decision 8) so the UI never freezes. These
operations cover taking the copy at save time and viewing it later offline.

## captureForBookmark (background, enqueued by saveBookmark/import)

- **Input**: `bookmarkId`, `url`.
- **Behavior** (all **at save time**, so the copy reflects the page as it was —
  FR-007/008):
  1. Fetch the resource.
  2. **Metadata**: extract title, description, and favicon; store favicon locally;
     fill any title/description the user did not provide (FR-003, FR-005).
  3. **Copy**:
     - If the response is a **PDF** (by content type/extension) → download and
       retain the PDF file; Saved Copy `kind = pdf` (FR-008).
     - Else → run readable-article extraction, **sanitize** the HTML, store it as
       a file; Saved Copy `kind = reader` (FR-007).
     - If neither succeeds (login/paywall, non-article, unreachable) → Saved Copy
       `status = unavailable` (FR-009).
  4. Mark Saved Copy `captured` (with `captured_at`) or `unavailable`, and notify
     the UI to refresh that bookmark.
- **Guarantees**: Never blocks the save; failures degrade gracefully; a captured
  copy is **immutable** thereafter (survives later changes to the live page).

## getSavedCopy

- **Input**: `bookmarkId`.
- **Behavior**: Return the local saved copy for **offline** viewing (SC-003):
  - `kind = reader` → the sanitized article HTML, rendered inside the app.
  - `kind = pdf` → the retained PDF, opened in the app's viewer.
  - `status = unavailable` → an "no saved copy available" state (FR-009).
  - Never re-fetches the live page.
- **Output**: `{ kind, contentRef }` or `{ status: "unavailable" }`.

## recapture (optional, user-initiated)

- **Input**: `bookmarkId`.
- **Behavior**: Allow the user to explicitly capture again *now* (e.g. an earlier
  attempt was unavailable). Replaces the stored copy with a fresh one. Does not
  happen automatically — automatic capture is once, at save time.
