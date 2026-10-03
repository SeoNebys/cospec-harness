import type { BookmarkSummary } from '../../../shared/api/types.js';
import { BookmarkCard } from './BookmarkCard.js';
export function BookmarkList({items}:{items:BookmarkSummary[]}){return <div className="bookmark-grid">{items.map(bookmark=><BookmarkCard key={bookmark.id} bookmark={bookmark}/>)}</div>;}
