const test = require('node:test');
const assert = require('node:assert');
const { parseQuery, termsFromQuery } = require('../../lib/search');

const B = [
  { url: 'https://developer.mozilla.org/grid', title: 'CSS grid layout', description: 'guide', note: '', tags: ['css', 'read-later'] },
  { url: 'https://figma.com', title: 'Figma', description: 'design tool', note: 'note about DESIGN', tags: ['design', 'tools'] }
];
const run = q => { const c = parseQuery(q); return c.ok ? B.filter(c.pred).map(b => b.title) : 'INVALID'; };

test('empty query matches all', () => assert.deepEqual(run(''), ['CSS grid layout', 'Figma']));
test('case-insensitive term (SCN-003)', () => assert.deepEqual(run('CSS'), ['CSS grid layout']));
test('searches notes too (SCN-003)', () => assert.deepEqual(run('DESIGN'), ['Figma']));
test('#tag token (SCN-005)', () => assert.deepEqual(run('#read-later'), ['CSS grid layout']));
test('exact phrase', () => assert.deepEqual(run('"grid layout"'), ['CSS grid layout']));
test('AND combines', () => assert.deepEqual(run('grid AND #css'), ['CSS grid layout']));
test('OR combines', () => assert.deepEqual(run('"grid layout" OR figma'), ['CSS grid layout', 'Figma']));
test('NOT excludes by tag', () => assert.deepEqual(run('design NOT #tools'), []));
test('grouping with parentheses', () => assert.deepEqual(run('(css OR design) NOT #tools'), ['CSS grid layout']));
test('operators literal inside quotes', () => {
  const c = parseQuery('"cats and dogs"');
  assert.equal(c.ok, true);
});
test('incomplete query flagged, not guessed', () => assert.equal(run('(css'), 'INVALID'));
test('termsFromQuery returns only text terms', () => {
  assert.deepEqual(termsFromQuery('grid AND #css "layout"'), ['grid', 'layout']);
});
