"use client";
import { deleteAction } from "@/app/actions";
export function DeleteButton({id,title}:{id:string;title:string}){return <button className="danger" type="button" onClick={()=>{if(confirm(`Permanently delete “${title}”? This cannot be undone.`))void deleteAction(id);}}>Permanently delete</button>}
