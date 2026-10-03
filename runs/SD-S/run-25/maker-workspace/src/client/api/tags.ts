import type { TagList } from '../../shared/contracts.js';
import { requestJson, type ApiRequestOptions } from './bookmarks.js';

export function listTags(options: ApiRequestOptions = {}): Promise<TagList> {
  return requestJson<TagList>('/api/tags', { signal: options.signal });
}
