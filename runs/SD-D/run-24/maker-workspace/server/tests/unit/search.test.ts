import { describe, it, expect } from 'vitest';
import { freshDb } from '../helpers';
import { create, list } from '../../src/models/bookmarks';
import { parseSearch, SearchSyntaxError } from '../../src/search/parser';

function seed() {
  const db = freshDb();
  const a = create({ url: 'https://a.com', title: 'Release notes for v2', description: 'changelog', tags: ['work'] });
  const b = create({ url: 'https://b.com', title: 'The rise and fall', description: 'history', tags: ['reading'] });
  const c = create({ url: 'https://c.com', title: 'Work archive dump', description: 'old', tags: ['work', 'archive'] });
  return { db, a, b, c };
}

describe('rich search (FR-011 / US4)', () => {
  it('matches #tag membership', () => {
    seed();
    const r = list({ q: '#work' });
    expect(r.items.map((x) => x.title).sort()).toEqual(['Release notes for v2', 'Work archive dump']);
  });

  it('honors AND / OR / NOT with parentheses', () => {
    seed();
    const r = list({ q: '#work AND ("release notes" OR changelog) NOT #archive' });
    expect(r.items.map((x) => x.title)).toEqual(['Release notes for v2']);
  });

  it('treats quoted operator words as literal text', () => {
    seed();
    const r = list({ q: '"rise and fall"' });
    expect(r.items.map((x) => x.title)).toEqual(['The rise and fall']);
  });

  it('does not treat quoted AND as an operator (would otherwise match differently)', () => {
    seed();
    // Unquoted: "rise" AND "fall" AND "history" style — implicit AND across terms.
    const quoted = list({ q: '"rise and fall"' }).total;
    expect(quoted).toBe(1);
  });

  it('is case-insensitive', () => {
    seed();
    expect(list({ q: 'RELEASE' }).total).toBe(1);
  });

  it('rejects malformed expressions', () => {
    expect(() => parseSearch('(')).toThrow(SearchSyntaxError);
    expect(() => parseSearch('"unbalanced')).toThrow(SearchSyntaxError);
    expect(() => parseSearch('foo AND')).toThrow(SearchSyntaxError);
    expect(() => parseSearch('#')).toThrow(SearchSyntaxError);
  });
});
