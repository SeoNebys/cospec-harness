// Saved-copy viewer (SCN-016/017). Opens a stored readable copy (in a
// script-free sandboxed frame) or the kept PDF. Reached at viewer.html?id=<linkId>.

import { allLinks, getCopy } from './src/db.js';
import { hostOf, toFullUrl } from './src/core.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const linkId = Number(params.get('id'));

function fmtDate(ts) {
  if (!ts) return '';
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return days + ' days ago';
  try { return new Date(ts).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return new Date(ts).toDateString(); }
}
const esc = (s) => String(s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

async function main() {
  const links = await allLinks();
  const link = links.find((l) => l.id === linkId);
  const copy = await getCopy(linkId);
  const title = (link && link.title) || (copy && copy.title) || 'Saved copy';
  $('t').textContent = title;
  if (link) { $('live').href = toFullUrl(link.url); }

  if (!copy) { $('msg').textContent = 'No saved copy was kept for this link.'; return; }
  $('s').textContent = `saved copy · ${copy.kind === 'pdf' ? 'PDF' : copy.kind === 'partial' ? 'partial' : copy.kind === 'failed' ? 'not captured' : 'readable'} · from ${fmtDate(copy.capturedAt)}`;

  if (copy.partial || copy.kind === 'failed') {
    $('note').style.display = 'block';
    $('note').textContent = copy.kind === 'failed'
      ? 'We couldn’t capture a copy of this page (it may be behind a login or blocks copying). Your link is safe — try the live page.'
      : 'Heads up: only part of this page could be captured (it may be behind a login or paywall). Here’s what we got.';
  }

  const wrap = $('wrap');
  if (copy.kind === 'pdf' && copy.blob) {
    const url = URL.createObjectURL(copy.blob);
    wrap.innerHTML = `<iframe src="${url}" title="${esc(title)}"></iframe>`;
    return;
  }
  if (copy.html) {
    const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank">
      <style>body{font-family:Georgia,'Times New Roman',serif;line-height:1.7;color:#1f2937;max-width:720px;margin:0 auto;padding:32px 40px;background:#fff}
      h1,h2,h3{font-family:system-ui,sans-serif;line-height:1.3} img{max-width:100%;height:auto;border-radius:6px} a{color:#2563eb}
      pre,code{font-family:ui-monospace,Menlo,monospace;background:#f3f4f6;border-radius:4px}</style></head>
      <body><h1>${esc(title)}</h1>${copy.html}</body></html>`;
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', ''); // no scripts run from the saved page
    iframe.setAttribute('title', title);
    iframe.srcdoc = doc;
    wrap.innerHTML = '';
    wrap.appendChild(iframe);
    return;
  }
  $('msg').textContent = 'This saved copy is empty.';
}

main();
