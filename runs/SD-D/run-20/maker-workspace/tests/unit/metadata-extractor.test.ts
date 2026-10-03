import { expect, it } from 'vitest';
import { extractMetadata } from '../../src/server/metadata/extractMetadata';
it('uses Open Graph before Twitter and standard metadata and resolves media', () => {
  const result = extractMetadata(
    '<title>Standard</title><meta name="twitter:title" content="Twitter"><meta property="og:title" content="OG"><meta name="description" content="Description"><meta property="og:image" content="/cover.png"><link rel="icon" href="icon.png"><script>throw 1</script>',
    'https://example.com/path/',
  );
  expect(result).toEqual({
    title: 'OG',
    description: 'Description',
    iconUrl: 'https://example.com/path/icon.png',
    previewImageUrl: 'https://example.com/cover.png',
  });
});
