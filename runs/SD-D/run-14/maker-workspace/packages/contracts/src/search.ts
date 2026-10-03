import type { ReadState } from './bookmarks.js';
import type { SortDirection, SortField } from './common.js';
export interface Filters {
  tags?: string[];
  favorite?: boolean | null;
  readState?: ReadState | null;
  archiveState?: 'active' | 'archived' | 'all';
}
export interface ListRequest extends Filters {
  q?: string; sort?: SortField; direction?: SortDirection; cursor?: string; limit?: number;
}
