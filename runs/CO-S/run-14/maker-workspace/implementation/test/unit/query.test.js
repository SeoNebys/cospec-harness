'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { buildMatcher } = require('../../src/query');

const bms = [
  { title: 'React — Learn', description: 'components hooks', note: '', site: 'React', url: 'https://react.dev/learn', tags: ['dev', 'reference'] },
  { title: 'Kinfolk — Slow Living', description: 'essays on slowing down', note: 'weekend', site: 'Kinfolk', url: 'https://kinfolk.com/slow-living', tags: ['reading', 'design'] },
  { title: 'A Field Guide to Getting Lost', description: 'Rebecca Solnit on wandering', note: '', site: 'Longreads', url: 'https://longreads.com/field-guide', tags: ['reading', 'essays'] },
  { title: 'CSS Grid Guide', description: 'grid layout', note: '', site: 'CSS-Tricks', url: 'https://css-tricks.com/grid', tags: ['dev', 'reference'] },
];
function run(q) { const m = buildMatcher(q); return { ok: m.ok, titles: bms.filter(m.test).map(b => b.title) }; }

test('bare word matches across fields case-insensitively (SCN-007)', () => {
  assert.deepStrictEqual(run('SOLNIT').titles, ['A Field Guide to Getting Lost']);
});
test('URL match', () => {
  assert.deepStrictEqual(run('react.dev').titles, ['React — Learn']);
});
test('#tag restricts to that exact tag', () => {
  assert.deepStrictEqual(run('#reading').titles.sort(), ['A Field Guide to Getting Lost', 'Kinfolk — Slow Living']);
});
test('quoted phrase', () => {
  assert.deepStrictEqual(run('"slow living"').titles, ['Kinfolk — Slow Living']);
});
test('AND requires both', () => {
  assert.deepStrictEqual(run('#dev AND #reference').titles.sort(), ['CSS Grid Guide', 'React — Learn']);
});
test('OR matches either', () => {
  assert.deepStrictEqual(run('#reading OR #essays').titles.sort(), ['A Field Guide to Getting Lost', 'Kinfolk — Slow Living']);
});
test('NOT with parentheses groups correctly', () => {
  assert.deepStrictEqual(run('(#reading OR #essays) NOT #design').titles, ['A Field Guide to Getting Lost']);
});
test('malformed query falls back to plain text (ok:false)', () => {
  const r = run('(dev OR');
  assert.strictEqual(r.ok, false);
  // "(dev OR" as plain text matches nothing here
  assert.deepStrictEqual(r.titles, []);
});
test('empty query matches all', () => {
  assert.strictEqual(buildMatcher('').ok, true);
  assert.strictEqual(bms.filter(buildMatcher('  ').test).length, bms.length);
});
