import type {Bookmark} from '../api/types.ts';import { BookmarkCard } from './BookmarkCard.tsx';
export function BookmarkList({items,...actions}:{items:Bookmark[];onEdit:(b:Bookmark)=>void;onArchive:(b:Bookmark)=>void;onRestore:(b:Bookmark)=>void;onDelete:(b:Bookmark)=>void}){return <div className="bookmark-grid">{items.map(item=><BookmarkCard key={item.id} item={item} {...actions}/>)}</div>}
