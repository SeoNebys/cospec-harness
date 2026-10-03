import type {
  MetadataPreview,
  PageMetadataRequest,
} from '../../shared/contracts.js';
import {
  requestJson,
  type ApiRequestOptions,
} from './bookmarks.js';

export function previewPageMetadata(
  request: PageMetadataRequest,
  options: ApiRequestOptions = {},
): Promise<MetadataPreview> {
  return requestJson<MetadataPreview>('/api/page-metadata', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
    signal: options.signal,
  });
}
