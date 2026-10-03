import { describe, expect, it } from 'vitest';
import { parseQuery } from '@server/search/query-parser.js';
describe('search query parser', () => {
  it('applies NOT before implicit AND before OR', () => {
    expect(parseQuery('alpha NOT beta OR tag:"Design System"')).toMatchObject({
      type: 'or',
      left: {
        type: 'and',
        left: { type: 'text', value: 'alpha' },
        right: { type: 'not', child: { value: 'beta' } }
      },
      right: { type: 'tag', value: 'Design System' }
    });
  });
  it('treats lowercase operators as words', () =>
    expect(parseQuery('one or two')).toMatchObject({ type: 'and' }));
  it('reports source spans for invalid queries', () => {
    expect(() => parseQuery('one AND')).toThrow(/Add a search term/);
    expect(() => parseQuery('"open')).toThrow(/Close the quoted phrase/);
  });
});
