import type { MetadataField, MetadataSource } from '../../shared/contracts/metadata.js';
import { AppError } from '../api/errors.js';
import type { MediaService } from '../media/media-service.js';
import { fetchHtml } from './safe-fetch.js';
import { extractMetadataFromHtml } from './metadata-extractor.js';

type MediaSummary = { id: string; url: string };

export type MetadataPreview = {
  requestedUrl: string;
  finalUrl: string;
  title: MetadataField<string>;
  description: MetadataField<string>;
  favicon: MetadataField<MediaSummary>;
  previewImage: MetadataField<MediaSummary>;
  warnings: Array<{ field: string; code: string; message: string }>;
};

function fallback(input: string, code: string, message: string): MetadataPreview {
  const url = new URL(input);
  return {
    requestedUrl: input,
    finalUrl: input,
    title: { value: url.hostname, source: 'host_fallback', fallback: true },
    description: { value: null, source: 'meta_description' },
    favicon: { value: null, source: 'favicon_fallback' },
    previewImage: { value: null, source: 'open_graph' },
    warnings: [{ field: 'metadata', code, message }],
  };
}

export class MetadataService {
  constructor(
    private readonly media: Pick<MediaService, 'capture'>,
    private readonly fetchPage: typeof fetchHtml = fetchHtml,
  ) {}

  async preview(userId: number, requestedUrl: string): Promise<MetadataPreview> {
    let page;
    try {
      page = await this.fetchPage(requestedUrl);
    } catch (error) {
      if (error instanceof AppError && ['invalid_url', 'unsafe_destination'].includes(error.code))
        throw error;
      if (error instanceof AppError) return fallback(requestedUrl, error.code, error.message);
      return fallback(
        requestedUrl,
        'remote_unavailable',
        'The page could not be reached. Fill in details manually.',
      );
    }
    const extracted = extractMetadataFromHtml(new TextDecoder().decode(page.bytes), page.finalUrl);
    const warnings: MetadataPreview['warnings'] = [];

    const capture = async (
      field: 'favicon' | 'previewImage',
      purpose: 'favicon' | 'preview',
      value: string | null,
      source: MetadataSource,
    ): Promise<MetadataField<MediaSummary>> => {
      if (!value) return { value: null, source };
      try {
        const media = await this.media.capture(userId, purpose, value);
        return { value: { id: media.publicId, url: `/api/media/${media.publicId}` }, source };
      } catch (error) {
        warnings.push({
          field,
          code: error instanceof AppError ? error.code : 'media_unavailable',
          message: `${field === 'favicon' ? 'The site icon' : 'The preview image'} could not be saved.`,
        });
        return { value: null, source };
      }
    };

    const [favicon, previewImage] = await Promise.all([
      capture('favicon', 'favicon', extracted.faviconUrl.value, extracted.faviconUrl.source),
      capture('previewImage', 'preview', extracted.previewImageUrl.value, extracted.previewImageUrl.source),
    ]);

    if (!extracted.description.value) {
      warnings.push({
        field: 'description',
        code: 'metadata_missing',
        message: 'No page description was found.',
      });
    }
    if (!previewImage.value) {
      warnings.push({
        field: 'previewImage',
        code: 'metadata_missing',
        message: 'No usable preview image was found.',
      });
    }
    return {
      requestedUrl,
      finalUrl: page.finalUrl,
      title: extracted.title,
      description: extracted.description,
      favicon,
      previewImage,
      warnings,
    };
  }
}
