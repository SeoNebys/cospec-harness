import type { Filters } from './search.js';
export type ResultSelector =
  | { mode: 'explicit'; ids: string[] }
  | { mode: 'allResults'; query: string; filters: Filters; excludedIds: string[] };
export type BulkAction = { type: 'addTag'; tag: string } | { type: 'archive' } | { type: 'delete' };
export interface BulkRequest { selector: ResultSelector; action: BulkAction; confirmedTargetCount?: number }
export interface BulkResult { targetCount: number; affectedCount: number; failed: { bookmarkId: string; code: string }[] }
