import { describe, expect, it } from 'vitest';
import { metadataPages } from '../../fixtures/metadata-pages.js';
import { parseMetadata } from '../../../src/server/services/metadata-parser.js';

describe('metadata parser', () => {
  it('prefers social metadata and normalizes whitespace', () => {
    expect(parseMetadata(metadataPages.rich)).toEqual({ title: 'Social title', description: 'Social description' });
  });

  it('falls back to document title and standard description', () => {
    expect(parseMetadata(metadataPages.standard)).toEqual({ title: 'Standard title', description: 'A useful page' });
  });

  it('returns nulls for blank metadata and enforces limits', () => {
    expect(parseMetadata(metadataPages.blank)).toEqual({ title: null, description: null });
    const long = `<title>${'t'.repeat(400)}</title><meta name="description" content="${'d'.repeat(1200)}">`;
    const parsed = parseMetadata(long);
    expect(parsed.title).toHaveLength(300);
    expect(parsed.description).toHaveLength(1000);
  });
});
