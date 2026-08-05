import Dexie, { type Table } from 'dexie';
import type { Bookmark } from '../models/bookmark';

// Local, on-device storage (IndexedDB) via Dexie. No network, no accounts.
// Schema (data-model.md): primary key `id`, index on `dateSaved` for default
// most-recent-first ordering, multi-entry index on `tags` for tag filtering.
export class BookmarkDB extends Dexie {
  bookmarks!: Table<Bookmark, string>;

  constructor() {
    super('bookmark-manager');
    this.version(1).stores({
      bookmarks: 'id, dateSaved, *tags',
    });
  }
}

export const db = new BookmarkDB();
