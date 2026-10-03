import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuery, evaluate, SearchQueryError } from '../../src/services/search.js';

function match(query, doc) {
  return evaluate(parseQuery(query), doc);
}

const doc = {
  title: 'Best Pasta Recipe',
  description: 'A cooking guide',
  note_text: 'Rock and Roll music playlist',
  url: 'https://example.com/pasta',
  tags: ['recipe', 'cooking'],
};

test('case-insensitive keyword across fields (FR-017)', () => {
  assert.equal(match('PASTA', doc), true);
  assert.equal(match('cooking', doc), true); // description + tag
  assert.equal(match('example.com', doc), true); // url
});

test('exact phrase (FR-018)', () => {
  assert.equal(match('"pasta recipe"', doc), true);
  assert.equal(match('"recipe pasta"', doc), false);
});

test('#tag term (FR-018)', () => {
  assert.equal(match('#recipe', doc), true);
  assert.equal(match('#dessert', doc), false);
});

test('boolean AND/OR/NOT with parentheses (FR-018)', () => {
  assert.equal(match('(#recipe OR #cooking) AND pasta NOT #dessert', doc), true);
  assert.equal(match('#recipe AND #dessert', doc), false);
  assert.equal(match('pasta OR nonsense', doc), true);
  assert.equal(match('NOT #dessert', doc), true);
});

test('quoted AND/OR/NOT treated as literal words (FR-018)', () => {
  // "rock and roll" must match the literal phrase in note_text, not parse AND.
  assert.equal(match('"rock and roll"', doc), true);
  assert.equal(match('"rock or jazz"', doc), false);
});

test('implicit AND between adjacent terms', () => {
  assert.equal(match('pasta cooking', doc), true);
  assert.equal(match('pasta dessert', doc), false);
});

test('malformed queries throw (FR-019)', () => {
  assert.throws(() => parseQuery('(unclosed'), SearchQueryError);
  assert.throws(() => parseQuery('"unterminated'), SearchQueryError);
  assert.throws(() => parseQuery('a AND'), SearchQueryError);
});

test('empty query matches everything', () => {
  assert.equal(match('', doc), true);
});
