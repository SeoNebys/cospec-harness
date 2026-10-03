// Thin fetch wrapper for the JSON API.

async function req(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  // bookmarks
  listBookmarks(params = {}) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === '') continue;
      if (Array.isArray(v)) v.forEach((x) => qs.append(k, x));
      else qs.append(k, v);
    }
    return req('GET', `/api/bookmarks?${qs.toString()}`);
  },
  getBookmark(id) {
    return req('GET', `/api/bookmarks/${id}`);
  },
  preview(url) {
    return req('POST', '/api/bookmarks/preview', { url });
  },
  createBookmark(payload) {
    return req('POST', '/api/bookmarks', payload);
  },
  updateBookmark(id, fields) {
    return req('PATCH', `/api/bookmarks/${id}`, fields);
  },
  deleteBookmark(id) {
    return req('DELETE', `/api/bookmarks/${id}`);
  },
  bulk(payload) {
    return req('POST', '/api/bookmarks/bulk', payload);
  },
  webArchive(id) {
    return req('POST', `/api/bookmarks/${id}/web-archive`, {});
  },
  snapshotUrl(id) {
    return `/api/bookmarks/${id}/snapshot`;
  },
  // tags
  tags(prefix) {
    return req('GET', `/api/tags${prefix ? `?prefix=${encodeURIComponent(prefix)}` : ''}`);
  },
  // filters
  filters() {
    return req('GET', '/api/filters');
  },
  createFilter(payload) {
    return req('POST', '/api/filters', payload);
  },
  updateFilter(id, payload) {
    return req('PATCH', `/api/filters/${id}`, payload);
  },
  deleteFilter(id) {
    return req('DELETE', `/api/filters/${id}`);
  },
  // preferences
  preferences() {
    return req('GET', '/api/preferences');
  },
  updatePreferences(payload) {
    return req('PUT', '/api/preferences', payload);
  },
  // import/export
  exportUrl() {
    return '/api/export';
  },
  async importFile(file) {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/import', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Import failed');
    return data;
  },
};
