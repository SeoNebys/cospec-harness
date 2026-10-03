# Browser Bookmark Interchange Contract

## Accepted Input

The importer accepts bookmark HTML exports produced by current Chrome, Edge, Firefox, and Safari releases. These products use variants of the Netscape Bookmarks HTML family rather than one versioned formal standard.

The parser treats the upload as inert data:

- Maximum encoded file size: 10 MiB.
- Maximum bookmark entries: 20,000.
- Maximum folder nesting: 100.
- HTML is parsed tolerantly; scripts, event handlers, styles, embedded objects, and all non-bookmark markup are ignored.
- Only anchor entries with absolute HTTP or HTTPS destinations are candidates.
- Credentials in destinations and unsupported schemes are invalid.
- Titles are extracted as text only. If empty, the normalized host becomes the title.
- ADD_DATE is accepted as Unix epoch seconds when valid; otherwise the import time is used.
- A following DD description may populate description within the normal length limit.
- Imported ICON data is untrusted. Only bounded raster data that passes the same decoder and normalization pipeline as fetched icons may be retained.

## Folder-to-Tag Mapping

Every meaningful non-empty ancestor folder name becomes a tag on the imported bookmark. Names are normalized with the same case-insensitive rules as user-created tags. Repeated ancestors collapse to one tag.

Generic browser container names such as Bookmarks Bar, Favorites Bar, Other Bookmarks, Mobile Bookmarks, and localized equivalents identified by the supported parser are not converted to tags.

Safari entries carrying the documented com.apple.ReadingList identifier enter the app as unread read-later items. Folder names alone never infer favorite, archive, or reading state.

## Preview Contract

Preview parses and normalizes the file without creating bookmarks. It returns:

- Total entries encountered.
- Valid new entries.
- Duplicates of active or archived bookmarks and duplicates within the upload.
- Invalid entries.
- Up to 100 safe row-level issue summaries.
- An opaque preview identifier and expiry time.

The server stores the normalized snapshot with its file digest. Commit consumes that exact snapshot; it never reparses replacement bytes under the same preview identifier.

## Commit Contract

- Every repository write is account-scoped.
- A database uniqueness constraint remains the final duplicate authority.
- Valid browser entries can succeed when other entries fail.
- Successfully committed entries record their result in the staging row before retry can create another copy.
- A retry resumes pending entries and reports existing results.
- Imported bookmarks are not automatically fetched in bulk. Users can explicitly refresh page details later.

## Browser-Compatible Output

The browser HTML export contains active and archived bookmark URLs, titles, and creation dates in Netscape Bookmarks HTML. Tags are represented as folders where practical. Because browser HTML cannot represent all application state, the UI labels this export as browser-compatible rather than a complete backup.

Notes, descriptions, favorite state, exact tag combinations, read/read-later state, archive state, and normalized app-owned icons are guaranteed only by the complete JSON backup defined in [backup.schema.json](backup.schema.json).

