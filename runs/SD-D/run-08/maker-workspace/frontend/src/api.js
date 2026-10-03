// Typed-ish client for the backend API (contracts/api.md).

async function req(method, url, body, isForm = false) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    if (isForm) {
      opts.body = body;
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }
  const res = await fetch(url, opts);
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error((data && data.error && data.error.message) || 'Request failed');
    err.code = data && data.error && data.error.code;
    err.existingId = data && data.existingId;
    err.status = res.status;
    throw err;
  }
  return data;
}

function qs(params) {
  const sp = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') sp.set(k, v);
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const api = {
  listBookmarks: (params) => req('GET', `/api/bookmarks${qs(params)}`),
  listArchived: (params) => req('GET', `/api/bookmarks/archived${qs(params)}`),
  getBookmark: (id) => req('GET', `/api/bookmarks/${id}`),
  createBookmark: (body) => req('POST', '/api/bookmarks', body),
  updateBookmark: (id, body) => req('PATCH', `/api/bookmarks/${id}`, body),
  deleteBookmark: (id) => req('DELETE', `/api/bookmarks/${id}`),
  setReadState: (id, unread) => req('POST', `/api/bookmarks/${id}/read-state`, { unread }),
  archive: (id) => req('POST', `/api/bookmarks/${id}/archive`),
  restore: (id) => req('POST', `/api/bookmarks/${id}/restore`),
  archiveOrg: (id) => req('POST', `/api/bookmarks/${id}/archive-org`),
  bulk: (body) => req('POST', '/api/bookmarks/bulk', body),
  listTags: (prefix) => req('GET', `/api/tags${qs({ prefix })}`),
  listViews: () => req('GET', '/api/views'),
  createView: (body) => req('POST', '/api/views', body),
  updateView: (id, body) => req('PATCH', `/api/views/${id}`, body),
  deleteView: (id) => req('DELETE', `/api/views/${id}`),
  getPreferences: () => req('GET', '/api/preferences'),
  updatePreferences: (body) => req('PUT', '/api/preferences', body),
  importFile: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return req('POST', '/api/import', fd, true);
  },
};
