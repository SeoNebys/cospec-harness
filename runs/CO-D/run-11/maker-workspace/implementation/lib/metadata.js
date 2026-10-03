// Extract page metadata from raw HTML (no DOM dependency).
'use strict';
var urls = require('./urls');

function decode(s) {
  return String(s == null ? '' : s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#x27;/gi, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}
function metaContent(html, propNames) {
  for (var i = 0; i < propNames.length; i++) {
    var name = propNames[i];
    // property="og:title" content="..."  (either attribute order)
    var re1 = new RegExp('<meta[^>]*(?:name|property)\\s*=\\s*["\']' + name +
      '["\'][^>]*content\\s*=\\s*["\']([^"\']*)["\'][^>]*>', 'i');
    var re2 = new RegExp('<meta[^>]*content\\s*=\\s*["\']([^"\']*)["\'][^>]*(?:name|property)\\s*=\\s*["\']' +
      name + '["\'][^>]*>', 'i');
    var m = html.match(re1) || html.match(re2);
    if (m && m[1]) return decode(m[1]);
  }
  return '';
}

// Returns {title, description, icon, image} derived from html for the given url.
function extract(html, url) {
  html = html || '';
  var host = urls.hostOf(url);
  var title = metaContent(html, ['og:title', 'twitter:title']);
  if (!title) {
    var tm = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (tm) title = decode(tm[1].replace(/\s+/g, ' '));
  }
  if (!title) title = host.charAt(0).toUpperCase() + host.slice(1);
  var description = metaContent(html, ['og:description', 'twitter:description', 'description']);
  var image = metaContent(html, ['og:image', 'twitter:image', 'twitter:image:src']);
  if (image) { try { image = new URL(image, url).href; } catch (e) { } }
  var icon = 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(host) + '&sz=64';
  return { title: title, description: description, icon: icon, image: image };
}

// Fallback metadata when a page cannot be fetched or read.
function fallback(url) {
  var host = urls.hostOf(url);
  return {
    title: host.charAt(0).toUpperCase() + host.slice(1),
    description: '',
    icon: 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(host) + '&sz=64',
    image: ''
  };
}

module.exports = { extract: extract, fallback: fallback };
