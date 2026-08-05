// Service worker: reaches the web on the library's behalf (DD-002, option A).
// - fetchMeta: read a page's name/description (SCN-001/004, YouTube via oEmbed).
// - captureCopy: keep a saved copy of the page (SCN-016) — a readable copy, or
//   the actual PDF file (SCN-017) — stored locally; best-effort, labelled honestly.

import { parseMetadata } from './src/metadata.js';
import { extractReadable } from './src/reader.js';
import { oembedEndpoint, toFullUrl } from './src/core.js';
import { allLinks, putLink, putCopy } from './src/db.js';

async function fetchMeta(raw) {
  const url = toFullUrl(raw);
  const oe = oembedEndpoint(url);
  if (oe) {
    try {
      const r = await fetch(oe);
      if (r.ok) { const j = await r.json(); if (j && j.title) return { ok: true, title: j.title, description: j.author_name ? 'by ' + j.author_name : '', kind: 'web' }; }
    } catch { /* fall through */ }
  }
  try {
    const res = await fetch(url, { redirect: 'follow', credentials: 'omit' });
    if (!res.ok) return { ok: false, error: 'status ' + res.status };
    const ctype = res.headers.get('content-type') || '';
    if (ctype.includes('application/pdf')) return { ok: true, title: '', description: '', kind: 'pdf' };
    const html = await res.text();
    const meta = parseMetadata(html);
    return { ok: meta.ok, title: meta.title, description: meta.description, kind: 'web' };
  } catch (e) { return { ok: false, error: String(e) }; }
}

async function stampLinkCopy(linkId, meta) {
  const links = await allLinks();
  const l = links.find((x) => x.id === linkId);
  if (l) { l.copy = meta; await putLink(l); }
}

// SCN-016: keep a copy of the page as it is now. Never throws — worst case a
// "failed" copy is recorded so the card can say so honestly.
async function captureCopy(linkId, raw) {
  const url = toFullUrl(raw);
  const capturedAt = Date.now();
  try {
    const res = await fetch(url, { redirect: 'follow', credentials: 'omit' });
    const ctype = (res.headers.get('content-type') || '').toLowerCase();
    if (!res.ok) throw new Error('status ' + res.status);

    if (ctype.includes('application/pdf') || /\.pdf($|\?)/i.test(url)) {
      const blob = await res.blob(); // SCN-017: the actual document, kept whole
      await putCopy({ linkId, kind: 'pdf', blob, size: blob.size, partial: false, capturedAt });
      const meta = { kind: 'pdf', partial: false, capturedAt, size: blob.size };
      await stampLinkCopy(linkId, meta); return { ok: true, ...meta };
    }
    const html = await res.text();
    const r = extractReadable(html, url);
    const kind = r.partial ? 'partial' : 'reader';
    await putCopy({ linkId, kind, title: r.title, html: r.html, partial: r.partial, capturedAt });
    const meta = { kind, partial: r.partial, capturedAt };
    await stampLinkCopy(linkId, meta); return { ok: true, ...meta };
  } catch (e) {
    const meta = { kind: 'failed', partial: true, capturedAt, error: String(e) };
    await putCopy({ linkId, ...meta });
    await stampLinkCopy(linkId, meta);
    return { ok: false, ...meta };
  }
}

// SCN-017: opt-in public archive — ask an independent public web archive to keep
// a copy. Fire-and-forget; the library records the view URL.
async function publicArchive(url) {
  try { await fetch('https://web.archive.org/save/' + url, { method: 'GET', mode: 'no-cors' }); } catch { /* best-effort */ }
  return { ok: true, viewUrl: 'https://web.archive.org/web/2/' + url };
}

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg && msg.type === 'fetchMeta' && msg.url) { fetchMeta(msg.url).then(reply); return true; }
  if (msg && msg.type === 'publicArchive' && msg.url) { publicArchive(msg.url).then(reply); return true; }
  if (msg && msg.type === 'captureCopy' && msg.linkId != null) {
    captureCopy(msg.linkId, msg.url).then((res) => {
      try { chrome.runtime.sendMessage({ type: 'copyDone', linkId: msg.linkId }); } catch { /* no listener */ }
      reply(res);
    });
    return true;
  }
  return false;
});
