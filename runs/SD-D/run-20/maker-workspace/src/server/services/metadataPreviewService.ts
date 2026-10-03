import { randomUUID } from 'node:crypto';
import type { AppDatabase } from '../db/connection.js';
import { decodeHtml, extractMetadata } from '../metadata/extractMetadata.js';
import type { MediaStore } from '../metadata/mediaStore.js';
import type { RestrictedTransport } from '../metadata/restrictedFetch.js';
import { BlockedAddressError } from '../metadata/addressPolicy.js';
import type { MetadataPreviewRepository, PreviewRow } from '../repositories/metadataPreviewRepository.js';
import { normalizeUrl } from './url.js';

export interface MetadataWarning {
  code: string;
  message: string;
}

export class MetadataPreviewService {
  constructor(
    private db: AppDatabase,
    private repository: MetadataPreviewRepository,
    private media: MediaStore,
    private fetcher: RestrictedTransport,
  ) {}
  async create(input: string): Promise<ReturnType<MetadataPreviewService['toDto']>> {
    const normalized = normalizeUrl(input);
    const duplicate = this.db
      .prepare('SELECT public_id FROM bookmarks WHERE normalized_url=?')
      .get(normalized.normalizedUrl) as { public_id: string } | undefined;
    if (duplicate)
      throw Object.assign(new Error('This address is already saved.'), {
        statusCode: 409,
        code: 'DUPLICATE_BOOKMARK',
        existingBookmarkId: duplicate.public_id,
      });
    const created = new Date();
    const expires = new Date(created.getTime() + 15 * 60_000);
    let title = normalized.fallbackTitle;
    let description: string | null = null;
    let finalUrl: string | null = null;
    let iconId: number | null = null;
    let imageId: number | null = null;
    let status: PreviewRow['status'] = 'fallback';
    const warnings: MetadataWarning[] = [];
    try {
      const response = await this.fetcher(normalized.url);
      finalUrl = response.url;
      if (
        response.statusCode < 200 ||
        response.statusCode >= 400 ||
        !response.contentType.toLowerCase().includes('html')
      )
        throw new Error('CONTENT_UNSUPPORTED');
      const extracted = extractMetadata(decodeHtml(response.body, response.contentType), response.url);
      if (extracted.title) title = extracted.title;
      else
        warnings.push({
          code: 'TITLE_FALLBACK',
          message: 'No page title was found, so a useful title was made from the address.',
        });
      description = extracted.description;
      if (!description)
        warnings.push({
          code: 'DESCRIPTION_UNAVAILABLE',
          message: 'This page did not provide a description.',
        });
      const [icon, image] = await Promise.all([
        extracted.iconUrl ? this.media.cache(extracted.iconUrl, expires.toISOString()) : null,
        extracted.previewImageUrl ? this.media.cache(extracted.previewImageUrl, expires.toISOString()) : null,
      ]);
      iconId = icon?.id ?? null;
      imageId = image?.id ?? null;
      if (!icon) warnings.push({ code: 'ICON_UNAVAILABLE', message: 'A site icon could not be cached.' });
      if (!image) warnings.push({ code: 'IMAGE_UNAVAILABLE', message: 'A preview image was not available.' });
      status = warnings.length ? 'partial' : 'complete';
    } catch (error) {
      const code =
        error instanceof BlockedAddressError
          ? 'FETCH_BLOCKED'
          : error instanceof Error && ['RESPONSE_TOO_LARGE', 'CONTENT_UNSUPPORTED'].includes(error.message)
            ? error.message
            : error instanceof Error &&
                (error.name === 'TimeoutError' ||
                  error.name === 'AbortError' ||
                  error.message === 'FETCH_TIMEOUT')
              ? 'FETCH_TIMEOUT'
              : 'FETCH_FAILED';
      warnings.push({
        code,
        message:
          code === 'FETCH_BLOCKED'
            ? 'This page could not be fetched because its address is not public.'
            : code === 'FETCH_TIMEOUT'
              ? 'The page took too long to answer. You can still save it.'
              : 'Page details could not be retrieved. You can still save this address.',
      });
      warnings.push({
        code: 'TITLE_FALLBACK',
        message: 'A title was made from the address and can be edited.',
      });
      status = error instanceof BlockedAddressError ? 'skipped' : 'fallback';
    }
    const row = this.repository.create({
      public_id: randomUUID(),
      requested_url: normalized.url,
      normalized_url: normalized.normalizedUrl,
      final_response_url: finalUrl,
      title,
      description,
      icon_asset_id: iconId,
      preview_asset_id: imageId,
      status,
      warnings_json: JSON.stringify(warnings),
      created_at: created.toISOString(),
      expires_at: expires.toISOString(),
    });
    return this.toDto(row);
  }
  toDto(row: PreviewRow) {
    return {
      id: row.public_id,
      url: row.requested_url,
      normalizedUrl: row.normalized_url,
      title: row.title,
      description: row.description,
      iconUrl: row.icon_public_id ? `/api/media/${row.icon_public_id}` : null,
      previewImageUrl: row.preview_public_id ? `/api/media/${row.preview_public_id}` : null,
      status: row.status,
      warnings: JSON.parse(row.warnings_json) as MetadataWarning[],
      expiresAt: row.expires_at,
    };
  }
}
