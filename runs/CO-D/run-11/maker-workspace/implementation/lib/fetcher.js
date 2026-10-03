// Small fetch helpers with timeout, using the global fetch (Node >= 18).
'use strict';

function fetchWithTimeout(url, opts, ms) {
  opts = opts || {};
  ms = ms || 12000;
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, ms);
  var headers = Object.assign({
    'User-Agent': 'Mozilla/5.0 (compatible; BookmarksApp/1.0; +local)'
  }, opts.headers || {});
  return fetch(url, Object.assign({}, opts, { signal: ctrl.signal, headers: headers, redirect: 'follow' }))
    .finally(function () { clearTimeout(timer); });
}

async function fetchText(url, ms) {
  var res = await fetchWithTimeout(url, {}, ms);
  var ct = res.headers.get('content-type') || '';
  var buf = Buffer.from(await res.arrayBuffer());
  return { ok: res.ok, status: res.status, contentType: ct, body: buf.toString('utf8'), buffer: buf };
}

async function fetchBinary(url, ms) {
  var res = await fetchWithTimeout(url, {}, ms);
  var ct = res.headers.get('content-type') || '';
  var buf = Buffer.from(await res.arrayBuffer());
  return { ok: res.ok, status: res.status, contentType: ct, buffer: buf };
}

module.exports = { fetchWithTimeout: fetchWithTimeout, fetchText: fetchText, fetchBinary: fetchBinary };
