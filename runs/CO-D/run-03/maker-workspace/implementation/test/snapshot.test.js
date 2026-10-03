'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { snapshot } = require('../src/lib/snapshot');

// Mock resource fetcher over a fixed map.
function mockFetcher(map) {
  return async (url) => {
    if (url in map) { const m = map[url]; return { ok: true, contentType: m.ct, buffer: Buffer.from(m.body) }; }
    return { ok: false };
  };
}

test('inlines stylesheet, its @import and url(), images, and removes scripts/base', async () => {
  const base = 'https://live.example.com/page.html';
  const map = {
    'https://live.example.com/s.css': { ct: 'text/css', body: `@import "/more.css"; body{background:url("/bg.png")}` },
    'https://live.example.com/more.css': { ct: 'text/css', body: `.x{color:red}` },
    'https://live.example.com/bg.png': { ct: 'image/png', body: 'PNGBG' },
    'https://live.example.com/pic.png': { ct: 'image/png', body: 'PNGPIC' }
  };
  const html = `<!doctype html><html><head>
    <base href="https://live.example.com/">
    <link rel="stylesheet" href="/s.css">
    <script src="/app.js"></script>
    <style>.y{background:url('/bg.png')}</style>
  </head><body>
    <script>window.x=1</script>
    <img src="/pic.png" srcset="/pic-2x.png 2x">
    <div style="background:url('/bg.png')"></div>
  </body></html>`;

  const out = await snapshot(html, base, mockFetcher(map));

  assert.ok(!/<script/i.test(out), 'scripts removed');
  assert.ok(!/<base/i.test(out), 'base removed');
  assert.ok(!/<link\b/i.test(out), 'stylesheet link replaced');
  assert.ok(!/srcset/i.test(out), 'srcset stripped');
  assert.ok(out.includes('.x{color:red}'), '@import inlined');
  // image + css url become data URIs; no live http refs remain for these assets
  assert.ok(out.includes('data:image/png;base64,' + Buffer.from('PNGPIC').toString('base64')), 'img inlined as data URI');
  assert.ok(out.includes('data:image/png;base64,' + Buffer.from('PNGBG').toString('base64')), 'css background inlined');
  assert.ok(!/https:\/\/live\.example\.com\/(s\.css|pic\.png|bg\.png)/.test(out), 'no live refs to inlined assets remain');
});

test('unfetchable assets are left as-is rather than failing the whole copy', async () => {
  const out = await snapshot(
    `<img src="https://gone.example/x.png"><p>hi</p>`,
    'https://gone.example/p', mockFetcher({})
  );
  assert.ok(out.includes('<p>hi</p>'), 'document still produced');
});
