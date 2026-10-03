import { expect, it } from 'vitest';
import { updateBookmarkSchema } from '../../src/shared/schemas/api';
it('rejects unknown update fields and empty updates', () => {
  expect(() => updateBookmarkSchema.parse({})).toThrow();
  expect(() => updateBookmarkSchema.parse({ surprise: true })).toThrow();
  expect(updateBookmarkSchema.parse({ title: 'Good' })).toEqual({ title: 'Good' });
});
