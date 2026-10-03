import test from 'node:test';
import assert from 'node:assert/strict';
import { compileSearch, SearchSyntaxError } from '../../lib/search.js';

const bookmarks = [
  {
    title: 'Crispy roast potatoes',
    description: 'Crunchy outside with creamy centers',
    siteName: 'seriouseats.com',
    url: 'https://seriouseats.com/potatoes',
    labels: ['Recipes']
  },
  {
    title: 'Carrot cake',
    description: 'A creamy cake with soft centers',
    siteName: 'bbcgoodfood.com',
    url: 'https://bbcgoodfood.com/carrot',
    labels: ['Recipes', 'Work']
  },
  {
    title: 'JavaScript Guide',
    description: 'Promises and modules',
    siteName: 'developer.mozilla.org',
    url: 'https://developer.mozilla.org/guide',
    labels: ['Work']
  }
];

function matching(query) {
  return bookmarks.filter(compileSearch(query)).map(item => item.title);
}

test('plain search is case-insensitive and covers descriptions', () => {
  assert.deepEqual(matching('CREAMY'), ['Crispy roast potatoes', 'Carrot cake']);
});

test('supports labels, exact phrases, exclusions, OR, and implicit AND', () => {
  assert.deepEqual(matching('label:recipes'), ['Crispy roast potatoes', 'Carrot cake']);
  assert.deepEqual(matching('"creamy centers"'), ['Crispy roast potatoes']);
  assert.deepEqual(matching('label:recipes -carrot'), ['Crispy roast potatoes']);
  assert.deepEqual(matching('label:recipes OR label:work'), bookmarks.map(item => item.title));
  assert.deepEqual(matching('potatoes label:recipes'), ['Crispy roast potatoes']);
});

test('reports an unfinished quoted phrase', () => {
  assert.throws(() => compileSearch('"creamy centers'), error => {
    assert.ok(error instanceof SearchSyntaxError);
    assert.match(error.message, /closing quotation mark/i);
    return true;
  });
});
