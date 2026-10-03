import type { CreateBookmark, UpdateBookmark } from '@bookmark/contracts';
import { normalizeUrl } from '../capture/url-policy.js';
import { BookmarkRepository } from '../db/bookmark-repository.js';
export class BookmarkService { constructor(public repo:BookmarkRepository){}
  create(input:CreateBookmark){const normalized=normalizeUrl(input.url);const existing=this.repo.byUrl(normalized);if(existing){const e:any=new Error('This address is already saved.');e.statusCode=409;e.code='DUPLICATE_BOOKMARK';e.existingBookmarkId=existing.id;throw e;}return this.repo.create(input,normalized);}
  update(id:string,input:UpdateBookmark){if(input.url)input={...input,url:normalizeUrl(input.url)};const found=this.repo.update(id,input);if(!found){const e:any=new Error('Bookmark not found');e.statusCode=404;throw e;}return found;}
}
