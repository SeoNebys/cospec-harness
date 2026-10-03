import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSearch } from '../src/query.js';

const items = [
  { title: 'Rome travel guide', description: 'Best trip in Italy', note: 'summer', url: 'http://a.com/rome', tags: ['travel', 'article'] },
  { title: 'Rome history book', description: 'ancient rome', note: '', url: 'http://b.com', tags: ['book', 'history'] },
  { title: 'Paris news', description: 'daily', note: 'read me', url: 'http://c.com', tags: ['news', 'travel'] },
  { title: 'AND circuits', description: 'logic gates', note: '', url: 'http://d.com', tags: ['newsletter'] },
];
const run = (q) => items.filter(buildSearch(q).pred).map((b) => b.title).sort();

test('plain search is case-insensitive substring across fields (SCN-006)', () => {
  assert.deepEqual(run('rome'), ['Rome history book', 'Rome travel guide']);
  assert.deepEqual(run('Rome'), ['Rome history book', 'Rome travel guide']);
  assert.deepEqual(run('read'), ['Paris news']); // matches note
  assert.deepEqual(run('nonsense'), []);
});

test('#tag is exact (SCN-007)', () => {
  assert.deepEqual(run('#news'), ['Paris news']);
  assert.deepEqual(run('news').sort(), ['AND circuits', 'Paris news']); // plain text is partial
});

test('implicit AND, OR, NOT, parentheses (SCN-007)', () => {
  assert.deepEqual(run('rome #travel'), ['Rome travel guide']);
  assert.deepEqual(run('rome AND #travel'), ['Rome travel guide']);
  assert.deepEqual(run('#book OR #news'), ['Paris news', 'Rome history book']);
  assert.deepEqual(run('rome (#article OR #book)'), ['Rome history book', 'Rome travel guide']);
  assert.deepEqual(run('rome NOT #travel'), ['Rome history book']);
});

test('quoted phrase and quoted operator as text (SCN-007)', () => {
  assert.deepEqual(run('"ancient rome"'), ['Rome history book']);
  assert.deepEqual(run('"AND"'), ['AND circuits']); // literal word, not the operator
});

test('empty query is inactive', () => {
  const s = buildSearch('');
  assert.equal(s.active, false);
  assert.equal(items.every(s.pred), true);
});
