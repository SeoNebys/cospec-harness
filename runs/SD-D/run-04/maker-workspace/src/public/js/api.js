// Thin fetch wrapper for the JSON API.
async function request(method, url, body, isText = false) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    if (isText) {
      opts.headers['Content-Type'] = 'text/html';
      opts.body = body;
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }
  const res = await fetch(url, opts);
  let data = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) data = await res.json();
  if (!res.ok) {
    const err = new Error((data && data.error && data.error.message) || res.statusText);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  listBookmarks: (params) => request('GET', '/api/bookmarks?' + params.toString()),
  createBookmark: (b) => request('POST', '/api/bookmarks', b),
  getBookmark: (id) => request('GET', `/api/bookmarks/${id}`),
  updateBookmark: (id, patch) => request('PATCH', `/api/bookmarks/${id}`, patch),
  deleteBookmark: (id) => request('DELETE', `/api/bookmarks/${id}`),
  bulk: (selector, action) => request('POST', '/api/bookmarks/bulk', { selector, action }),
  bulkCount: (selector) => request('POST', '/api/bookmarks/bulk/count', { selector }),
  listTags: () => request('GET', '/api/tags'),
  suggestTags: (q) => request('GET', '/api/tags/suggest?q=' + encodeURIComponent(q)),
  listViews: () => request('GET', '/api/views'),
  createView: (v) => request('POST', '/api/views', v),
  deleteView: (id) => request('DELETE', `/api/views/${id}`),
  viewResults: (id, params) => request('GET', `/api/views/${id}/results?` + params.toString()),
  getPreferences: () => request('GET', '/api/preferences'),
  updatePreferences: (p) => request('PUT', '/api/preferences', p),
  preserve: (id, mode) => request('POST', `/api/bookmarks/${id}/preserve`, { mode }),
  importFile: (html) => request('POST', '/api/import', html, true),
};
