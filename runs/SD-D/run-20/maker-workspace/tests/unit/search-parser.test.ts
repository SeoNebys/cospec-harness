import { expect, it } from 'vitest';
import { parseSearch, SearchSyntaxError } from '../../src/server/search/parse';
import { compileSearch } from '../../src/server/search/compile';

const fixture = {
  title: 'Design systems',
  url: 'https://example.com',
  description: 'A research guide',
  noteText: 'Worth reading',
  tags: [{ label: 'Product Design' }],
};
it('applies implicit AND, exact tags, phrases, Boolean precedence, parentheses and double NOT', () => {
  for (const query of [
    'design systems',
    '#"product design"',
    '"design systems"',
    'missing OR design AND #"product design"',
    '(missing OR design) AND NOT #finished',
    'NOT NOT design',
  ])
    expect(compileSearch(parseSearch(query).ast)(fixture)).toBe(true);
});
it('preserves useful syntax error offsets', () => {
  try {
    parseSearch('design AND');
  } catch (error) {
    expect(error).toBeInstanceOf(SearchSyntaxError);
    expect((error as SearchSyntaxError).query).toBe('design AND');
    expect((error as SearchSyntaxError).offset).toBe(10);
  }
});
