import type { LibraryQuery } from '../../shared/types/bookmark.ts';
import { comparisonText, normalizeBookmarkUrl, normalizeText } from '../../shared/url/normalize.ts';
import { BookmarkRepository, type BookmarkWrite } from '../repositories/bookmark-repository.ts';

export class NotFoundError extends Error {}
export class ConflictError extends Error { constructor(message:string, public existingBookmarkId?:string){super(message)} }

export class BookmarkService {
  constructor(private repo: BookmarkRepository) {}
  create(input:{url:string;title?:string;description?:string;tags:string[];favorite:boolean}) {
    const normalized=normalizeBookmarkUrl(input.url); const existing=this.repo.findByCanonical(normalized.canonicalUrl); if(existing) throw new ConflictError('This destination is already saved.',existing.id);
    return this.repo.create({ ...normalized, title:normalizeText(input.title||normalized.url), description:input.description?normalizeText(input.description):null, tags:input.tags, favorite:input.favorite });
  }
  get(id:string){const item=this.repo.get(id);if(!item)throw new NotFoundError('Bookmark not found.');return item;}
  list(query:LibraryQuery){
    const q=comparisonText(query.q); let items=this.repo.list().filter(b=>(query.view==='active') === !b.archivedAt);
    if(q) items=items.filter(b=>[b.title,b.url,b.description??'',...b.tags.map(t=>t.name)].some(v=>comparisonText(v).includes(q)));
    if(query.tags.length) items=items.filter(b=>query.tags.every(tag=>b.tags.some(t=>comparisonText(t.name)===comparisonText(tag))));
    if(query.favorite) items=items.filter(b=>b.favorite);
    items.sort(query.sort==='title'?(a,b)=>a.title.localeCompare(b.title,undefined,{sensitivity:'base'}):query.sort==='oldest'?(a,b)=>a.createdAt.localeCompare(b.createdAt):(a,b)=>b.createdAt.localeCompare(a.createdAt));
    return {items,total:items.length};
  }
  tags(view:'active'|'archived'){return this.repo.listTags(view)}
  update(id:string,input:{url?:string;title?:string;description?:string|null;tags?:string[];favorite?:boolean}){
    const write:Partial<BookmarkWrite>={...input}; if(input.url){const n=normalizeBookmarkUrl(input.url);const found=this.repo.findByCanonical(n.canonicalUrl);if(found&&found.id!==id)throw new ConflictError('This destination is already saved.',found.id);write.url=n.url;write.canonicalUrl=n.canonicalUrl;} if(input.title)write.title=normalizeText(input.title); if(input.description)write.description=normalizeText(input.description); const item=this.repo.update(id,write);if(!item)throw new NotFoundError('Bookmark not found.');return item;
  }
  archive(id:string){const current=this.get(id);if(current.archivedAt)throw new ConflictError('Bookmark is already archived.');return this.repo.setArchived(id,true)!}
  restore(id:string){const current=this.get(id);if(!current.archivedAt)throw new ConflictError('Bookmark is already active.');return this.repo.setArchived(id,false)!}
  delete(id:string){if(!this.repo.delete(id))throw new NotFoundError('Bookmark not found.')}
}
