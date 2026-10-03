'use strict';
const test = require('node:test');
const assert = require('node:assert');
const Q = require('../../public/lib/search.js');

function bm(over) {
  return Object.assign({ title: '', description: '', tags: [], note: '', siteName: '', url: '' }, over);
}

test('ordinary words all must match (SCN-008)', () => {
  const b = bm({ title: 'CSS Grid Layout', description: 'columns' });
  assert.strictEqual(Q.matches('css layout', b), true);
  assert.strictEqual(Q.matches('css missing', b), false);
});

test('exact phrase (SCN-008)', () => {
  const b = bm({ title: 'Progressive Disclosure article' });
  assert.strictEqual(Q.matches('"progressive disclosure"', b), true);
  assert.strictEqual(Q.matches('"disclosure progressive"', b), false);
});

test('#tag matches a whole tag exactly, not text (SCN-008)', () => {
  const withTag = bm({ tags: ['reference'] });
  const textOnly = bm({ description: 'a reference to something' });
  assert.strictEqual(Q.matches('#reference', withTag), true);
  assert.strictEqual(Q.matches('#reference', textOnly), false);
  assert.strictEqual(Q.matches('#ref', withTag), false); // exact, not prefix
});

test('boolean operators and precedence NOT>AND>OR (SCN-008)', () => {
  const mdn = bm({ title: 'grid', tags: ['css', 'web'] });
  const nng = bm({ title: 'disclosure', tags: ['ux', 'web'] });
  assert.strictEqual(Q.matches('grid OR disclosure', mdn), true);
  assert.strictEqual(Q.matches('web AND (css OR ux)', mdn), true);
  assert.strictEqual(Q.matches('web NOT css', mdn), false);
  assert.strictEqual(Q.matches('web NOT css', nng), true);
});

test('operator word is literal when quoted (SCN-008)', () => {
  const andWord = bm({ description: 'salt and pepper' });
  assert.strictEqual(Q.matches('"and"', andWord), true);
});

test('empty query matches everything', () => {
  assert.strictEqual(Q.matches('', bm({})), true);
  assert.strictEqual(Q.matches('   ', bm({})), true);
});

test('highlightTerms collects positive text terms only', () => {
  const terms = Q.highlightTerms('grid NOT css OR "web layout"');
  assert.ok(terms.indexOf('grid') >= 0);
  assert.ok(terms.indexOf('web layout') >= 0);
  assert.ok(terms.indexOf('css') < 0);
});
