// Thin fetch wrappers around the JSON API. Throw an Error with .code/.message
// carrying the server's error shape { error: { code, message } }.

async function request(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  if (res.status === 204) return null;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error((data && data.error && data.error.message) || `Request failed (${res.status})`);
    err.code = data && data.error && data.error.code;
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function qs(params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '') continue;
    if (Array.isArray(v)) {
      if (v.length) sp.set(k, v.join(','));
    } else {
      sp.set(k, v);
    }
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const api = {
  listBookmarks: (params) => request('GET', `/api/bookmarks${qs(params)}`),
  getBookmark: (id) => request('GET', `/api/bookmarks/${id}`),
  createBookmark: (body) => request('POST', '/api/bookmarks', body),
  updateBookmark: (id, body) => request('PATCH', `/api/bookmarks/${id}`, body),
  deleteBookmark: (id) => request('DELETE', `/api/bookmarks/${id}`),
  bulk: (body) => request('POST', '/api/bookmarks/bulk', body),
  snapshot: (id) => request('POST', `/api/bookmarks/${id}/snapshot`),
  archiveOrg: (id) => request('POST', `/api/bookmarks/${id}/archive-org`),
  tags: (prefix) => request('GET', `/api/tags${qs({ prefix })}`),
  savedSearches: () => request('GET', '/api/saved-searches'),
  createSavedSearch: (body) => request('POST', '/api/saved-searches', body),
  updateSavedSearch: (id, body) => request('PATCH', `/api/saved-searches/${id}`, body),
  deleteSavedSearch: (id) => request('DELETE', `/api/saved-searches/${id}`),
  savedSearchResults: (id, params) => request('GET', `/api/saved-searches/${id}/results${qs(params || {})}`),
  preferences: () => request('GET', '/api/preferences'),
  updatePreferences: (body) => request('PATCH', '/api/preferences', body),
  import: async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/import', { method: 'POST', body: fd });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const err = new Error((data && data.error && data.error.message) || 'Import failed');
      err.code = data && data.error && data.error.code;
      throw err;
    }
    return data;
  },
};
