// Shared enums/constants used by both server and web.

export const SORT_KEYS = [
  'dateAdded_desc',
  'dateAdded_asc',
  'title_asc',
  'title_desc',
  'dateUpdated_desc',
];
export const DEFAULT_SORT = 'dateAdded_desc';

export const VIEWS = ['all', 'unread', 'archived'];

export const SNAPSHOT_TYPES = ['html', 'pdf', 'none'];
export const SNAPSHOT_STATUS = ['pending', 'available', 'unavailable'];

export const METADATA_STATUS = ['collected', 'fallback'];

export const FONT_SIZES = ['small', 'medium', 'large'];

export const PREFS_DEFAULTS = {
  defaultSort: DEFAULT_SORT,
  itemsPerPage: 25,
  fontSize: 'medium',
};

export const ITEMS_PER_PAGE_MIN = 10;
export const ITEMS_PER_PAGE_MAX = 200;

export const BULK_ACTIONS = [
  'addTag',
  'removeTag',
  'markRead',
  'markUnread',
  'archive',
  'unarchive',
  'delete',
];
