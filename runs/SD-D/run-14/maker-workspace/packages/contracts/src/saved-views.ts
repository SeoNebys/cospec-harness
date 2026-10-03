import type { Filters } from './search.js';
import type { SortDirection, SortField } from './common.js';
export interface SavedViewInput { name: string; query: string; filters: Filters; sort: SortField; direction: SortDirection }
export interface SavedView extends SavedViewInput { id: string; createdAt: string; updatedAt: string }
