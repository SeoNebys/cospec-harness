import { normalizeOrganizationName } from '../../src/server/domain/organization-service';
import { searchCriteriaSchema } from '../../src/shared/contracts/search';

describe('saved search inputs', () => {
  it('normalizes names and preserves the full reusable criteria', () => {
    expect(normalizeOrganizationName('  Unread   News ')).toBe('unread news');
    expect(
      searchCriteriaSchema.parse({
        query: '#news',
        includeTagIds: [],
        excludeTagIds: [],
        collection: { mode: 'any' },
        favorite: 'favorite',
        reading: 'unread',
        context: 'active',
        sort: 'updated',
      }),
    ).toMatchObject({ query: '#news', favorite: 'favorite', reading: 'unread', sort: 'updated' });
  });
});
