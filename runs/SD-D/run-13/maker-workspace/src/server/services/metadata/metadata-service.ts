import type { BookmarkDatabase } from '../../db/connection.js';
import { BookmarkRepository } from '../../db/repositories/bookmark-repository.js';
import { MediaRepository } from '../../db/repositories/media-repository.js';
import { MetadataDraftRepository } from '../../db/repositories/metadata-draft-repository.js';
import { LIMITS } from '../../../shared/config/limits.js';
import { normalizeUrl } from '../../../shared/urls/normalize-url.js';
import { guardedFetch } from './guarded-fetch.js';
import { extractMetadata } from './extract-metadata.js';
import { processImage } from '../../media/process-image.js';
import { MetadataFetchError, type MetadataWarning } from './metadata-errors.js';

let activeRetrievals = 0;

export class MetadataService {
  private bookmarks: BookmarkRepository; private media: MediaRepository; private drafts: MetadataDraftRepository;
  constructor(private readonly db: BookmarkDatabase) { this.bookmarks = new BookmarkRepository(db); this.media = new MediaRepository(db); this.drafts = new MetadataDraftRepository(db); }

  async inspect(url: string, signal?: AbortSignal) {
    let normalized: string;
    try { normalized = normalizeUrl(url); } catch (error) { return Promise.reject(Object.assign(error as Error, { validation: true })); }
    const duplicate = this.bookmarks.findDuplicate(normalized);
    if (duplicate) return { kind: 'existing' as const, bookmark: duplicate };
    if (activeRetrievals >= LIMITS.metadataConcurrency) throw Object.assign(new Error('Metadata retrieval is busy. Please try again.'), { rateLimited: true });
    activeRetrievals++;
    try {
      let page;
      try { page = await guardedFetch(url, { signal }); }
      catch (error) {
        const warning = error instanceof MetadataFetchError ? error.warning : 'unreachable';
        return { kind: 'metadata' as const, status: 'unavailable' as const, draftId: null, finalUrl: null, title: null, description: null, iconUrl: null, previewImageUrl: null, warnings: [warning] };
      }
      if (!page.contentType.includes('text/html') && !page.contentType.includes('application/xhtml+xml')) {
        return { kind: 'metadata' as const, status: 'unavailable' as const, draftId: null, finalUrl: page.finalUrl, title: null, description: null, iconUrl: null, previewImageUrl: null, warnings: ['unsupported_content'] };
      }
      const extracted = extractMetadata(page.body, page.finalUrl); const warnings = [...extracted.warnings] as MetadataWarning[];
      const retrieveAsset = async (assetUrl: string | null, kind: 'icon' | 'preview') => {
        if (!assetUrl) return null;
        try {
          const fetched = await guardedFetch(assetUrl, { maxBytes: kind === 'icon' ? LIMITS.iconInputBytes : LIMITS.previewInputBytes, signal });
          const asset = await processImage(fetched.body, kind); this.media.put(asset); return asset.id;
        } catch { if (!warnings.includes(kind === 'icon' ? 'missing_icon' : 'missing_preview')) warnings.push(kind === 'icon' ? 'missing_icon' : 'missing_preview'); return null; }
      };
      const [iconAssetId, previewAssetId] = await Promise.all([retrieveAsset(extracted.iconUrl, 'icon'), retrieveAsset(extracted.previewUrl, 'preview')]);
      const draft = this.drafts.create({ normalizedUrl: normalized, sourceUrl: url.trim(), finalUrl: page.finalUrl, title: extracted.title, description: extracted.description, iconAssetId, previewAssetId, warnings });
      const status = extracted.title || extracted.description || iconAssetId || previewAssetId ? (warnings.length ? 'partial' : 'complete') : 'unavailable';
      return { kind: 'metadata' as const, status, draftId: draft.id, finalUrl: page.finalUrl, title: draft.title, description: draft.description,
        iconUrl: iconAssetId ? `/api/metadata/drafts/${draft.id}/icon` : null, previewImageUrl: previewAssetId ? `/api/metadata/drafts/${draft.id}/preview` : null, warnings };
    } finally { activeRetrievals--; }
  }
}
