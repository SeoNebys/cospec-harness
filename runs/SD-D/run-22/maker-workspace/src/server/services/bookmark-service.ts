import type { BookmarkInput, BookmarkPatch, ReadingStateInput } from '../../shared/contracts/api.js';
import type { AppConfig } from '../config.js';
import { safeIconPath } from '../metadata/icon-cache.js';
import { fallbackTitle, normalizeBookmarkUrl } from '../metadata/url-policy.js';
import type { BookmarkRepository } from '../repositories/bookmark-repository.js';
import path from 'node:path';

export class BookmarkService {
  constructor(private readonly repository: BookmarkRepository, private readonly config: AppConfig) {}
  create(input: BookmarkInput) {
    const normalized=normalizeBookmarkUrl(input.url);
    const title=input.title.trim() || fallbackTitle(input.url);
    const icon=input.iconToken && safeIconPath(this.config.ICON_CACHE_PATH,input.iconToken) ? path.basename(input.iconToken) : null;
    return this.repository.create({...input,title},normalized,icon);
  }
  update(id:string,patch:BookmarkPatch) {
    const normalized=patch.url ? normalizeBookmarkUrl(patch.url) : undefined;
    const icon=patch.iconToken === undefined ? undefined : patch.iconToken && safeIconPath(this.config.ICON_CACHE_PATH,patch.iconToken) ? path.basename(patch.iconToken) : null;
    const clean={...patch}; delete clean.iconToken;
    return this.repository.update(id,clean,normalized,icon);
  }
  reading(id:string,state:ReadingStateInput){return this.repository.updateReadingState(id,state);}
  delete(id:string){return this.repository.delete(id);}
}
