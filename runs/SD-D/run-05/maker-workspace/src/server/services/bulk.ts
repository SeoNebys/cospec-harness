import crypto from "node:crypto";
import { allMatchingIds, getBookmark, updateBookmark, deleteBookmark } from "@/server/services/bookmark-service";
import type { Criteria } from "@/lib/types";
type Action={type:"read"|"unread"|"archive"|"restore"|"delete"|"addTag"|"removeTag";tag?:string};
type Entry={ids:string[];action:Action;expires:number;criteria?:Criteria;excluded?:string[]};
const previews=new Map<string,Entry>();
export function previewBulk(input:{ids?:string[];criteria?:Criteria;excluded?:string[];action:Action}){
  let ids=input.ids??allMatchingIds(input.criteria!); ids=ids.filter(x=>!input.excluded?.includes(x)&&getBookmark(x));
  const token=crypto.randomUUID(); previews.set(token,{ids,action:input.action,expires:Date.now()+300_000,criteria:input.criteria,excluded:input.excluded});
  return{token,count:ids.length,irreversible:input.action.type==="delete"};
}
export function executeBulk(token:string){
  const p=previews.get(token); if(!p||p.expires<Date.now())return{error:"expired"};
  if(p.criteria){const current=allMatchingIds(p.criteria).filter(x=>!p.excluded?.includes(x)).sort(),old=[...p.ids].sort();if(current.length!==old.length||current.some((x,i)=>x!==old[i])){previews.delete(token);return{error:"stale_selection",...previewBulk({criteria:p.criteria,excluded:p.excluded,action:p.action})};}}
  previews.delete(token);let changed=0;
  for(const id of p.ids){const b=getBookmark(id);if(!b)continue;switch(p.action.type){case"delete":if(deleteBookmark(id))changed++;break;case"read":updateBookmark(id,{isRead:true});changed++;break;case"unread":updateBookmark(id,{isRead:false});changed++;break;case"archive":updateBookmark(id,{archived:true});changed++;break;case"restore":updateBookmark(id,{archived:false});changed++;break;case"addTag":updateBookmark(id,{tags:[...b.tags,p.action.tag!].filter(Boolean)});changed++;break;case"removeTag":updateBookmark(id,{tags:b.tags.filter(t=>t.toLowerCase()!==p.action.tag?.toLowerCase())});changed++;}}
  return{requested:p.ids.length,changed,failed:p.ids.length-changed};
}
