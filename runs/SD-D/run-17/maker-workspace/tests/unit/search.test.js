import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuery, evaluate, SearchError } from '../../src/services/search.js';

function bm(overrides) {
  return {
    title: '', url: '', description: '', note: '', tags: [], ...overrides,
  };
}
const match = (q, b) => evaluate(parseQuery(q), b);

test('bare word is case-insensitive across fields', () => {
  assert.equal(match('python', bm({ title: 'Learn PYTHON' })), true);
  assert.equal(match('PYTHON', bm({ description: 'a python guide' })), true);
  assert.equal(match('python', bm({ note: 'my Python notes' })), true);
  assert.equal(match('python', bm({ url: 'https://PyThOn.org' })), true);
  assert.equal(match('python', bm({ title: 'rust guide' })), false);
});

test('bare word / phrase also matches tag names', () => {
  assert.equal(match('news', bm({ tags: ['News'] })), true);
  assert.equal(match('"news"', bm({ tags: ['world-news'] })), true);
});

test('#tag matches tags only, exact (case-insensitive)', () => {
  assert.equal(match('#news', bm({ tags: ['News'] })), true);
  assert.equal(match('#news', bm({ tags: ['world-news'] })), false);
  assert.equal(match('#news', bm({ title: 'news of the day' })), false);
});

test('quoted phrase matches exact substring, not words separately', () => {
  assert.equal(match('"machine learning"', bm({ title: 'intro to machine learning' })), true);
  assert.equal(match('"machine learning"', bm({ title: 'machine and learning' })), false);
});

test('adjacent word and #tag imply AND', () => {
  assert.equal(match('python #news', bm({ title: 'python', tags: ['news'] })), true);
  assert.equal(match('python #news', bm({ title: 'python', tags: ['tech'] })), false);
});

test('explicit OR matches either', () => {
  assert.equal(match('python OR rust', bm({ title: 'rust lang' })), true);
  assert.equal(match('python OR rust', bm({ title: 'go lang' })), false);
});

test('quoted operator is literal text, not an operator', () => {
  assert.equal(match('"AND"', bm({ title: 'command AND control' })), true);
  assert.equal(match('"AND"', bm({ title: 'nothing here' })), false);
});

test('boolean logic with grouping and NOT', () => {
  const b1 = bm({ tags: ['news'], title: 'python story' });
  const b2 = bm({ tags: ['news'], title: 'rust story', description: 'archived-topic' });
  const q = '#news AND (python OR rust) NOT archived-topic';
  assert.equal(match(q, b1), true);
  assert.equal(match(q, b2), false); // excluded by NOT archived-topic
});

test('malformed queries throw SearchError', () => {
  assert.throws(() => parseQuery('#news (python'), SearchError); // unbalanced paren
  assert.throws(() => parseQuery('python AND'), SearchError);    // dangling operator
  assert.throws(() => parseQuery('OR rust'), SearchError);       // leading operator
  assert.throws(() => parseQuery('"unclosed'), SearchError);     // unbalanced quote
  assert.throws(() => parseQuery('()'), SearchError);            // empty parens
});

test('empty query matches everything', () => {
  assert.equal(evaluate(parseQuery(''), bm({})), true);
});
