import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { config } from "@/lib/config";
import { guardedFetch } from "./transport";

const types:Record<string,string>={"89504e47":"image/png","47494638":"image/gif","ffd8ffe0":"image/jpeg","ffd8ffe1":"image/jpeg","00000100":"image/x-icon","52494646":"image/webp"};
export async function fetchIcon(candidates:string[]) {
  for(const candidate of candidates.slice(0,3)) {
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),5000);
    try {
      const {response,close}=await guardedFetch(candidate,controller.signal);
      try {
        if(!response.ok) continue; const declared=Number(response.headers.get("content-length")||0); if(declared>262144) continue;
        const bytes=Buffer.from(await response.arrayBuffer()); if(bytes.length>262144) continue;
        let type=types[bytes.subarray(0,4).toString("hex")];
        if(!type&&bytes.subarray(0,4).toString()==="RIFF"&&bytes.subarray(8,12).toString()==="WEBP") type="image/webp";
        if(!type) continue; const id=createHash("sha256").update(bytes).digest("hex"); const dir=path.join(config.dataDir,"icons"); await fs.mkdir(dir,{recursive:true});
        await fs.writeFile(path.join(dir,id),bytes,{flag:"wx"}).catch(e=>{if((e as NodeJS.ErrnoException).code!=="EEXIST") throw e;});
        await fs.writeFile(path.join(dir,`${id}.type`),type); return `/icons/${id}`;
      } finally { await close(); }
    } catch { /* try the next candidate */ } finally { clearTimeout(timer); }
  }
  return null;
}
