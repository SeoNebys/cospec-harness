// Thin fetch wrapper around the JSON API (all stories).
async function request(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`/api${path}`, opts);
  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function qs(params = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const api = {
  listBookmarks: (params = {}) => request('GET', `/bookmarks${qs(params)}`),
  getBookmark: (id) => request('GET', `/bookmarks/${id}`),
  createBookmark: (payload) => request('POST', '/bookmarks', payload),
  updateBookmark: (id, payload) => request('PATCH', `/bookmarks/${id}`, payload),
  deleteBookmark: (id) => request('DELETE', `/bookmarks/${id}`),
  setRead: (id, read) => request('POST', `/bookmarks/${id}/${read ? 'read' : 'unread'}`),
  setArchived: (id, archived) => request('POST', `/bookmarks/${id}/${archived ? 'archive' : 'restore'}`),
  bulk: (payload) => request('POST', '/bookmarks/bulk', payload),
  tags: (prefix) => request('GET', `/tags${qs({ prefix })}`),
  snapshot: (id) => request('POST', `/bookmarks/${id}/snapshot`),
  archiveCopy: (id) => request('POST', `/bookmarks/${id}/archive-copy`),
  savedSearches: () => request('GET', '/saved-searches'),
  createSavedSearch: (payload) => request('POST', '/saved-searches', payload),
  deleteSavedSearch: (id) => request('DELETE', `/saved-searches/${id}`),
  runSavedSearch: (id) => request('GET', `/saved-searches/${id}/run`),
  getPreferences: () => request('GET', '/preferences'),
  updatePreferences: (payload) => request('PUT', '/preferences', payload),
};
