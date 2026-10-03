import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesSearch, tokenizeQuery } from '../public/search.js';

const design = { title: 'Inclusive Design Patterns', description: 'Usable by more people', site: 'Magazine', url: 'https://example.com/design', labels: ['design', 'accessibility'] };
const grid = { title: 'CSS grid layout', description: 'Rows and columns', site: 'MDN', url: 'https://example.com/grid', labels: ['design', 'reference'] };
const food = { title: 'Roast potatoes', description: 'Crisp edges', site: 'Kitchen', url: 'https://example.com/food', labels: ['cooking'] };

test('SCN-004 plain search is case-insensitive across details and labels', () => {
  assert.equal(matchesSearch(grid, 'GRID'), true);
  assert.equal(matchesSearch(grid, 'reference'), true);
  assert.equal(matchesSearch(grid, 'rows columns'), true);
  assert.equal(matchesSearch(food, 'design'), false);
});

test('SCN-006 quoted phrases, OR, typed labels, and exclusions work', () => {
  assert.equal(matchesSearch(design, '"design patterns"'), true);
  assert.equal(matchesSearch(grid, '"design patterns"'), false);
  assert.equal(matchesSearch(grid, 'grid OR potatoes'), true);
  assert.equal(matchesSearch(food, 'grid OR potatoes'), true);
  assert.equal(matchesSearch(design, 'label:design -label:accessibility'), false);
  assert.equal(matchesSearch(grid, 'label:design -label:accessibility'), true);
});

test('SCN-006 visible any-word and label conditions combine', () => {
  assert.equal(matchesSearch(grid, 'grid potatoes', 'any'), true);
  assert.equal(matchesSearch(food, 'grid potatoes', 'any'), true);
  assert.equal(matchesSearch(design, 'grid potatoes', 'any'), false);
  assert.equal(matchesSearch(grid, 'grid', 'all', new Map([['design', 'include']])), true);
  assert.equal(matchesSearch(food, 'grid', 'all', new Map([['design', 'include']])), false);
});

test('SCN-013 identifies an unfinished quotation without throwing away partial terms', () => {
  const parsed = tokenizeQuery('"design patterns');
  assert.equal(parsed.unclosedQuote, true);
  assert.equal(parsed.tokens[0].value, 'design patterns');
  assert.equal(matchesSearch(design, '"design patterns'), true);
});
