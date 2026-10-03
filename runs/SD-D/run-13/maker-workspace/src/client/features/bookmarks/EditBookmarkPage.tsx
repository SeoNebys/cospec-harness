import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import type { Bookmark } from '../../../shared/api/types.js';
import { api, ApiClientError } from '../../lib/api-client.js';
import { queryKeys } from '../../lib/query-keys.js';
import { BookmarkForm, type BookmarkFormValue } from './BookmarkForm.js';

export function EditBookmarkPage(){const {id=''}=useParams();const navigate=useNavigate();const client=useQueryClient();const query=useQuery({queryKey:queryKeys.bookmark(id),queryFn:()=>api<Bookmark>(`/api/bookmarks/${id}`)});const mutation=useMutation({mutationFn:(value:BookmarkFormValue)=>api<Bookmark>(`/api/bookmarks/${id}`,{method:'PATCH',body:JSON.stringify(value)}),onSuccess:(bookmark)=>{client.setQueryData(queryKeys.bookmark(id),bookmark);client.invalidateQueries({queryKey:['bookmarks']});navigate(`/bookmarks/${id}`,{state:{message:'Changes saved.'}});}});
  const save=async(value:BookmarkFormValue)=>{try{await mutation.mutateAsync(value);}catch(error){if(error instanceof ApiClientError&&error.status===409){const target=(error.payload as any).bookmark;if(target?.id){navigate(`/bookmarks/${target.id}`,{state:{message:'That address is already saved here.'}});return;}}throw error;}};
  if(query.isLoading)return <section className="page loading">Loading bookmark…</section>;if(!query.data)return <section className="page"><h1>Bookmark not found</h1><Link to="/">Return to bookmarks</Link></section>;
  return <section className="page narrow" data-harness-ready="true"><Link className="back-link" to={`/bookmarks/${id}`}>← Back to bookmark</Link><div className="page-heading"><div><p className="eyebrow">Edit bookmark</p><h1>Update the details</h1></div></div><BookmarkForm bookmark={query.data} onSubmit={save} submitLabel="Save changes" busy={mutation.isPending}/></section>;
}
