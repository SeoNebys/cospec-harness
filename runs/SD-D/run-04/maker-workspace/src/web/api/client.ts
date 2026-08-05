import type {
  Bookmark,
  CreateBookmarkInput,
  SavedSearch,
  TagFilter,
  UpdateBookmarkInput,
} from '../../shared/types';

// Typed wrapper over the REST contract (contracts/rest-api.md). US1 scope only.

export interface ApiError {
  code: string;
  message: string;
}

export class ApiRequestError extends Error {
  code: string;
  constructor(err: ApiError) {
    super(err.message);
    this.code = err.code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'content-type': 'application/json' },
    ...init,
  });
  const data = res.status === 204 ? null : await res.json();
  if (!res.ok) {
    const err = (data as { error?: ApiError })?.error ?? {
      code: 'unknown',
      message: `Request failed (${res.status})`,
    };
    throw new ApiRequestError(err);
  }
  return data as T;
}

export interface ListResponse {
  bookmarks: Bookmark[];
  total: number;
}

export interface CreateResponse {
  bookmark: Bookmark;
  existing: boolean;
}

export interface TagInfo {
  name: string;
  count: number;
}

function filterToQuery(filter: TagFilter): string {
  const p = new URLSearchParams();
  if (filter.text) p.set('text', filter.text);
  for (const t of filter.tagsAny ?? []) p.append('tagsAny', t);
  for (const t of filter.tagsAll ?? []) p.append('tagsAll', t);
  for (const t of filter.tagsNot ?? []) p.append('tagsNot', t);
  if (filter.view) p.set('view', filter.view);
  if (filter.sort) p.set('sort', filter.sort);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const api = {
  list(filter: TagFilter = {}): Promise<ListResponse> {
    return request<ListResponse>(`/bookmarks${filterToQuery(filter)}`);
  },
  tags(): Promise<{ tags: TagInfo[] }> {
    return request<{ tags: TagInfo[] }>('/tags');
  },
  create(input: CreateBookmarkInput): Promise<CreateResponse> {
    return request<CreateResponse>('/bookmarks', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  get(id: number): Promise<{ bookmark: Bookmark }> {
    return request<{ bookmark: Bookmark }>(`/bookmarks/${id}`);
  },
  update(id: number, patch: UpdateBookmarkInput): Promise<{ bookmark: Bookmark }> {
    return request<{ bookmark: Bookmark }>(`/bookmarks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },
  remove(id: number): Promise<null> {
    return request<null>(`/bookmarks/${id}`, { method: 'DELETE' });
  },
  batch(
    ids: number[],
    action: 'addTag' | 'archive' | 'unarchive' | 'delete',
    tag?: string
  ): Promise<{ updated?: number; deleted?: number }> {
    return request('/bookmarks/batch', {
      method: 'POST',
      body: JSON.stringify({ ids, action, tag }),
    });
  },
  importCollection(doc: unknown): Promise<ImportSummary> {
    return request<ImportSummary>('/import', {
      method: 'POST',
      body: JSON.stringify(doc),
    });
  },
  exportUrl: '/api/export',
  listSavedSearches(): Promise<{ savedSearches: SavedSearch[] }> {
    return request('/saved-searches');
  },
  createSavedSearch(input: {
    name: string;
    queryText?: string;
    filter: TagFilter;
  }): Promise<{ savedSearch: SavedSearch }> {
    return request('/saved-searches', { method: 'POST', body: JSON.stringify(input) });
  },
  updateSavedSearch(
    id: number,
    patch: { name?: string; queryText?: string; filter?: TagFilter }
  ): Promise<{ savedSearch: SavedSearch }> {
    return request(`/saved-searches/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
  },
  deleteSavedSearch(id: number): Promise<null> {
    return request(`/saved-searches/${id}`, { method: 'DELETE' });
  },
};

export interface ImportSummary {
  added: number;
  alreadyPresent: number;
  savedSearchesAdded: number;
}
