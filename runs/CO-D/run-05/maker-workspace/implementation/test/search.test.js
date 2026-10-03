// Unit tests for the search query language (SCN-008, SCN-009).
const test = require('node:test');
const assert = require('node:assert');
const { compile } = require('../lib/search');

const B = [
  { title: 'Rome travel guide', url: 'http://x.com/rome', desc: 'ancient city', note: 'plan trip', tags: ['article', 'travel'] },
  { title: 'Rome history book', url: 'http://y.com', desc: 'empire', note: '', tags: ['book'] },
  { title: 'Paris cafes', url: 'http://z.com', desc: 'coffee', note: 'rome mentioned', tags: ['article'] },
];
const run = (q) => B.map((b, i) => (compile(q)(b) ? i : null)).filter(x => x !== null);

test('plain word is case-insensitive across title/url/desc/note', () => {
  assert.deepStrictEqual(run('ROME'), [0, 1, 2]);
  assert.deepStrictEqual(run('empire'), [1]);
});
test('exact phrase in quotes', () => {
  assert.deepStrictEqual(run('"ancient city"'), [0]);
});
test('tag term matches exact tag only', () => {
  assert.deepStrictEqual(run('#book'), [1]);
});
test('grouped tags with implicit AND on a bare word', () => {
  assert.deepStrictEqual(run('rome (#article OR #book)'), [0, 1, 2]);
});
test('NOT excludes', () => {
  assert.deepStrictEqual(run('rome NOT #article'), [1]);
});
test('operators are case-insensitive when bare', () => {
  assert.deepStrictEqual(run('rome (#article or #book)'), run('rome (#article OR #book)'));
  assert.deepStrictEqual(run('rome not #article'), run('rome NOT #article'));
});
test('a quoted operator word is a literal term, not an operator', () => {
  // "or" is treated as literal text: matches "hist(or)y" in bookmark 1, not as the OR operator.
  assert.deepStrictEqual(run('"or"'), [1]);
  assert.deepStrictEqual(run('"coffee"'), [2]);
});
test('empty query matches everything', () => {
  assert.deepStrictEqual(run(''), [0, 1, 2]);
});
test('unreadable query throws', () => {
  assert.throws(() => compile('rome (#article'));
  assert.throws(() => compile('"unterminated'));
});
