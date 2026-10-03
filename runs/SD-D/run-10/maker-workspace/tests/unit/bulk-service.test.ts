import { bulkActionSchema, bulkSelectionSchema } from '../../src/shared/contracts/bulk';

describe('bulk selection contracts', () => {
  it('requires versions for explicit selection and supports full criteria selection', () => {
    expect(bulkSelectionSchema.safeParse({ mode: 'ids', items: [{ id: 'bmk_one' }] }).success).toBe(false);
    expect(bulkSelectionSchema.parse({ mode: 'query', criteria: {} })).toMatchObject({
      mode: 'query',
      criteria: { context: 'active', sort: 'newest' },
    });
    expect(bulkActionSchema.parse({ type: 'tags.add', tagIds: ['tag_one1'] })).toEqual({
      type: 'tags.add',
      tagIds: ['tag_one1'],
    });
  });
});
