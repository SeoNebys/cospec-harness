import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../../src/server/services/search/tokenize.js';
import { parseQuery, SearchSyntaxError } from '../../src/server/services/search/parse.js';
import { toSql } from '../../src/server/services/search/toSql.js';

test('tokenizes words, tags, phrases, parens, operators', () => {
  const toks = tokenize('foo #news "hello world" (a OR b) NOT x');
  const types = toks.map((t) => t.type);
  assert.deepEqual(types, ['word', 'tag', 'phrase', 'lparen', 'word', 'or', 'word', 'rparen', 'not', 'word']);
  assert.equal(toks[2].value, 'hello world');
  assert.equal(toks[1].value, 'news');
});

test('quoted AND/OR/NOT are literal text, not operators (FR-013b)', () => {
  const toks = tokenize('"NOT ready" "a AND b"');
  assert.deepEqual(toks.map((t) => t.type), ['phrase', 'phrase']);
  assert.equal(toks[0].value, 'NOT ready');
  const ast = parseQuery('"NOT ready"');
  assert.deepEqual(ast, { type: 'term', value: 'NOT ready' });
});

test('adjacent terms combine as implicit AND (FR-013a)', () => {
  const ast = parseQuery('foo #news');
  assert.equal(ast.type, 'and');
  assert.deepEqual(ast.left, { type: 'term', value: 'foo' });
  assert.deepEqual(ast.right, { type: 'tag', value: 'news' });
});

test('OR is honored only when explicit; precedence NOT > AND > OR', () => {
  // a OR b c  =>  a OR (b AND c)
  const ast = parseQuery('a OR b c');
  assert.equal(ast.type, 'or');
  assert.deepEqual(ast.left, { type: 'term', value: 'a' });
  assert.equal(ast.right.type, 'and');
});

test('NOT binds tighter than AND', () => {
  // NOT a b  =>  (NOT a) AND b
  const ast = parseQuery('NOT a b');
  assert.equal(ast.type, 'and');
  assert.equal(ast.left.type, 'not');
  assert.deepEqual(ast.left.child, { type: 'term', value: 'a' });
});

test('parentheses override precedence', () => {
  // (a OR b) c => AND(OR(a,b), c)
  const ast = parseQuery('(a OR b) c');
  assert.equal(ast.type, 'and');
  assert.equal(ast.left.type, 'or');
  assert.deepEqual(ast.right, { type: 'term', value: 'c' });
});

test('malformed queries throw SearchSyntaxError (FR-014)', () => {
  assert.throws(() => parseQuery('(a OR '), SearchSyntaxError);
  assert.throws(() => parseQuery('a AND'), SearchSyntaxError);
  assert.throws(() => parseQuery('"unterminated'), SearchSyntaxError);
  assert.throws(() => parseQuery('()'), SearchSyntaxError);
  assert.throws(() => parseQuery('a )'), SearchSyntaxError);
});

test('empty query yields null AST -> match-all SQL', () => {
  assert.equal(parseQuery('   '), null);
  assert.deepEqual(toSql(null), { sql: '1', params: [] });
});

test('toSql produces parameterized clauses for terms and tags', () => {
  const { sql, params } = toSql(parseQuery('foo #news'));
  assert.match(sql, /AND/);
  // term 'foo' expands to 5 LIKE params; tag adds 1 exact param
  assert.equal(params.length, 6);
  assert.equal(params[0], '%foo%');
  assert.equal(params[5], 'news');
});
