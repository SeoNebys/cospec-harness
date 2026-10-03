import { describe, expect, it } from 'vitest';

import { compileBookmarkQuery } from '../../src/server/search/compile-query.js';
import { parseSearchQuery } from '../../src/shared/search/parser.js';

describe('compileBookmarkQuery', () => {
  it('binds all user values and escapes LIKE wildcards', () => {
    const compiled = compileBookmarkQuery({ ast: parseSearchQuery('100% under_score') });
    expect(compiled.where).not.toContain('100%');
    expect(compiled.parameters).toEqual([
      '%100\\%%', '%100\\%%', '%100\\%%', '%100\\%%', '%100\\%%',
      '%under\\_score%', '%under\\_score%', '%under\\_score%', '%under\\_score%', '%under\\_score%',
    ]);
    expect(compiled.where).toContain("ESCAPE '\\'");
  });

  it('checks a phrase within each single searchable field', () => {
    const compiled = compileBookmarkQuery({ ast: parseSearchQuery('"ancient rome"') });
    expect(compiled.where).toContain('search_normalize(b.title) LIKE ?');
    expect(compiled.where).toContain('search_normalize(b.url) LIKE ?');
    expect(compiled.parameters).toEqual(Array(5).fill('%ancient rome%'));
  });

  it('uses OR only inside a tag alternative and AND between clauses', () => {
    const compiled = compileBookmarkQuery({ ast: parseSearchQuery('Rome tag:(article|book)') });
    expect(compiled.where).toContain('normalized_name IN (?, ?)');
    expect(compiled.where).toContain('\nAND EXISTS');
    expect(compiled.parameters.slice(-2)).toEqual(['article', 'book']);
  });

  it('adds each selected tag as a separate AND condition', () => {
    const compiled = compileBookmarkQuery({
      ast: parseSearchQuery(''),
      selectedTags: ['Book', ' Science   Fiction ', 'book'],
    });
    expect(compiled.where.match(/filter_t\.normalized_name = \?/gu)).toHaveLength(2);
    expect(compiled.parameters).toEqual(['book', 'science fiction']);
  });

  it('allowlists scope and deterministic sorting', () => {
    expect(
      compileBookmarkQuery({ ast: parseSearchQuery(''), scope: 'unread-read-later', sort: 'title', order: 'asc' }),
    ).toMatchObject({
      where: 'b.read_later = 1 AND b.is_read = 0',
      orderBy: 'b.title COLLATE NOCASE ASC, b.created_at DESC, b.id ASC',
    });
    expect(() => compileBookmarkQuery({ ast: parseSearchQuery(''), sort: 'url' as never })).toThrow(
      'Unsupported bookmark sort',
    );
    expect(() => compileBookmarkQuery({ ast: parseSearchQuery(''), scope: 'private' as never })).toThrow(
      'Unsupported bookmark scope',
    );
  });
});
