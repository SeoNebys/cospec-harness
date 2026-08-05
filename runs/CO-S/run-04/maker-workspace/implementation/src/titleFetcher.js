'use strict';

const { withScheme, extractTitle } = require('./links');

// SCN-001/006: fetch a page and extract its <title>, server-side (a browser
// cannot read another site's title due to cross-origin rules).
//
// Returns the page name as a string, or null when the name cannot be found for
// ANY reason (network error, timeout, non-HTML response, no <title>). The
// caller treats null as "use the fallback + nudge" — never as a hard error.
async function fetchTitle(url, { timeoutMs = 6000, maxBytes = 512 * 1024 } = {}) {
  const target = withScheme(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(target, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'BookmarksApp/1.0 (+local)' },
    });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml/i.test(type)) return null;

    // Read only enough bytes to find the <title>; pages can be large.
    const reader = res.body && res.body.getReader ? res.body.getReader() : null;
    let html = '';
    if (reader) {
      const decoder = new TextDecoder('utf-8');
      let received = 0;
      while (received < maxBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.length;
        html += decoder.decode(value, { stream: true });
        if (/<\/title>/i.test(html)) break; // got what we need
      }
      try { await reader.cancel(); } catch (e) { /* ignore */ }
    } else {
      html = await res.text();
    }
    return extractTitle(html);
  } catch (e) {
    return null; // any failure -> no name found -> fallback path
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchTitle };
