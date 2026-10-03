import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import type { Bookmark } from '../../../shared/api/types.js';
import { api } from '../../lib/api-client.js';
import { queryKeys } from '../../lib/query-keys.js';
import { NoteRenderer } from '../notes/NoteRenderer.js';
import { StatusRegion } from '../../components/StatusRegion.js';
import { ReadStatusButton } from './ReadStatusButton.js';
import { ArchiveButton } from './ArchiveButton.js';
import { RestoreButton } from './RestoreButton.js';
import { DeleteBookmarkButton } from './DeleteBookmarkButton.js';
import { useEffect, useRef } from 'react';

export function BookmarkDetailPage(){const {id=''}=useParams();const navigate=useNavigate();const location=useLocation();const headingRef=useRef<HTMLHeadingElement>(null);const client=useQueryClient();const query=useQuery({queryKey:queryKeys.bookmark(id),queryFn:()=>api<Bookmark>(`/api/bookmarks/${id}`),retry:false});const favorite=useMutation({mutationFn:(next:boolean)=>api<Bookmark>(`/api/bookmarks/${id}`,{method:'PATCH',body:JSON.stringify({favorite:next})}),onMutate:async(next)=>{await client.cancelQueries({queryKey:queryKeys.bookmark(id)});const previous=client.getQueryData<Bookmark>(queryKeys.bookmark(id));if(previous)client.setQueryData(queryKeys.bookmark(id),{...previous,favorite:next});return{previous};},onError:(_error,_next,context)=>{if(context?.previous)client.setQueryData(queryKeys.bookmark(id),context.previous);},onSuccess:value=>client.setQueryData(queryKeys.bookmark(id),value),onSettled:()=>client.invalidateQueries({queryKey:['bookmarks']})});
  useEffect(()=>{if(query.data&&(location.state as {message?:string}|null)?.message)headingRef.current?.focus();},[location.state,query.data]);
  if(query.isLoading)return <section className="page loading">Loading bookmark…</section>;if(!query.data)return <section className="page"><h1>Bookmark not found</h1><p>It may have been permanently deleted.</p><Link to="/">Return to bookmarks</Link></section>;const bookmark=query.data;
  return <section className="page detail-page" data-harness-ready="true"><StatusRegion message={(location.state as any)?.message}/><Link className="back-link" to={bookmark.archivedAt?'/archive':'/'}>← Back to {bookmark.archivedAt?'Archive':'bookmarks'}</Link>
    {bookmark.previewAssetUrl&&<img className="detail-preview" src={bookmark.previewAssetUrl} alt=""/>}<div className="detail-header"><div>{bookmark.iconAssetUrl&&<img className="detail-icon" src={bookmark.iconAssetUrl} alt=""/>}<p className="eyebrow">{bookmark.archivedAt?'Archived bookmark':'Saved bookmark'}</p><h1 ref={headingRef} tabIndex={-1}>{bookmark.title}</h1></div><button className="favorite-button" aria-pressed={bookmark.favorite} onClick={()=>favorite.mutate(!bookmark.favorite)}>{bookmark.favorite?'★ Favorite':'☆ Add to favorites'}</button></div>
    <a className="destination" href={bookmark.url} target="_blank" rel="noopener noreferrer">Open original ↗</a>{bookmark.description&&<p className="lead">{bookmark.description}</p>}<div className="tag-row">{bookmark.tags.map(tag=><span className="tag" key={tag.id}>{tag.name}</span>)}</div>
    <dl className="timestamps"><div><dt>Added</dt><dd>{new Date(bookmark.createdAt).toLocaleString()}</dd></div><div><dt>Updated</dt><dd>{new Date(bookmark.updatedAt).toLocaleString()}</dd></div></dl>
    <section className="notes-section"><h2>Notes</h2>{bookmark.notes.content?.some(node=>node.content?.length||node.type==='text')?<NoteRenderer note={bookmark.notes}/>:<p className="muted">No notes yet.</p>}</section>
    <div className="detail-actions"><Link className="button" to={`/bookmarks/${id}/edit`}>Edit</Link>{bookmark.archivedAt?<RestoreButton id={id} onDone={()=>navigate('/')}/>:<><ReadStatusButton bookmark={bookmark}/><ArchiveButton id={id} onDone={()=>navigate('/archive')}/></>}<DeleteBookmarkButton id={id} title={bookmark.title} onDone={()=>navigate(bookmark.archivedAt?'/archive':'/')}/></div>
  </section>;
}
