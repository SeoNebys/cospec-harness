import type { BookmarkInput,BookmarkPatch } from '@bookmarks/shared';
import type { Config } from '../config.js';
import { BookmarkRepository } from '../repositories/bookmark-repository.js';
import { downloadMedia } from './media-service.js';
export class BookmarkService{constructor(public repo:BookmarkRepository,private config:Config){}
 async create(input:BookmarkInput){const item=this.repo.create(input);for(const [kind,url] of [['icon',input.metadataPreview?.iconCandidate],['preview',input.metadataPreview?.previewCandidate]] as const){if(url)try{const m=await downloadMedia(url,this.config);this.repo.saveMedia(item.id,kind,m.contentType,m.bytes,m.url)}catch{}}return this.repo.get(item.id)!}
 update(id:string,patch:BookmarkPatch){return this.repo.update(id,patch)}
}
