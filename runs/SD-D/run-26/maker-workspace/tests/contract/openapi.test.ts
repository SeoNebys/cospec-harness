import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
describe('OpenAPI artifact', () => {
  it('is valid YAML and documents every mounted API operation', () => {
    const document = parse(
      readFileSync('specs/001-bookmark-manager/contracts/openapi.yaml', 'utf8')
    );
    expect(document.openapi).toMatch(/^3\./);
    const expected = [
      '/session',
      '/metadata/preview',
      '/bookmarks',
      '/bookmarks/{bookmarkId}',
      '/bookmarks/{bookmarkId}/metadata-preview',
      '/bookmarks/bulk',
      '/tags',
      '/imports/preview',
      '/imports/{importId}',
      '/imports/{importId}/commit',
      '/exports/bookmarks.html',
      '/icons/{hash}'
    ];
    for (const path of expected) expect(document.paths[path], path).toBeTruthy();
  });
});
