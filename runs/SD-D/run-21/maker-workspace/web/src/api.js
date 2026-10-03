// REST client wrapping the API (contracts/api.md).
async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  let body = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    const message = (body && body.error) || `Request failed (${res.status}).`;
    const err = new Error(message);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

const qs = (params) => {
  const sp = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') sp.set(k, v);
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
};

export const api = {
  fetchMetadata: (url) => request('/api/metadata', { method: 'POST', body: JSON.stringify({ url }) }),
  createBookmark: (data) => request('/api/bookmarks', { method: 'POST', body: JSON.stringify(data) }),
  listBookmarks: (params) => request(`/api/bookmarks${qs(params)}`),
  getBookmark: (id) => request(`/api/bookmarks/${id}`),
  updateBookmark: (id, data) => request(`/api/bookmarks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBookmark: (id) => request(`/api/bookmarks/${id}`, { method: 'DELETE' }),
  setStatus: (id, data) => request(`/api/bookmarks/${id}/status`, { method: 'POST', body: JSON.stringify(data) }),
  bulk: (select, action) => request('/api/bookmarks/bulk', { method: 'POST', body: JSON.stringify({ select, action }) }),
  listTags: () => request('/api/tags'),
  suggestTags: (prefix) => request(`/api/tags/suggest${qs({ prefix })}`),
  listViews: () => request('/api/views'),
  createView: (data) => request('/api/views', { method: 'POST', body: JSON.stringify(data) }),
  updateView: (id, data) => request(`/api/views/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteView: (id) => request(`/api/views/${id}`, { method: 'DELETE' }),
  viewResults: (id, params) => request(`/api/views/${id}/results${qs(params)}`),
  importBookmarks: (html) => request('/api/import', { method: 'POST', body: JSON.stringify({ html }) }),
  capture: (id) => request(`/api/bookmarks/${id}/capture`, { method: 'POST', body: '{}' }),
  archiveorg: (id) => request(`/api/bookmarks/${id}/archiveorg`, { method: 'POST', body: '{}' }),
  getPreferences: () => request('/api/preferences'),
  savePreferences: (data) => request('/api/preferences', { method: 'PUT', body: JSON.stringify(data) }),
};
