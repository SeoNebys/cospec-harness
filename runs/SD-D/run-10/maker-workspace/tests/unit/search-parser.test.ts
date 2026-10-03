import { SearchSyntaxError, lexSearch } from '../../src/server/search/lexer';
import { parseSearch } from '../../src/server/search/parser';

describe('search parser', () => {
  it('treats quoted operators as text and applies NOT, AND, OR precedence', () => {
    expect(parseSearch('"AND OR NOT"')).toEqual({ type: 'text', value: 'AND OR NOT', phrase: true });
    expect(parseSearch('#news OR #research NOT paywall')).toEqual({
      type: 'or',
      left: { type: 'tag', value: 'news' },
      right: {
        type: 'and',
        left: { type: 'tag', value: 'research' },
        right: { type: 'not', child: { type: 'text', value: 'paywall', phrase: false } },
      },
    });
  });
  it('supports implicit AND and exact source offsets', () => {
    expect(parseSearch('design systems')).toMatchObject({ type: 'and' });
    expect(lexSearch('privacy AND')).toHaveLength(3);
    try {
      parseSearch('privacy AND');
    } catch (error) {
      expect(error).toMatchObject({ code: 'missing_operand', start: 8, end: 11 });
    }
  });
  it('rejects empty phrases, bare tags, parentheses, and overlong input', () => {
    for (const query of ['""', '#', '(privacy)', 'x'.repeat(2001)])
      expect(() => parseSearch(query)).toThrow(SearchSyntaxError);
  });
});
