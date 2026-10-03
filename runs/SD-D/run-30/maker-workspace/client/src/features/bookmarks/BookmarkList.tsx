import type { Bookmark } from '@bookmarks/shared';import { BookmarkCard } from './BookmarkCard';
export function BookmarkList({items,onPatch}:{items:Bookmark[];onPatch:(id:string,p:Record<string,boolean>)=>void}){return <div className="bookmark-list">{items.map(item=><BookmarkCard key={item.id} bookmark={item} onPatch={onPatch}/>)}</div>}
