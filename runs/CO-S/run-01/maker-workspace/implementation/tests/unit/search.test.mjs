import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildQuery } from '../../public/js/search.js';

const DATA = [
  { title: 'Array.prototype.map() - JavaScript | MDN', desc: 'map creates a new array', note: 'handy JS cheatsheet', url: 'https://developer.mozilla.org/map', tags: ['reference', 'javascript'] },
  { title: 'A Complete Guide to Flexbox', desc: 'CSS flexbox layout', note: '', url: 'https://css-tricks.com/flexbox', tags: ['reference', 'css'] },
  { title: 'Reading Habit', desc: 'routines beat plans', note: 'read on the weekend', url: 'https://nytimes.com/x', tags: ['articles', 'habits'] },
  { title: 'playwright', desc: 'end to end testing', note: '', url: 'https://github.com/microsoft/playwright', tags: ['tools', 'testing'] },
  { title: 'Chocolate Chip Cookies', desc: 'chewy recipe', note: 'try this weekend', url: 'https://seriouseats.com/cookies', tags: ['cooking', 'recipes'] },
  { title: 'Design Systems', desc: 'scalable systems', note: '', url: 'https://smashingmagazine.com/ds', tags: ['design', 'reference'] }
];

const run = (q) => DATA.filter(buildQuery(q));

test('SCN-003: single word matches across any field (note)', () => {
  assert.equal(run('weekend').length, 2);
});

test('SCN-003: case-insensitive', () => {
  assert.equal(run('REFERENCE').length, run('reference').length);
  assert.equal(run('reference').length, 3);
});

test('SCN-003: multiple words narrow (implicit AND)', () => {
  const r = run('reference css');
  assert.equal(r.length, 1);
  assert.match(r[0].title, /Flexbox/);
});

test('SCN-003: no matches', () => {
  assert.equal(run('zzznope').length, 0);
});

test('SCN-004: #tag whole-tag exact match', () => {
  assert.equal(run('#reference').length, 3);
  assert.equal(run('#css').length, 1);
  // substring of a tag must not match a #tag query
  assert.equal(run('#ref').length, 0);
});

test('SCN-004: exact phrase in quotes', () => {
  assert.equal(run('"chocolate chip"').length, 1);
  assert.equal(run('"chocolate testing"').length, 0);
});

test('SCN-004: boolean OR', () => {
  assert.equal(run('cooking OR testing').length, 2);
});

test('SCN-004: boolean NOT', () => {
  const r = run('#reference NOT css');
  assert.equal(r.length, 2);
  assert.ok(!r.some(b => b.tags.includes('css')));
});

test('SCN-004: grouping with parentheses', () => {
  assert.equal(run('(cooking OR testing) AND #tools').length, 1);
});

test('SCN-004: operator words are commands unless quoted', () => {
  // "and" as operator between two terms
  assert.equal(run('reference and css').length, 1);
});

test('SCN-004: forgiving of unfinished input', () => {
  assert.equal(run('(cooking OR').length, DATA.length === 6 ? run('cooking').length : 0);
  assert.equal(run('(').length, DATA.length); // lone paren -> matches all
  assert.equal(run('reference AND').length, run('reference').length);
});

test('empty query matches everything', () => {
  assert.equal(run('').length, DATA.length);
});
