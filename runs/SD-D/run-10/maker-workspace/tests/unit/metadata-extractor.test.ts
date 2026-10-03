import { describe, expect, it } from 'vitest';
import { extractMetadataFromHtml } from '../../src/server/metadata/metadata-extractor';
import { MetadataService } from '../../src/server/metadata/metadata-service';
import { AppError } from '../../src/server/api/errors';
import { metadataPartialHtml, metadataRichHtml } from '../fixtures/metadata-server';

describe('metadata extraction', () => {
  it('prefers Open Graph and resolves relative visuals', () => {
    const result = extractMetadataFromHtml(metadataRichHtml, 'https://example.test/articles/one');
    expect(result.title).toMatchObject({ value: 'A thoughtful article', source: 'open_graph' });
    expect(result.description.value).toBe('A short Open Graph description.');
    expect(result.previewImageUrl.value).toBe('https://example.test/preview.jpg');
    expect(result.faviconUrl.value).toBe('https://example.test/favicon.png');
  });

  it('falls back through HTML metadata and standard favicon', () => {
    const result = extractMetadataFromHtml(metadataPartialHtml, 'https://example.test/path');
    expect(result.title).toMatchObject({ value: 'Only a title', source: 'html_title' });
    expect(result.description.value).toBeNull();
    expect(result.faviconUrl).toMatchObject({
      value: 'https://example.test/favicon.ico',
      source: 'favicon_fallback',
    });
  });

  it('uses the final permitted redirect URL to resolve metadata', async () => {
    const service = new MetadataService(
      {
        capture: async () => {
          throw new AppError(422, 'media_unavailable', 'fixture image unavailable');
        },
      },
      async () => ({
        finalUrl: 'https://final.example/articles/one',
        contentType: 'text/html',
        bytes: new TextEncoder().encode(metadataRichHtml),
        status: 200,
      }),
    );
    const result = await service.preview(1, 'https://start.example/redirect');
    expect(result.finalUrl).toBe('https://final.example/articles/one');
    expect(result.title).toMatchObject({ value: 'A thoughtful article', source: 'open_graph' });
  });

  it('returns an editable host fallback after a timeout', async () => {
    const service = new MetadataService(
      {
        capture: async () => {
          throw new Error('not called');
        },
      },
      async () => {
        throw new AppError(422, 'remote_timeout', 'The destination took too long to respond.');
      },
    );
    const result = await service.preview(1, 'https://slow.example/article');
    expect(result.title).toMatchObject({ value: 'slow.example', source: 'host_fallback', fallback: true });
    expect(result.description.value).toBeNull();
    expect(result.warnings[0]).toMatchObject({ code: 'remote_timeout' });
  });
});
