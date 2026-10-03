import { Link } from 'react-router';
import type { BookmarkSummary } from '../../../shared/api/types.js';
import { ReadStatusButton } from './ReadStatusButton.js';
import { ArchiveButton } from './ArchiveButton.js';
import { RestoreButton } from './RestoreButton.js';
import { DeleteBookmarkButton } from './DeleteBookmarkButton.js';

export function BookmarkCard({bookmark}:{bookmark:BookmarkSummary}){
  let host='';try{host=new URL(bookmark.url).hostname;}catch{host=bookmark.url;}
  return <article className="bookmark-card">
    <Link className="card-media" aria-label={`View ${bookmark.title}`} to={`/bookmarks/${bookmark.id}`}>{bookmark.previewAssetUrl?<img src={bookmark.previewAssetUrl} alt="" loading="lazy"/>:<span className="media-placeholder" aria-hidden="true">{bookmark.title.slice(0,1).toUpperCase()}</span>}</Link>
    <div className="card-body"><div className="card-heading">{bookmark.iconAssetUrl?<img className="site-icon" src={bookmark.iconAssetUrl} alt=""/>:<span className="site-icon-fallback" aria-hidden="true"/>}<div><Link to={`/bookmarks/${bookmark.id}`}><h2>{bookmark.title}</h2></Link><span className="host">{host}</span></div>{bookmark.favorite&&<span title="Favorite" aria-label="Favorite">★</span>}</div>
      {bookmark.description&&<p className="clamp">{bookmark.description}</p>}
      <div className="tag-row">{bookmark.tags.map(tag=><span className="tag" key={tag.id}>{tag.name}</span>)}</div>
      <div className="card-footer"><time dateTime={bookmark.updatedAt}>Updated {new Date(bookmark.updatedAt).toLocaleDateString()}</time><div className="card-actions">{bookmark.archivedAt?<RestoreButton id={bookmark.id}/>:<><ReadStatusButton bookmark={bookmark} compact/><ArchiveButton id={bookmark.id}/></>}<DeleteBookmarkButton compact id={bookmark.id} title={bookmark.title} onDone={()=>{(document.querySelector('.bookmark-card a, h1') as HTMLElement|null)?.focus();}}/></div></div>
    </div>
  </article>;
}
