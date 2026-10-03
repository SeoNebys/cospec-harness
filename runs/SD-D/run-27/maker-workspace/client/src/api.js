// Thin fetch wrappers around the JSON API.
async function req(method, url, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const resp = await fetch(url, opts);
  const ct = resp.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await resp.json() : await resp.text();
  if (!resp.ok) {
    const message = data && data.error ? data.error.message : `Request failed (${resp.status})`;
    const err = new Error(message);
    err.status = resp.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  listBookmarks(params) {
    const qs = new URLSearchParams(params).toString();
    return req('GET', `/api/bookmarks?${qs}`);
  },
  getBookmark(id) { return req('GET', `/api/bookmarks/${id}`); },
  previewBookmark(url) { return req('POST', '/api/bookmarks/preview', { url }); },
  createBookmark(body) { return req('POST', '/api/bookmarks', body); },
  updateBookmark(id, body) { return req('PATCH', `/api/bookmarks/${id}`, body); },
  deleteBookmark(id) { return req('DELETE', `/api/bookmarks/${id}`); },
  retryMetadata(id) { return req('POST', `/api/bookmarks/${id}/retry-metadata`); },
  bulk(body) { return req('POST', '/api/bookmarks/bulk', body); },
  preserve(id, body) { return req('POST', `/api/bookmarks/${id}/preserve`, body); },
  tags(prefix = '') { return req('GET', `/api/tags?prefix=${encodeURIComponent(prefix)}`); },
  savedSearches() { return req('GET', '/api/saved-searches'); },
  saveSearch(body) { return req('POST', '/api/saved-searches', body); },
  updateSavedSearch(id, body) { return req('PATCH', `/api/saved-searches/${id}`, body); },
  deleteSavedSearch(id) { return req('DELETE', `/api/saved-searches/${id}`); },
  getPreferences() { return req('GET', '/api/preferences'); },
  putPreferences(body) { return req('PUT', '/api/preferences', body); }
};
