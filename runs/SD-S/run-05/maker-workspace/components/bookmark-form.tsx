"use client";
import { useEffect,useRef,useState } from "react";
import type { Bookmark, BookmarkInput } from "@/lib/contracts/bookmark";
import { api } from "@/lib/client/api";
import { MetadataController } from "@/lib/client/metadata-controller";
import { StatusMessage } from "./status-message";
import { TagInput } from "./tag-input";

const blank={url:"",title:"",description:"",tags:""};
export function BookmarkForm({editing,onSaved,onCancel}:{editing:Bookmark|null;onSaved:(b:Bookmark)=>void;onCancel:()=>void}){
  const [form,setForm]=useState(()=>editing?{url:editing.url,title:editing.title,description:editing.description??"",tags:editing.tags.join(", ")}:blank),[status,setStatus]=useState(""),[tone,setTone]=useState<"info"|"success"|"error">("info"),[saving,setSaving]=useState(false);
  const dirty=useRef({title:false,description:false}), timer=useRef<ReturnType<typeof setTimeout>|null>(null), controller=useRef(new MetadataController());
  useEffect(()=>()=>{controller.current.cancel();if(timer.current)clearTimeout(timer.current);},[]);
  function setField(field:keyof typeof blank,value:string,user=true){setForm(old=>({...old,[field]:value}));if(user&&(field==="title"||field==="description"))dirty.current[field]=true;}
  function changeUrl(value:string){
    setField("url",value); dirty.current={title:false,description:false}; controller.current.cancel(); if(timer.current)clearTimeout(timer.current);
    setForm(old=>({...old,url:value,title:"",description:""})); setStatus("");
    try{const u=new URL(value.trim());if(!["http:","https:"].includes(u.protocol))return;}catch{return;}
    timer.current=setTimeout(async()=>{setStatus("Looking up the page title and description…");setTone("info");try{
      const result=await controller.current.run(value,signal=>api.preview(value,signal));if(!result)return;
      setForm(old=>({...old,title:dirty.current.title?old.title:(result.title??value.trim()).slice(0,300),description:dirty.current.description?old.description:(result.description??"")}));
      if(result.status==="complete"){setTone("success");setStatus("Page details added. You can edit anything before saving.");}
      else{setTone("info");setStatus("We couldn't get every detail. You can fill in or edit the fields and still save.");}
    }catch(e){if((e as Error).name!=="AbortError"){setForm(old=>({...old,title:dirty.current.title?old.title:(old.title||value.trim()).slice(0,300)}));setTone("error");setStatus("We couldn't reach that page. You can still edit the details and save it.");}}},450);
  }
  async function submit(e:React.FormEvent){e.preventDefault();setSaving(true);setStatus("");try{
    const input:BookmarkInput={url:form.url,title:(form.title||form.url).trim().slice(0,300),description:form.description.trim()||null,tags:form.tags.split(",").map(t=>t.trim()).filter(Boolean)};
    const saved=editing?await api.update(editing.id,input):await api.create(input);controller.current.cancel();setTone("success");setStatus(editing?"Bookmark updated.":"Bookmark saved.");setForm(blank);dirty.current={title:false,description:false};onSaved(saved);
  }catch(error){setTone("error");setStatus((error as Error).message);}finally{setSaving(false);}}
  return <section className="composer" aria-labelledby="form-heading">
    <div className="section-kicker">{editing?"Make it accurate":"Keep something good"}</div>
    <h2 id="form-heading">{editing?"Edit bookmark":"Save a new bookmark"}</h2>
    <p className="section-lede">Paste a link and we’ll bring in the useful details. Everything stays editable.</p>
    <form onSubmit={submit}>
      <div className="field url-field"><label htmlFor="url">Web address</label><div className="url-wrap"><span aria-hidden="true">↗</span><input id="url" type="url" required value={form.url} onChange={e=>changeUrl(e.target.value)} placeholder="https://example.com/article" autoComplete="url"/></div></div>
      <div className="two-columns"><div className="field"><label htmlFor="title">Title</label><input id="title" required maxLength={300} value={form.title} onChange={e=>setField("title",e.target.value)} placeholder="Filled in from the page"/></div><TagInput value={form.tags} onChange={v=>setField("tags",v)}/></div>
      <div className="field"><label htmlFor="description">Short description <span>{form.description.length}/300</span></label><textarea id="description" maxLength={300} rows={3} value={form.description} onChange={e=>setField("description",e.target.value)} placeholder="A quick note about why this is worth keeping"/></div>
      <StatusMessage tone={tone}>{status}</StatusMessage>
      <div className="form-actions"><button className="primary" disabled={saving}>{saving?"Saving…":editing?"Save changes":"Save bookmark"}</button>{editing&&<button type="button" className="quiet" onClick={onCancel}>Cancel</button>}<span className="privacy-note">Page details are fetched safely and never overwrite your edits.</span></div>
    </form>
  </section>;
}
