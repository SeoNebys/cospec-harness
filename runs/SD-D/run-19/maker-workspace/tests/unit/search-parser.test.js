import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSearch, SearchSyntaxError } from '../../src/services/search/parser.js';
import { compileSearch } from '../../src/services/search/compile.js';

test('empty query -> null AST / no SQL', () => {
  assert.equal(parseSearch(''), null);
  assert.deepEqual(compileSearch(''), { sql: null, params: [] });
});

test('implicit AND between words', () => {
  const ast = parseSearch('open source');
  assert.equal(ast.type, 'and');
  assert.equal(ast.left.type, 'term');
  assert.equal(ast.right.type, 'term');
});

test('quoted phrase is a single term', () => {
  const ast = parseSearch('"open source"');
  assert.equal(ast.type, 'term');
  assert.equal(ast.value, 'open source');
});

test('#tag AND phrase', () => {
  const ast = parseSearch('#news AND "open source"');
  assert.equal(ast.type, 'and');
  assert.equal(ast.left.type, 'tag');
  assert.equal(ast.left.value, 'news');
  assert.equal(ast.right.type, 'term');
});

test('text and #tag together are ANDed (both must match)', () => {
  const ast = parseSearch('report #news');
  assert.equal(ast.type, 'and');
  const kinds = [ast.left.type, ast.right.type].sort();
  assert.deepEqual(kinds, ['tag', 'term']);
});

test('quoted operator word is literal, not an operator', () => {
  const ast = parseSearch('"AND"');
  assert.equal(ast.type, 'term');
  assert.equal(ast.value, 'AND');
});

test('parentheses grouping with OR and NOT', () => {
  const ast = parseSearch('(cats OR dogs) NOT archived-topic');
  assert.equal(ast.type, 'and');
  assert.equal(ast.left.type, 'or');
  assert.equal(ast.right.type, 'not');
});

test('two tags ANDed', () => {
  const ast = parseSearch('#a #b');
  assert.equal(ast.type, 'and');
  assert.equal(ast.left.type, 'tag');
  assert.equal(ast.right.type, 'tag');
});

test('dangling operator throws syntax error', () => {
  assert.throws(() => parseSearch('foo AND'), (e) => e instanceof SearchSyntaxError && e.code === 'syntax');
});

test('unbalanced quote throws', () => {
  assert.throws(() => parseSearch('"foo'), (e) => e instanceof SearchSyntaxError && e.code === 'unbalanced-quote');
});

test('unbalanced parenthesis throws', () => {
  assert.throws(() => parseSearch('(foo'), (e) => e instanceof SearchSyntaxError && e.code === 'unbalanced-paren');
  assert.throws(() => parseSearch('foo)'), (e) => e instanceof SearchSyntaxError && e.code === 'unbalanced-paren');
});

test('compile produces parameterised SQL with escaped wildcards', () => {
  const { sql, params } = compileSearch('50%_off');
  assert.match(sql, /LIKE \? ESCAPE/);
  assert.ok(params.every((p) => typeof p === 'string'));
  assert.ok(params[0].includes('50\\%\\_off'));
});

test('tag compiles to EXISTS clause', () => {
  const { sql, params } = compileSearch('#news');
  assert.match(sql, /EXISTS/);
  assert.deepEqual(params, ['news']);
});
