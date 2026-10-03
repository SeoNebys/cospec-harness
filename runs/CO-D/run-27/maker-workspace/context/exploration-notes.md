# Exploration notes (forward-looking client requests)

Items the client raised that belong to a feature block not yet explored/approved.
Address these when the relevant feature is prototyped in Phase 1.

## Build-scope requirements (must be honoured in Phase 2)

- **Cross-device sync** (raised Cycle 1, Session 1): in the finished web app the
  client expects preferences AND bookmarks to follow them between computer and phone.
  Implies a user account with central (server-side) storage and sync, not
  browser-only localStorage. The Phase 1 prototype simulates storage in the browser;
  the real implementation must provide accounts + synced storage.

- **PDF detection by content type** (raised Cycle 1, Session 1; part of SCN-011):
  the finished app must decide whether a saved link is a PDF from the ACTUAL fetched
  response's content type, not the ".pdf" address suffix (some downloads serve a PDF
  with no suffix). Preserve as a PDF whenever the response really is a PDF.
- **Real page/PDF capture & Internet Archive submission**: the finished app must
  actually fetch and store page/PDF content and submit to the Internet Archive
  (Save Page Now); the Phase 1 prototype simulates these offline.

## "Manage" behaviours still to explore before locking scope (Cycle 1)

Work through each prototype-first, one at a time:
1. [RESOLVED — SCN-007] Deleting links (permanent)
2. [RESOLVED — SCN-007] Reversible archive (put aside, restore)
3. [RESOLVED — SCN-008] Notes on a bookmark (free text; searchable; Markdown)
4. [RESOLVED — SCN-009] Bulk changes to many selected links at once
5. [RESOLVED — SCN-010] Saving useful search-and-tag combinations (saved views)
6. [RESOLVED — SCN-011] Preserved copy of a page (self-contained copy, PDF by
   actual content type, optional Internet Archive link)
7. [RESOLVED — SCN-012] Importing / exporting bookmarks

- **[RESOLVED in Cycle 1 — SCN-006] Tags on list items**: bookmark tags are shown as
  #chips on each list item alongside icon/title/description/address/preview.

- **[RESOLVED in Cycle 1 — SCN-004/006] Tag-aware `#tagname` search**: `#tag` now
  matches actual tags in the search query language.

- **"Refresh page details" action in the editor** (raised Cycle 1, Session 1):
  when the client intentionally changes a bookmark's address to a completely
  different page, offer a separate, explicit action to re-fetch title/description/
  icon/preview for the new address. Default stays: editing the address must NOT
  overwrite the client's own title/description. Explore as a later refinement.

- **[RESOLVED — SCN-004/008] Search covers notes**: note text is included in
  ordinary word search alongside title, description, and address.

