import { api } from '../../app/api';
export interface ImportPreviewData{id:string;format:'browser-html'|'complete-json';status:string;totalCount:number;newCount:number;duplicateCount:number;invalidCount:number;issues:string[];expiresAt:string}
export const previewImport=(file:File)=>{const data=new FormData();data.append('file',file);return api<ImportPreviewData>('/imports/preview',{method:'POST',body:data})};
export const commitImport=(id:string)=>api<ImportPreviewData>(`/imports/${id}/commit`,{method:'POST'});
