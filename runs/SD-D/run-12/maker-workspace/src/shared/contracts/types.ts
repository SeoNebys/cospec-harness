export type Tag = { id: number; name: string };
export type Bookmark = {
  id: number;
  url: string;
  title: string;
  description: string | null;
  notes: string | null;
  iconUrl: string | null;
  tags: Tag[];
  isFavorite: boolean;
  isUnread: boolean;
  createdAt: string;
  updatedAt: string;
};
export type BookmarkWrite = {
  url: string;
  title: string;
  description?: string | null;
  notes?: string | null;
  tags?: string[];
  isFavorite?: boolean;
  isUnread?: boolean;
  iconUploadToken?: string | null;
};
export type Problem = { type: string; title: string; status: number; code: string; detail: string; [key: string]: unknown };
export type MetadataWarningCode = 'dns_failure'|'timeout'|'tls_error'|'http_status'|'unsupported_content_type'|'response_too_large'|'parse_error'|'icon_unavailable';
export type MetadataResult = {
  requestId: string;
  status: 'success'|'partial'|'unavailable';
  requestedUrl: string;
  normalizedUrl: string;
  finalUrl: string | null;
  metadata: {
    title: { value: string; source: 'html-title'|'meta-description'|'open-graph'|'twitter'|'fallback' };
    description: { value: string; source: 'meta-description'|'open-graph'|'twitter' } | null;
    iconUploadToken: string | null;
  };
  warnings: Array<{ code: MetadataWarningCode; field?: 'page'|'title'|'description'|'icon' }>;
};
