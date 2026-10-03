import { randomUUID } from 'node:crypto';
import type { MetadataProposal } from '@shared/contracts.js';
import { AppError } from '@shared/errors.js';
import { urlKey } from '@shared/url.js';
import type { BookmarkRepository } from '../bookmarks/bookmark-repository.js';
import type { IconRepository } from '../icons/icon-repository.js';
import { normalizeIcon } from '../icons/icon-normalizer.js';
import { parseMetadata } from './metadata-parser.js';
import { ProposalStore } from './proposal-store.js';
import { safeFetch } from './safe-fetch.js';
export class MetadataService {
  constructor(
    private bookmarks: BookmarkRepository,
    private icons: IconRepository,
    private proposals: ProposalStore
  ) {}
  async preview(input: string): Promise<MetadataProposal> {
    const requestId = randomUUID(),
      url = urlKey(input);
    const duplicate = this.bookmarks.findByUrl(url);
    if (duplicate)
      return {
        requestId,
        url,
        title: null,
        description: null,
        iconUrl: null,
        status: 'complete',
        duplicate: { id: duplicate.id, title: duplicate.displayLabel }
      };
    try {
      const page = await safeFetch(url);
      if (!/html|xhtml/i.test(page.contentType))
        throw new AppError(422, 'METADATA_UNAVAILABLE', 'The address did not return an HTML page.');
      const parsed = parseMetadata(page.body, page.url);
      let iconAssetId: string | null = null;
      const candidate = parsed.icons[0]?.href ?? new URL('/favicon.ico', page.url).href;
      try {
        const response = await safeFetch(candidate, 'image/png,image/webp,image/x-icon,image/*');
        iconAssetId = this.icons.put(await normalizeIcon(response.body));
      } catch {}
      const token = this.proposals.put({
        url,
        title: parsed.title,
        description: parsed.description,
        iconAssetId
      });
      return {
        requestId,
        url,
        title: parsed.title,
        description: parsed.description,
        iconUrl: iconAssetId ? `/api/icons/${iconAssetId}` : null,
        proposalToken: token,
        status: parsed.title || parsed.description || iconAssetId ? 'complete' : 'partial',
        message:
          parsed.title || parsed.description || iconAssetId
            ? undefined
            : 'No page details were found; you can still save it.'
      };
    } catch (e) {
      const blocked = e instanceof AppError && e.code === 'METADATA_BLOCKED';
      return {
        requestId,
        url,
        title: null,
        description: null,
        iconUrl: null,
        status: blocked ? 'blocked' : 'unavailable',
        message: blocked
          ? 'This address is not safe to fetch. You can still save it manually.'
          : 'Page details could not be retrieved. You can still save it manually.'
      };
    }
  }
  consume(token: string | undefined, url: string) {
    return this.proposals.take(token, urlKey(url));
  }
}
