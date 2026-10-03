import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findExternalResources } from '../../src/server/services/preserve.js';

test('detects external image, stylesheet, and css url() references', () => {
  const html = `
    <html><head>
      <link rel="stylesheet" href="https://cdn.example.com/site.css">
      <style>.hero{background:url("https://img.example.com/bg.jpg")} @font-face{src:url(https://f.example.com/font.woff2)}</style>
      <meta property="og:image" content="https://ok-to-ignore.example/og.png">
    </head><body>
      <img src="https://img.example.com/photo.png">
      <a href="https://not-a-resource.example/page">link</a>
    </body></html>`;
  const ext = findExternalResources(html);
  assert.ok(ext.includes('https://cdn.example.com/site.css'), 'stylesheet flagged');
  assert.ok(ext.includes('https://img.example.com/bg.jpg'), 'css background flagged');
  assert.ok(ext.includes('https://f.example.com/font.woff2'), 'font flagged');
  assert.ok(ext.includes('https://img.example.com/photo.png'), 'img flagged');
  // Anchors and meta/OG tags are not loaded subresources.
  assert.ok(!ext.some((u) => u.includes('not-a-resource')), 'anchor ignored');
  assert.ok(!ext.some((u) => u.includes('ok-to-ignore')), 'meta og:image ignored');
});

test('a fully-inlined document has no external resources (genuinely self-contained)', () => {
  const html = `
    <html><head>
      <style>.hero{background:url(data:image/png;base64,AAAA)}</style>
    </head><body>
      <img src="data:image/png;base64,BBBB">
    </body></html>`;
  assert.deepEqual(findExternalResources(html), []);
});

test('flags srcset with external candidates', () => {
  const html = '<img srcset="https://img.example.com/a.png 1x, https://img.example.com/b.png 2x">';
  const ext = findExternalResources(html);
  assert.equal(ext.length, 1);
  assert.match(ext[0], /^https:\/\/img\.example\.com\/a\.png/);
});
