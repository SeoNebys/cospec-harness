import { expect, it } from 'vitest';
import { parseSearch } from '../../src/server/search/parse';
it.each([
  '#',
  '()',
  '"unterminated',
  'a AND',
  '(a OR b',
  `"bad\\nescape"`,
  '('.repeat(11) + 'a' + ')'.repeat(11),
  'a'.repeat(501),
])('rejects invalid or excessive query %s', (query) => expect(() => parseSearch(query)).toThrow());
