// "Save this page" — one-click capture from the page the client is reading
// (DD-002 option A). SCN-001 + SCN-003, and SCN-016: it keeps the saved copy
// straight from the *live tab* (so logged-in pages capture faithfully), falling
// back to a background fetch if the page can't be read directly.

import { normalizeUrl, toFullUrl, hostOf, makeLink } from './src/core.js';
import { extractReadable } from './src/reader.js';
import { findByNorm, putLink, putCopy } from './src/db.js';

const $ = (id) => document.getElementById(id);
let tab = null;

async function init() {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  tab = active;
  const savable = tab && tab.url && /^https?:\/\//i.test(tab.url);
  $('t').textContent = savable ? (tab.title || hostOf(tab.url)) : 'This page can’t be saved';
  $('h').textContent = savable ? hostOf(tab.url) : '';
  $('save').disabled = !savable;
}

function showSaved(text, cls) { $('save').style.display = 'none'; const d = $('done'); d.className = 'done show ' + (cls || 'ok'); d.textContent = text; }

async function keepCopyFromTab(linkId) {
  const capturedAt = Date.now();
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => document.documentElement.outerHTML });
    const html = res && res.result;
    if (!html) throw new Error('no html');
    const r = extractReadable(html, tab.url);
    const kind = r.partial ? 'partial' : 'reader';
    await putCopy({ linkId, kind, title: r.title || tab.title, html: r.html, partial: r.partial, capturedAt });
    return { kind, partial: r.partial, capturedAt };
  } catch {
    // couldn't read the tab directly — let the background try a plain fetch
    try { chrome.runtime.sendMessage({ type: 'captureCopy', linkId, url: toFullUrl(tab.url) }); } catch { /* */ }
    return null;
  }
}

$('save').addEventListener('click', async () => {
  if (!tab) return;
  $('save').disabled = true;
  const dup = await findByNorm(normalizeUrl(tab.url)); // SCN-003
  if (dup) { showSaved('Already in your library — no duplicate made.', 'dup'); return; }
  const link = makeLink(toFullUrl(tab.url), { ok: !!tab.title, title: tab.title || '', description: '' }, Date.now());
  const id = await putLink(link);
  let keep = true; try { keep = localStorage.getItem('set.keepCopies') !== '0'; } catch { /* */ }
  if (keep) { const copyMeta = await keepCopyFromTab(id); if (copyMeta) { link.id = id; link.copy = copyMeta; await putLink(link); } } // SCN-016
  showSaved('✓ Saved to My Links', 'ok');
});

$('lib').addEventListener('click', () => chrome.runtime.openOptionsPage());

init();
