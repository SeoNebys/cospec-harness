// Build a single self-contained HTML snapshot of a page, or store a PDF.
'use strict';
var fetcher = require('./fetcher');
var urls = require('./urls');

function absolutize(html, base) {
  // Make href/src absolute so a saved file still resolves links/anchors.
  return html;
}

async function inlineAsset(url, cap) {
  try {
    var r = await fetcher.fetchBinary(url, 8000);
    if (!r.ok || r.buffer.length > cap) return null;
    var ct = (r.contentType || '').split(';')[0] || 'application/octet-stream';
    return 'data:' + ct + ';base64,' + r.buffer.toString('base64');
  } catch (e) { return null; }
}

// Returns { kind:'page', html } or { kind:'pdf', buffer } or throws on failure.
async function capture(url) {
  if (urls.isPdf(url)) {
    var pdf = await fetcher.fetchBinary(url, 20000);
    if (!pdf.ok) throw new Error('Could not download the PDF (status ' + pdf.status + ').');
    return { kind: 'pdf', buffer: pdf.buffer };
  }
  var page = await fetcher.fetchText(url, 15000);
  if (!page.ok) throw new Error('Could not fetch the page (status ' + page.status + ').');
  var ct = (page.contentType || '').toLowerCase();
  if (ct.indexOf('application/pdf') >= 0) {
    return { kind: 'pdf', buffer: page.buffer };
  }
  var html = page.body;

  // Inline external stylesheets as <style> blocks.
  var linkRe = /<link\b[^>]*rel\s*=\s*["']?stylesheet["']?[^>]*>/gi;
  var links = html.match(linkRe) || [];
  for (var i = 0; i < links.length && i < 20; i++) {
    var tag = links[i];
    var hm = tag.match(/href\s*=\s*["']([^"']+)["']/i);
    if (!hm) continue;
    var abs;
    try { abs = new URL(hm[1], url).href; } catch (e) { continue; }
    try {
      var css = await fetcher.fetchText(abs, 8000);
      if (css.ok) html = html.replace(tag, '<style>\n' + css.body + '\n</style>');
    } catch (e) { /* leave the link as-is */ }
  }

  // Inline <img src> as data URIs (bounded count/size to keep the file sane).
  var imgRe = /<img\b[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/gi;
  var seen = {}, mimg, jobs = [];
  while ((mimg = imgRe.exec(html)) !== null) {
    var src = mimg[1];
    if (/^data:/i.test(src) || seen[src]) continue;
    seen[src] = true; jobs.push(src);
    if (jobs.length >= 40) break;
  }
  for (var j = 0; j < jobs.length; j++) {
    var s = jobs[j], absi;
    try { absi = new URL(s, url).href; } catch (e) { continue; }
    var data = await inlineAsset(absi, 2 * 1024 * 1024);
    if (data) {
      html = html.split('"' + s + '"').join('"' + data + '"').split("'" + s + "'").join("'" + data + "'");
    }
  }

  // Add a <base> so any remaining relative links resolve to the original site,
  // and a banner marking this as a saved copy.
  var banner = '<div style="background:#4a3f00;color:#ffe9a8;padding:8px 14px;' +
    'font:13px system-ui,sans-serif;text-align:center;">Saved copy from your bookmark app — ' +
    'captured ' + new Date().toISOString().slice(0, 10) + '. Original: ' + url + '</div>';
  var baseTag = '<base href="' + url.replace(/"/g, '&quot;') + '">';
  if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, function (h) { return h + baseTag; });
  else html = baseTag + html;
  if (/<body[^>]*>/i.test(html)) html = html.replace(/<body[^>]*>/i, function (b) { return b + banner; });
  else html = banner + html;

  return { kind: 'page', html: html };
}

module.exports = { capture: capture };
