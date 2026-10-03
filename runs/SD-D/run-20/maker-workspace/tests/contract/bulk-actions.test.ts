import { expect, it } from 'vitest';
import { bulkActionSchema } from '../../src/shared/schemas/api';
it('requires unique IDs, action-specific tags and confirmed deletion', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  expect(() => bulkActionSchema.parse({ bookmarkIds: [id, id], action: 'archive' })).toThrow();
  expect(() => bulkActionSchema.parse({ bookmarkIds: [id], action: 'addTags' })).toThrow();
  expect(() => bulkActionSchema.parse({ bookmarkIds: [id], action: 'delete' })).toThrow();
  expect(bulkActionSchema.parse({ bookmarkIds: [id], action: 'delete', confirmed: true }).confirmed).toBe(
    true,
  );
});
