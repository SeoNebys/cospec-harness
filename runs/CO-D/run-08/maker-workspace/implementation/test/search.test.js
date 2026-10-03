import test from 'node:test';
import assert from 'node:assert/strict';
import { compileSearch, searchable } from '../lib/search.js';

const items = [
  { title:'A Weekend in Rome', description:'A modern city guide', source:'travel.test', note:'quiet cafes', labels:['article'] },
  { title:'SPQR', description:'A book about ancient Rome', source:'books.test', note:'', labels:['book'] },
  { title:'A Roman Holiday for the Weekend', description:'Reflections', source:'notes.test', note:'', labels:['essay'] }
].map(searchable);

test('combines AND, grouped OR, NOT, and labels', () => {
  const match = compileSearch('rome AND (#article OR #book) AND NOT ancient');
  assert.deepEqual(items.map(match), [true,false,false]);
});
test('matches exact phrases without case sensitivity', () => {
  const match = compileSearch('"A WEEKEND"');
  assert.deepEqual(items.map(match), [true,false,false]);
});
test('rejects incomplete expressions', () => assert.throws(() => compileSearch('rome AND (')));
