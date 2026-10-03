// Real page access for title lookup (SCN-001) and safety-net snapshots (SCN-005).
// External network access may be unavailable; every function degrades gracefully
// and never throws to the caller.

const UA = 'Mozilla/5.0 (compatible; BookmarkKeeper/1.0)';
const TIMEOUT_MS = 8000;
const MAX_BYTES = 3 * 1024 * 1024;

async function fetchText(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal, redirect: 'follow' });
    if (!res.ok) return { ok: false, status: res.status };
    const reader = res.body?.getReader();
    if (!reader) {
      const text = await res.text();
      return { ok: true, text: text.slice(0, MAX_BYTES) };
    }
    let received = 0;
    const chunks = [];
    // Read up to MAX_BYTES so a huge page can't exhaust memory.
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      chunks.push(value);
      if (received >= MAX_BYTES) { ctrl.abort(); break; }
    }
    const buf = Buffer.concat(chunks.map(c => Buffer.from(c)));
    return { ok: true, text: buf.toString('utf8') };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  } finally {
    clearTimeout(timer);
  }
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

export function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return '';
  return decodeEntities(m[1]).replace(/\s+/g, ' ').trim();
}

// Reduce an HTML page to readable text for the kept copy.
export function extractReadableText(html) {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|section|article|h[1-6]|li|br)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return s;
}

// Returns { title } — empty string if it couldn't be fetched.
export async function lookupTitle(url) {
  const r = await fetchText(url);
  if (!r.ok || !r.text) return { title: '', ok: false };
  return { title: extractTitle(r.text), ok: true };
}

// Returns { ok, title, text } for storing a snapshot.
export async function capturePage(url) {
  const r = await fetchText(url);
  if (!r.ok || !r.text) return { ok: false, title: '', text: '' };
  return { ok: true, title: extractTitle(r.text), text: extractReadableText(r.text) };
}
