import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client.js';
import { ConfirmDeleteDialog } from '../../components/ConfirmDeleteDialog.js';
export function DeleteBookmarkButton({id,title,onDone,compact=false}:{id:string;title:string;onDone:()=>void;compact?:boolean}){const client=useQueryClient();const mutation=useMutation({mutationFn:()=>api(`/api/bookmarks/${id}`,{method:'DELETE'}),onSuccess:()=>{client.invalidateQueries();onDone();}});return <ConfirmDeleteDialog title={title} compact={compact} onConfirm={async()=>{await mutation.mutateAsync();}}/>;}
