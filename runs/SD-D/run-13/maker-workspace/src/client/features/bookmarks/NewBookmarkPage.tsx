import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router';
import type { Bookmark } from '../../../shared/api/types.js';
import { api, ApiClientError } from '../../lib/api-client.js';
import { BookmarkForm, type BookmarkFormValue } from './BookmarkForm.js';

export function NewBookmarkPage(){const navigate=useNavigate();const client=useQueryClient();const mutation=useMutation({mutationFn:(value:BookmarkFormValue)=>api<Bookmark>('/api/bookmarks',{method:'POST',body:JSON.stringify(value)}),onSuccess:(bookmark)=>{client.invalidateQueries({queryKey:['bookmarks']});navigate(`/bookmarks/${bookmark.id}`,{state:{message:'Bookmark saved.'}});}});
  const save=async(value:BookmarkFormValue)=>{try{await mutation.mutateAsync(value);}catch(error){if(error instanceof ApiClientError&&error.status===409){const target=(error.payload as any).bookmark; if(target?.id){navigate(`/bookmarks/${target.id}`,{state:{message:`Already saved${target.archived?' in Archive':''}.`}});return;}}throw error;}};
  return <section className="page narrow" data-harness-ready="true"><Link className="back-link" to="/">← Back to bookmarks</Link><div className="page-heading"><div><p className="eyebrow">New bookmark</p><h1>Save something worth keeping</h1><p>Paste a link and we’ll fill in what we can. Everything stays editable.</p></div></div><BookmarkForm onSubmit={save} busy={mutation.isPending}/></section>;
}
