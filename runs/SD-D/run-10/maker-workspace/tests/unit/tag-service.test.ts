import { normalizeOrganizationName } from '../../src/server/domain/organization-service';

describe('tag normalization', () => {
  it('collapses whitespace and compares case-insensitively', () => {
    expect(normalizeOrganizationName('  Climate   News ')).toBe('climate news');
    expect(normalizeOrganizationName('NEWS')).toBe(normalizeOrganizationName('news'));
  });
});
