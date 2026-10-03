import { expect, it } from 'vitest';
import { parseMetadata } from '@server/metadata/metadata-parser.js';
it('parses representative metadata comfortably within the interactive budget', () => {
  const html =
      `<html><head><meta property="og:title" content="A title"><meta name="description" content="Description"><link rel="icon" href="/icon.png"></head></html>`.repeat(
        100
      ),
    start = performance.now();
  for (let i = 0; i < 100; i++)
    expect(parseMetadata(html, 'https://example.com').title).toBe('A title');
  expect(performance.now() - start).toBeLessThan(5000);
});
