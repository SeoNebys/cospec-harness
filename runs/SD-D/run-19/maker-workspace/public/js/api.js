// Thin fetch wrappers around the JSON API.

async function request(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(path, opts);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Request failed (${res.status})`);
    err.status = res.status; err.code = data?.error?.code; err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  previewBookmark: (url) => request('POST', '/api/bookmarks/preview', { url }),
  createBookmark: (data) => request('POST', '/api/bookmarks', data),
  getBookmark: (id) => request('GET', `/api/bookmarks/${id}`),
  updateBookmark: (id, patch) => request('PATCH', `/api/bookmarks/${id}`, patch),
  deleteBookmark: (id) => request('DELETE', `/api/bookmarks/${id}`),
  listBookmarks: (params) => request('GET', `/api/bookmarks?${new URLSearchParams(clean(params))}`),
  bulk: (selection, action, extra = {}) => request('POST', '/api/bookmarks/bulk', { selection, action, ...extra }),
  preserve: (id) => request('POST', `/api/bookmarks/${id}/preserve`),
  archiveOrg: (id) => request('POST', `/api/bookmarks/${id}/archive-org`),
  tags: (prefix = '') => request('GET', `/api/tags?prefix=${encodeURIComponent(prefix)}`),
  savedSearches: () => request('GET', '/api/saved-searches'),
  createSavedSearch: (data) => request('POST', '/api/saved-searches', data),
  deleteSavedSearch: (id) => request('DELETE', `/api/saved-searches/${id}`),
  preferences: () => request('GET', '/api/preferences'),
  updatePreferences: (data) => request('PUT', '/api/preferences', data),
};

function clean(params = {}) {
  const out = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    out[k] = Array.isArray(v) ? v.join(',') : v;
  }
  return out;
}
