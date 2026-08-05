# Reference spec — Bookmark management application · Level (A) implementable

- Domain: bookmark management
- Common initial prompt: "I want to build an app to save and manage bookmarks."
- Reference OSS: Linkding (Sascha Sieber, https://github.com/sissbruecker/linkding)
  — its public README/docs were **referenced** to derive the feature set; this is
  not a reproduction of a specific product but represents the domain's feature ceiling.
- Spec level: **(A)** — entities, behaviour rules, states, edge cases, and
  acceptance conditions, at a level where a **functionally equivalent
  re-implementation is possible** even if the UI/code differ.
- Status: not a comparison arm but the **coverage upper-bound anchor** and the
  client's standardised tacit knowledge. No execution session.
- Coverage unit: **functional requirement (REF-BM-###)**.

---

## 1. Overview / scope

A single-user application to save, categorise, search, and revisit web links
(bookmarks), and to manage read state and archiving. On save it automatically
collects metadata from the remote page; it organises with tags, search, and
bundles, and preserves a snapshot of the original. The scope below splits into
the user features the client co-constructs (core / extended) and the operational
features excluded from the denominator (infra).

## 2. Core entities

| Entity | Fields | Constraints / relations |
|---|---|---|
| Bookmark | url, title, description, note (markdown), unread flag, archived flag, favicon, preview image, snapshot reference, created-at, updated-at | url required. Many-to-many with tags. Re-saving the same url should lead to editing the existing bookmark, not creating a new one. |
| Tag | name | Name unique within the user scope. Many-to-many with bookmarks. |
| Bundle | name, search term, included tags, excluded tags | A saved filter. When viewed, dynamically selects bookmarks matching the conditions. |
| User settings | default sort, displayed items, font size | Personal profile settings. |

## 3. Functional requirements

### 3.1 Core

- REF-BM-01: Save a bookmark by entering a url.
- REF-BM-02: On save, automatically collect the target page's title, description, favicon, and preview image.
- REF-BM-03: The user can edit the auto-collected title/description before and after saving.
- REF-BM-04: Edit a bookmark's url/title/description/tags/note.
- REF-BM-05: Delete a bookmark.
- REF-BM-06: When re-saving an existing url, guide the user to edit the existing bookmark instead of creating a new one.
- REF-BM-07: Display the bookmark list readability-first, exposing title, description, tags, and favicon per item.
- REF-BM-08: Selecting a list item navigates to the original url.
- REF-BM-09: Assign one or more tags to a bookmark.
- REF-BM-10: On tag entry, offer existing tags as autocomplete.
- REF-BM-11: Select a specific tag to filter to only that tag's bookmarks.
- REF-BM-12: Full-text search over title, description, note, and url.
- REF-BM-13: Search is case-insensitive.
- REF-BM-14: Search tags with the `#tag` syntax.
- REF-BM-15: Use AND/OR/NOT operators and parenthesised groups in the search term (e.g. `rome (#article or #book)`). Rule: the operators themselves must be quoted to be treated as literal search terms.
- REF-BM-16: Search a quoted phrase as an exact match.
- REF-BM-17: Mark a bookmark as "read later" (unread).
- REF-BM-18: View only unread bookmarks separately.
- REF-BM-19: Mark a bookmark as read to remove it from the unread list.
- REF-BM-20: Select multiple bookmarks to perform a bulk action (add/remove tags, read/unread, archive, delete).
- REF-BM-21: Apply a bulk action to the whole collection matching the current filter.
- REF-BM-22: Sort the list by a sort key (date added, title, etc.).

### 3.2 Extended

- REF-BM-23: Write a markdown note on a bookmark and render it when viewing.
- REF-BM-24: Preserve a snapshot of the bookmarked page as local HTML (single file). Rule: if the url is a PDF, download and store the PDF instead of an HTML snapshot.
- REF-BM-25: Support creating a snapshot on the Internet Archive.
- REF-BM-26: Archive a bookmark to hide it from the default list/search while keeping its content.
- REF-BM-27: Distinguish archive from delete — archive is reversible, delete is permanent removal.
- REF-BM-28: View only archived bookmarks as a separate list.
- REF-BM-29: Save a combination of search term and included/excluded tags as a bundle for reuse.
- REF-BM-30: Import bookmarks in Netscape HTML format (preserving title, tags, date added).
- REF-BM-31: Export bookmarks in Netscape HTML format.
- REF-BM-32: Adjust display-related personal settings (default sort, displayed items, font size, etc.).

### 3.3 Infra — excluded from the coverage denominator

- REF-BM-I01: Multi-user support and a self-service admin panel.
- REF-BM-I02: SSO (OIDC) / auth-proxy login.
- REF-BM-I03: Third-party integration REST API.
- REF-BM-I04: Browser extensions (Firefox/Chrome) / bookmarklet / PWA share sheet.
- REF-BM-I05: Backup and raw-data access.

## 4. Edge cases / business rules

- Archived bookmarks are excluded from the default list and ordinary search results, and appear only in the archive list.
- In search, tag search (`#`) and full-text search combine with AND, and boolean/parentheses/phrases are supported.
- "Apply to whole collection" for bulk actions is limited to the scope defined by the current filter (search term / tag / perspective).
- A duplicate save attempt of the same url converges to editing the existing item, preventing duplicates.
- If a snapshot target url is a PDF, download and store the PDF instead of an HTML snapshot.

## 5. Coverage scoring convention

- Unit: each `REF-BM-###`. Judge whether the feature a method elicited/implemented realises each item as **present / partial / absent**.
- Direction: one-way (reference -> method). Whether a method produced a feature not in the reference is not judged (no ground truth) and is not measured.
- Denominator: primary = core (3.1); secondary = core + extended (3.1 + 3.2). Infra (3.3) is excluded.
- To mitigate judgment bias, run and report a blind secondary judgment and inter-rater reliability.

## Item counts

- Core (REF-BM-01..22): 22
- Extended (REF-BM-23..32): 10
- Infra (REF-BM-I01..I05): 5
- Coverage primary denominator (core): 22 · secondary (core + extended): 32
