import { describe, expect, it } from 'vitest';
import { parseMetadata } from '@server/metadata/metadata-parser.js';
describe('metadata parser', () => {
  it('prefers Open Graph values and resolves icons', () => {
    const result = parseMetadata(
      `<html><head><base href="https://cdn.example/"><title>HTML</title><meta property="og:title" content=" Social  title "><meta name="description" content=" A description "><link rel="icon" href="icon.png" sizes="64x64"></head></html>`,
      'https://example.com/path'
    );
    expect(result.title).toBe('Social title');
    expect(result.description).toBe('A description');
    expect(result.icons[0]?.href).toBe('https://cdn.example/icon.png');
  });
  it('returns null fields for malformed/missing heads', () =>
    expect(parseMetadata('<p>hello', 'https://example.com')).toMatchObject({
      title: null,
      description: null
    }));
});
