import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalAddress, extractMetadata, normalizeTags, searchableText, sectionIncludes } from '../lib.js';

test('canonical addresses ignore cosmetic differences and tracking', () => {
  const base = canonicalAddress('https://Example.com/article');
  assert.equal(canonicalAddress('https://example.com/article/'), base);
  assert.equal(canonicalAddress('https://example.com/article#comments'), base);
  assert.equal(canonicalAddress('https://example.com/article?utm_source=newsletter'), base);
  assert.notEqual(canonicalAddress('https://example.com/article?page=2'), base);
});

test('tags are trimmed, lowercased, and deduplicated', () => {
  assert.deepEqual(normalizeTags([' Research ', 'research', 'JavaScript']), ['research', 'javascript']);
});

test('searchable text contains every approved source', () => {
  const text = searchableText({ title:'Title', description:'Description', url:'https://example.com', note:'Reminder', tags:['research'] });
  for (const expected of ['title','description','example.com','reminder','research']) assert.match(text, new RegExp(expected));
});

test('sections exclude archived bookmarks from everyday views', () => {
  const active = { archivedAt:null, readLater:true };
  const archived = { archivedAt:'2026-01-01', readLater:false };
  assert.equal(sectionIncludes(active,'active'),true);
  assert.equal(sectionIncludes(active,'read-later'),true);
  assert.equal(sectionIncludes(archived,'active'),false);
  assert.equal(sectionIncludes(archived,'read-later'),false);
  assert.equal(sectionIncludes(archived,'archive'),true);
});

test('metadata extraction reads a title and description', () => {
  const metadata = extractMetadata('<title>Example &amp; Guide</title><meta name="description" content="A useful page">','https://example.com');
  assert.deepEqual(metadata,{title:'Example & Guide',description:'A useful page',metadataStatus:'complete'});
});
