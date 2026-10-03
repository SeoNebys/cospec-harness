import { useState } from "react";
import type { Bookmark } from "../../../shared/contracts/bookmarks.js";
import { bookmarkApi } from "./bookmark-api.js";

export function useBookmarkMutations(onChange:(bookmark:Bookmark)=>void,onRemove:(id:number)=>void) {
  const [message,setMessage]=useState("");
  async function favorite(bookmark:Bookmark){onChange({...bookmark,isFavorite:!bookmark.isFavorite});try{onChange(await bookmarkApi.favorite(bookmark.id,!bookmark.isFavorite));}catch{onChange(bookmark);setMessage("Favorite change didn’t save.");}}
  async function remove(id:number){await bookmarkApi.remove(id);onRemove(id);setMessage("Bookmark deleted.");}
  async function retry(bookmark:Bookmark){onChange({...bookmark,metadataStatus:"pending"});try{await bookmarkApi.retry(bookmark.id);setMessage("Refreshing page details…");setTimeout(()=>{void bookmarkApi.get(bookmark.id).then(onChange).catch(()=>undefined);},5_000);}catch{onChange(bookmark);setMessage("Couldn’t refresh page details.");}}
  return {favorite,remove,retry,message,setMessage};
}
