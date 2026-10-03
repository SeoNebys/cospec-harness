import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/server/services/searchParser.js';
import { evaluate } from '../../src/server/services/searchEvaluator.js';

const bm = (over = {}) => ({
  title: 'Budget planning',
  description: 'Quarterly numbers',
  note: 'see spreadsheet',
  address: 'https://work.example/budget',
  tags: ['work', 'finance'],
  ...over,
});

test('single term matches case-insensitively across fields', () => {
  assert.equal(evaluate(parse('BUDGET'), bm()), true);
  assert.equal(evaluate(parse('spreadsheet'), bm()), true);
  assert.equal(evaluate(parse('missing'), bm()), false);
});

test('quoted phrase matches literally', () => {
  assert.equal(evaluate(parse('"budget planning"'), bm()), true);
  assert.equal(evaluate(parse('"planning budget"'), bm()), false);
});

test('#tag matches tag membership exactly', () => {
  assert.equal(evaluate(parse('#work'), bm()), true);
  assert.equal(evaluate(parse('#wor'), bm()), false);
});

test('adjacent terms are implicit AND', () => {
  assert.equal(evaluate(parse('budget quarterly'), bm()), true);
  assert.equal(evaluate(parse('budget nope'), bm()), false);
});

test('text term and #tag combine with AND', () => {
  assert.equal(evaluate(parse('budget #work'), bm()), true);
  assert.equal(evaluate(parse('budget #travel'), bm()), false);
});

test('OR, NOT and parentheses honor boolean logic', () => {
  assert.equal(evaluate(parse('budget OR missing'), bm()), true);
  assert.equal(evaluate(parse('missing OR alsomissing'), bm()), false);
  assert.equal(evaluate(parse('NOT missing'), bm()), true);
  assert.equal(evaluate(parse('NOT budget'), bm()), false);
  assert.equal(evaluate(parse('(budget OR missing) AND #finance'), bm()), true);
  assert.equal(evaluate(parse('(budget OR missing) AND #travel'), bm()), false);
});

test('quoted operator words are literal, not operators', () => {
  // A bookmark whose text contains the word "and"
  const withAnd = bm({ description: 'cats and dogs' });
  assert.equal(evaluate(parse('"and"'), withAnd), true);
  assert.equal(evaluate(parse('"and"'), bm()), false); // base bm has no literal "and"
});

test('empty query matches everything', () => {
  assert.equal(evaluate(parse(''), bm()), true);
  assert.equal(evaluate(parse('   '), bm()), true);
});

test('malformed query throws a 400 error', () => {
  assert.throws(() => parse('(budget OR'), (e) => e.status === 400);
  assert.throws(() => parse('budget )'), (e) => e.status === 400);
});
