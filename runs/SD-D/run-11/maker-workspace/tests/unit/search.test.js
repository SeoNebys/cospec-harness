import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuery, matches, SearchQueryError } from '../../src/services/search.js';

function bm(over = {}) {
  return {
    title: 'Japan travel guide',
    description: 'Best places to visit',
    note_html: '<p>Notes about <strong>Kyoto</strong></p>',
    url: 'https://example.com/japan',
    tags: ['travel', 'asia'],
    ...over,
  };
}

function run(q, b) {
  return matches(parseQuery(q), b);
}

test('case-insensitive across fields', () => {
  assert.equal(run('JAPAN', bm()), true);
  assert.equal(run('kyoto', bm()), true); // from note
  assert.equal(run('EXAMPLE.COM', bm()), true); // from url
  assert.equal(run('nonexistent', bm()), false);
});

test('tag term matches tag set only', () => {
  assert.equal(run('#travel', bm()), true);
  assert.equal(run('#food', bm()), false);
  // "travel" also appears in tags but a bare word searches text, not tags:
  assert.equal(run('travel', bm({ tags: ['travel'], title: 'x', description: '', note_html: '', url: 'https://e.com' })), false);
});

test('implicit AND between adjacent terms including tag + word', () => {
  assert.equal(run('#travel japan', bm()), true);
  assert.equal(run('#travel korea', bm()), false); // korea absent
  assert.equal(run('#food japan', bm()), false); // tag absent
});

test('quoted operators are literal text, not operators', () => {
  const b = bm({ title: 'rock and roll classics', tags: [], description: '', note_html: '', url: 'https://e.com' });
  assert.equal(run('"rock and roll"', b), true);
  // As an operator, "rock AND roll" would still match, so test the literal
  // phrase does NOT match when the words are not adjacent:
  const b2 = bm({ title: 'rock or roll', tags: [], description: '', note_html: '', url: 'https://e.com' });
  assert.equal(run('"rock and roll"', b2), false);
});

test('boolean with parentheses and NOT', () => {
  assert.equal(run('#travel AND (japan OR korea) NOT flight', bm()), true);
  assert.equal(run('#travel AND (japan OR korea) NOT kyoto', bm()), false); // kyoto present in note
});

test('OR lower precedence than AND', () => {
  // "a b OR c" == "(a AND b) OR c"
  const b = bm({ title: 'c', description: '', note_html: '', url: 'https://e.com', tags: [] });
  assert.equal(run('japan travel OR c', b), true); // matches via c
});

test('empty query matches everything', () => {
  assert.equal(run('', bm()), true);
  assert.equal(run('   ', bm()), true);
});

test('malformed queries throw', () => {
  assert.throws(() => parseQuery('"unbalanced'), SearchQueryError);
  assert.throws(() => parseQuery('(japan OR korea'), SearchQueryError);
  assert.throws(() => parseQuery('japan)'), SearchQueryError);
  assert.throws(() => parseQuery('AND japan'), SearchQueryError);
});
