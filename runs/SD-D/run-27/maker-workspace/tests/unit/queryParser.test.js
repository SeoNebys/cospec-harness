import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuery, compileToSql, QueryError } from '../../server/lib/queryParser.js';

test('parses a bare keyword', () => {
  const ast = parseQuery('hello');
  assert.equal(ast.type, 'term');
  assert.equal(ast.kind, 'keyword');
  assert.equal(ast.value, 'hello');
});

test('implicit AND for adjacent terms', () => {
  const ast = parseQuery('cats dogs');
  assert.equal(ast.type, 'and');
});

test('precedence: NOT > AND > OR', () => {
  // a OR b AND c  => a OR (b AND c)
  const ast = parseQuery('a OR b AND c');
  assert.equal(ast.type, 'or');
  assert.equal(ast.right.type, 'and');
});

test('parentheses override precedence', () => {
  const ast = parseQuery('(a OR b) AND c');
  assert.equal(ast.type, 'and');
  assert.equal(ast.left.type, 'or');
});

test('#tag term', () => {
  const ast = parseQuery('#work');
  assert.equal(ast.kind, 'tag');
  assert.equal(ast.value, 'work');
});

test('quoted phrase is literal', () => {
  const ast = parseQuery('"quarterly review"');
  assert.equal(ast.kind, 'phrase');
  assert.equal(ast.value, 'quarterly review');
});

test('quoted operators are literal text, not operators', () => {
  const ast = parseQuery('"AND"');
  assert.equal(ast.type, 'term');
  assert.equal(ast.kind, 'phrase');
  assert.equal(ast.value, 'AND');
});

test('complex boolean query', () => {
  const ast = parseQuery('#work AND (report OR "quarterly review") NOT draft');
  assert.equal(ast.type, 'and');
});

test('malformed: unbalanced parens throws', () => {
  assert.throws(() => parseQuery('(a OR b'), QueryError);
});

test('malformed: unbalanced quotes throws', () => {
  assert.throws(() => parseQuery('"unclosed'), QueryError);
});

test('malformed: dangling operator throws', () => {
  assert.throws(() => parseQuery('a AND'), QueryError);
});

test('compileToSql produces params for tags and text', () => {
  const ast = parseQuery('#work report');
  const { sql, params } = compileToSql(ast);
  assert.match(sql, /bookmark_tags/);
  assert.match(sql, /bookmark_fts/);
  assert.equal(params.length, 2);
  assert.equal(params[0], 'work');
});
