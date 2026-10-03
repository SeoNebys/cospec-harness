// Import/export round-trip in standard bookmark HTML (SCN-021).
const test = require('node:test');
const assert = require('node:assert');
const { generate, parse } = require('../lib/bookmarksHtml');

test('parse preserves title, tags, date and note', () => {
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p>
    <DT><A HREF="https://a.example/p" ADD_DATE="1600000000" TAGS="reading,history">Alpha</A>
    <DD>Note about alpha
    <DT><A HREF="https://b.example/" ADD_DATE="1700000000">Beta</A>
  </DL><p>`;
  const items = parse(html);
  assert.strictEqual(items.length, 2);
  assert.strictEqual(items[0].title, 'Alpha');
  assert.deepStrictEqual(items[0].tags, ['reading', 'history']);
  assert.strictEqual(items[0].createdAt, 1600000000 * 1000);
  assert.strictEqual(items[0].note, 'Note about alpha');
  assert.deepStrictEqual(items[1].tags, []);
});

test('non-http links are ignored on import', () => {
  const items = parse('<A HREF="javascript:alert(1)">x</A><A HREF="https://ok.example">ok</A>');
  assert.strictEqual(items.length, 1);
  assert.strictEqual(items[0].url, 'https://ok.example');
});

test('generate then parse round-trips core fields', () => {
  const bm = [{ url: 'https://c.example/x', title: 'Cee', tags: ['t1', 't2'], note: 'hi', createdAt: 1650000000 * 1000 }];
  const round = parse(generate(bm));
  assert.strictEqual(round[0].url, 'https://c.example/x');
  assert.strictEqual(round[0].title, 'Cee');
  assert.deepStrictEqual(round[0].tags, ['t1', 't2']);
  assert.strictEqual(round[0].note, 'hi');
  assert.strictEqual(round[0].createdAt, 1650000000 * 1000);
});

test('export escapes HTML-special characters', () => {
  const out = generate([{ url: 'https://x/?a=1&b=2', title: 'A & <b>', tags: [], note: '', createdAt: Date.now() }]);
  assert.match(out, /A &amp; &lt;b&gt;/);
  assert.match(out, /a=1&amp;b=2/);
});
