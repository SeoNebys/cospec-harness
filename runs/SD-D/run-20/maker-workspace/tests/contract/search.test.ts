import { expect, it } from 'vitest';
import { SearchSyntaxError, parseSearch } from '../../src/server/search/parse';
it('provides the contracted retained query and precise error range', () => {
  try {
    parseSearch('one OR');
    throw new Error('expected failure');
  } catch (error) {
    expect(error).toBeInstanceOf(SearchSyntaxError);
    expect(error).toMatchObject({ query: 'one OR', offset: 6, length: 1 });
  }
});
