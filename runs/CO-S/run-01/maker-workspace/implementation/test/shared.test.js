// Unit tests for the shared pure logic. These also stand in as the acceptance
// tests for SCN-002 (search) and SCN-003 (tag browse), whose behaviour lives in
// filterBookmarks/matchesQuery/deriveTags and runs identically in the browser.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const BM = require('../src/shared');

test('looksLikeUrl accepts real links and rejects non-links (SCN-006)', () => {
  assert.equal(BM.looksLikeUrl('example.com'), true);
  assert.equal(BM.looksLikeUrl('https://a.b/c?x=1'), true);
  assert.equal(BM.looksLikeUrl('nytimes.com/2026/travel/kyoto-guide'), true);
  assert.equal(BM.looksLikeUrl('grocery list'), false);
  assert.equal(BM.looksLikeUrl('hello'), false);
  assert.equal(BM.looksLikeUrl(''), false);
});

test('normalizeUrl adds a scheme when missing', () => {
  assert.equal(BM.normalizeUrl('example.com'), 'https://example.com');
  assert.equal(BM.normalizeUrl('http://x.com'), 'http://x.com');
});

test('canonicalUrl ignores scheme, www and trailing slash (SCN-006 dedup)', () => {
  const a = BM.canonicalUrl('https://www.NYTimes.com/A/');
  const b = BM.canonicalUrl('http://nytimes.com/A');
  assert.equal(a, b);
  assert.equal(a, 'nytimes.com/a');
});

test('extractTitle pulls and decodes the page title (SCN-001)', () => {
  assert.equal(BM.extractTitle('<html><title>Hello &amp; Bye</title></html>'), 'Hello & Bye');
  assert.equal(BM.extractTitle('<title>  spaced\n title </title>'), 'spaced title');
  assert.equal(BM.extractTitle('<title>&#39;quote&#39;</title>'), "'quote'");
});

test('extractTitle returns null when there is no usable title (SCN-006)', () => {
  assert.equal(BM.extractTitle('<html>no title here</html>'), null);
  assert.equal(BM.extractTitle('<title></title>'), null);
  assert.equal(BM.extractTitle(''), null);
});

test('matchesQuery matches title OR host, case-insensitive (SCN-002)', () => {
  const b = { title: 'A 3-Day Guide to Kyoto', host: 'nytimes.com' };
  assert.equal(BM.matchesQuery(b, 'kyoto'), true);   // by title
  assert.equal(BM.matchesQuery(b, 'NYTIMES'), true); // by host
  assert.equal(BM.matchesQuery(b, 'github'), false);
  assert.equal(BM.matchesQuery(b, ''), true);        // empty = everything
});

test('filterBookmarks applies tag filter and search together (SCN-002 + SCN-003)', () => {
  const list = [
    { title: 'Kyoto guide', host: 'nytimes.com', tags: ['Travel', 'Japan'] },
    { title: 'Lisbon weekend', host: 'lonelyplanet.com', tags: ['Travel'] },
    { title: 'CSS Grid', host: 'css-tricks.com', tags: ['Web Dev'] }
  ];
  assert.equal(BM.filterBookmarks(list, { tag: 'Travel' }).length, 2);
  assert.equal(BM.filterBookmarks(list, { tag: 'Japan' }).length, 1);
  const both = BM.filterBookmarks(list, { tag: 'Travel', query: 'kyoto' });
  assert.equal(both.length, 1);
  assert.equal(both[0].title, 'Kyoto guide');
});

test('deriveTags lists tags in use with counts, sorted (SCN-003)', () => {
  const list = [
    { tags: ['Travel', 'Japan'] },
    { tags: ['Travel'] },
    { tags: [] }
  ];
  const tags = BM.deriveTags(list);
  assert.deepEqual(tags, [
    { tag: 'Japan', count: 1 },
    { tag: 'Travel', count: 2 }
  ]);
});
