import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Bookmark } from '../../../shared/api/types.js';
import { api } from '../../lib/api-client.js';
import { queryKeys } from '../../lib/query-keys.js';

export function ReadStatusButton({ bookmark,compact=false }: { bookmark:Pick<Bookmark,'id'|'toRead'>;compact?:boolean }) {
  const client=useQueryClient();const [status,setStatus]=useState(''); const mutation=useMutation({mutationFn:()=>api<Bookmark>(`/api/bookmarks/${bookmark.id}`,{method:'PATCH',body:JSON.stringify({toRead:!bookmark.toRead})}),onMutate:async()=>{await client.cancelQueries({queryKey:queryKeys.bookmark(bookmark.id)});const previous=client.getQueryData<Bookmark>(queryKeys.bookmark(bookmark.id));if(previous)client.setQueryData(queryKeys.bookmark(bookmark.id),{...previous,toRead:!bookmark.toRead});return{previous};},onError:(_error,_value,context)=>{if(context?.previous)client.setQueryData(queryKeys.bookmark(bookmark.id),context.previous);setStatus('The reading status could not be changed.');},onSuccess:(value)=>{client.setQueryData(queryKeys.bookmark(bookmark.id),value);setStatus(value.toRead?'Added to To Read.':'Marked as read.');},onSettled:()=>{client.invalidateQueries({queryKey:['bookmarks']}).then(()=>{if(location.pathname==='/to-read'){(document.querySelector('.bookmark-card a, h1') as HTMLElement|null)?.focus();}})}});
  return <><button className={`button ${compact?'quiet':''}`} onClick={()=>mutation.mutate()} disabled={mutation.isPending}>{bookmark.toRead?'Mark read':'To read'}</button><span className="sr-only" role="status">{status}</span></>;
}
