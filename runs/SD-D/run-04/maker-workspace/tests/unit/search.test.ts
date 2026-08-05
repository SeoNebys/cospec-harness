import { describe, it, expect } from 'vitest';
import { buildFtsMatch, buildListQuery } from '../../src/server/services/search';

describe('buildFtsMatch (FR-009/FR-010)', () => {
  it('returns null for empty text', () => {
    expect(buildFtsMatch(undefined)).toBeNull();
    expect(buildFtsMatch('   ')).toBeNull();
  });

  it('wraps bare words as quoted tokens (implicit AND)', () => {
    expect(buildFtsMatch('budget spreadsheet')).toBe('"budget" "spreadsheet"');
  });

  it('keeps a quoted phrase intact', () => {
    expect(buildFtsMatch('"budget spreadsheet"')).toBe('"budget spreadsheet"');
  });

  it('mixes a phrase and bare words', () => {
    expect(buildFtsMatch('annual "budget spreadsheet" draft')).toBe(
      '"annual" "budget spreadsheet" "draft"'
    );
  });

  it('neutralizes stray quotes/punctuation (no operator injection)', () => {
    // A stray operator-like token must not break the query.
    expect(buildFtsMatch('foo OR')).toBe('"foo" "OR"');
  });
});

describe('buildListQuery (FR-011/FR-014, filter-model.md)', () => {
  it('scopes to non-archived by default and sorts newest-first', () => {
    const q = buildListQuery({});
    expect(q.sql).toContain('b.archived = 0');
    expect(q.sql).toContain('ORDER BY b.created_at DESC');
    expect(q.params).toEqual([]);
  });

  it('builds the worked example: (recipes OR dinner) AND NOT dessert', () => {
    const q = buildListQuery({ tagsAny: ['Recipes', 'dinner'], tagsNot: ['dessert'], view: 'all' });
    // any-of uses IN(...), not uses NOT IN(...)
    expect(q.sql).toContain('IN (SELECT bt.bookmark_id');
    expect(q.sql).toContain('NOT IN (SELECT bt.bookmark_id');
    // tag names lowercased
    expect(q.params).toContain('recipes');
    expect(q.params).toContain('dinner');
    expect(q.params).toContain('dessert');
  });

  it('all-of requires the full count via HAVING', () => {
    const q = buildListQuery({ tagsAll: ['work', 'urgent'] });
    expect(q.sql).toContain('HAVING COUNT(DISTINCT t.name) = ?');
    expect(q.params[q.params.length - 1]).toBe(2);
  });

  it('archived view selects archived rows', () => {
    expect(buildListQuery({ view: 'archived' }).sql).toContain('b.archived = 1');
  });

  it('read-later view scopes to non-archived flagged rows', () => {
    expect(buildListQuery({ view: 'readLater' }).sql).toContain('b.read_later = 1');
  });

  it('sorts by title when requested', () => {
    expect(buildListQuery({ sort: 'title' }).sql).toContain('b.title COLLATE NOCASE ASC');
  });
});
