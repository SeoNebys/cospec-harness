import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
it('declares every implemented operation in the approved OpenAPI contract', () => {
  const contract = readFileSync('specs/001-bookmark-manager/contracts/openapi.yaml', 'utf8');
  for (const operation of [
    'getHealth',
    'createMetadataPreview',
    'listBookmarks',
    'createBookmark',
    'getBookmark',
    'updateBookmark',
    'applyBulkBookmarkAction',
    'suggestTags',
    'getMediaAsset',
  ])
    expect(contract).toContain(`operationId: ${operation}`);
});
