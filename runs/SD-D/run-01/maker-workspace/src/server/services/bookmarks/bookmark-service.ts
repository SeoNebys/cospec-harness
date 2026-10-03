import { normalizeUrl } from '../../../shared/url/url-policy.js';
import { BookmarkRepository, type ListOptions } from '../../repositories/bookmark-repository.js';
import { PreviewStore } from '../metadata/preview-store.js';
import { parseSearchQuery } from './search-query.js';
import { transitionReadLater, type ReadLaterState } from './read-later-state.js';

export class BookmarkServiceError extends Error { constructor(public code:string,message:string,public status=400,public existingId?:string){super(message);} }
export interface BookmarkInput {url:string;title:string;description?:string;notes?:string;tags?:string[];isFavorite?:boolean;readLaterState?:ReadLaterState;previewToken?:string}

export class BookmarkService {
  constructor(private repository:BookmarkRepository,private previews:PreviewStore){}
  create(userId:string,input:BookmarkInput){const normalized=this.validate(input);const duplicate=this.repository.findByCanonical(userId,normalized.canonicalKey);if(duplicate)throw new BookmarkServiceError('DUPLICATE_BOOKMARK','You already saved this destination.',409,duplicate.id);
    const state=transitionReadLater({readLaterAddedAt:null,readAt:null},input.readLaterState??'none');
    const create:any={url:normalized.fetchUrl,canonicalKey:normalized.canonicalKey,title:input.title.trim(),description:input.description?.trim()??'',notes:input.notes?.trim()??'',tags:input.tags??[],isFavorite:Boolean(input.isFavorite),...state};const icon=this.previews.consume(userId,input.previewToken);if(icon)create.icon=icon;
    try{return this.repository.create(userId,create);}catch(error:any){if(String(error?.message).includes('UNIQUE')){const existing=this.repository.findByCanonical(userId,normalized.canonicalKey);throw new BookmarkServiceError('DUPLICATE_BOOKMARK','You already saved this destination.',409,existing?.id);}throw error;}}
  get(userId:string,id:string){const value=this.repository.get(userId,id);if(!value)throw new BookmarkServiceError('NOT_FOUND','Bookmark not found.',404);return value;}
  list(userId:string,options:ListOptions){let fts;try{fts=options.q?parseSearchQuery(options.q):undefined;}catch(error){throw new BookmarkServiceError('INVALID_SEARCH',error instanceof Error?error.message:'Invalid search.');}return this.repository.list(userId,options,fts);}
  update(userId:string,id:string,input:Partial<BookmarkInput>&{archived?:boolean}){const current=this.get(userId,id) as any;const values:any={};
    this.validate({url:input.url??current.url,title:input.title??current.title,description:input.description??current.description,notes:input.notes??current.notes,tags:input.tags??current.tags.map((tag:any)=>tag.name),isFavorite:input.isFavorite??current.isFavorite,readLaterState:input.readLaterState??current.readLaterState});
    if(input.url!==undefined){const normalized=normalizeUrl(input.url);const duplicate=this.repository.findByCanonical(userId,normalized.canonicalKey);if(duplicate&&duplicate.id!==id)throw new BookmarkServiceError('DUPLICATE_BOOKMARK','You already saved this destination.',409,duplicate.id);values.url=normalized.fetchUrl;values.canonicalKey=normalized.canonicalKey;}
    for(const key of ['title','description','notes','tags','isFavorite'] as const)if(input[key]!==undefined)values[key]=input[key];
    if(values.title!==undefined&&!String(values.title).trim())throw new BookmarkServiceError('VALIDATION_ERROR','Title is required.');
    if(input.readLaterState!==undefined)Object.assign(values,transitionReadLater({readLaterAddedAt:current.readLaterAddedAt,readAt:current.readAt},input.readLaterState));
    if(input.archived!==undefined)values.archivedAt=input.archived?new Date().toISOString():null;
    return this.repository.update(userId,id,values)!;}
  delete(userId:string,id:string){if(!this.repository.delete(userId,id))throw new BookmarkServiceError('NOT_FOUND','Bookmark not found.',404);}
  private validate(input:BookmarkInput){const normalized=normalizeUrl(input.url);const title=input.title?.trim();if(!title||Array.from(title).length>300)throw new BookmarkServiceError('VALIDATION_ERROR','Enter a title up to 300 characters.');if(Array.from(input.description??'').length>1000)throw new BookmarkServiceError('VALIDATION_ERROR','Description must be 1,000 characters or fewer.');if(Array.from(input.notes??'').length>5000)throw new BookmarkServiceError('VALIDATION_ERROR','Notes must be 5,000 characters or fewer.');if((input.tags?.length??0)>50)throw new BookmarkServiceError('VALIDATION_ERROR','Use no more than 50 tags.');if(input.readLaterState&&!['none','unread','read'].includes(input.readLaterState))throw new BookmarkServiceError('VALIDATION_ERROR','Choose a valid reading state.');return normalized;}
}
