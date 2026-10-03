// T033 [US5]: search query language — every worked example from the contract.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { search } from '../../src/server/services/search.js';

const bm = (over) => ({ title: '', description: '', note: '', url: '', tags: [], ...over });

const data = [
  bm({ title: 'Best recipes', url: 'http://cook.example/recipes', tags: ['food'] }),
  bm({ title: 'Work invoice', note: 'quarterly invoice details', tags: ['work'] }),
  bm({ title: 'Reading list', tags: ['reading', 'work'] }),
  bm({ title: 'Rust book', description: 'learn rust', tags: ['reading'] }),
  bm({ title: 'Python guide', description: 'python basics', tags: ['reading'] }),
  bm({ title: 'Logic AND gates', description: 'about AND OR NOT' }),
  bm({ title: 'Machine learning intro', description: 'a machine learning overview' }),
];

const titles = (q) => search(data, q).map((b) => b.title).sort();

test('bare word matches title/description/note/url (case-insensitive)', () => {
  assert.deepEqual(titles('recipes'), ['Best recipes']);
  assert.deepEqual(titles('RUST'), ['Rust book']);
});

test('#tag restricts to tagged bookmarks', () => {
  assert.deepEqual(titles('#food'), ['Best recipes']);
});

test('text combined with #tag narrows by BOTH conditions', () => {
  // "invoice" text AND tag work → only "Work invoice"
  assert.deepEqual(titles('invoice #work'), ['Work invoice']);
});

test('quoted phrase matches exactly', () => {
  assert.deepEqual(titles('"machine learning"'), ['Machine learning intro']);
});

test('a quoted operator word is literal text, not an operator', () => {
  // "AND" as literal appears in the Logic AND gates bookmark text only
  assert.deepEqual(titles('"AND"'), ['Logic AND gates']);
});

test('OR widens', () => {
  assert.deepEqual(titles('python OR rust'), ['Python guide', 'Rust book']);
});

test('NOT negates; #reading NOT #work', () => {
  assert.deepEqual(titles('#reading NOT #work'), ['Python guide', 'Rust book']);
});

test('parentheses group precedence: (a OR b) c', () => {
  const set = [
    bm({ title: 'AC', description: 'a c' }),
    bm({ title: 'BC', description: 'b c' }),
    bm({ title: 'A only', description: 'a' }),
    bm({ title: 'C only', description: 'c' }),
  ];
  const got = search(set, '(a OR b) c').map((b) => b.title).sort();
  assert.deepEqual(got, ['AC', 'BC']);
});

test('empty query matches everything', () => {
  assert.equal(search(data, '').length, data.length);
});
