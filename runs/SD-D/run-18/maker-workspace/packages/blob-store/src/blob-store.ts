import { createHash } from 'node:crypto';
import { mkdir,rename,writeFile,access,readFile,unlink } from 'node:fs/promises';
import path from 'node:path';
export class BlobStore{
  constructor(public root:string,public tmp:string){}
  async init(){await mkdir(this.root,{recursive:true,mode:0o700});await mkdir(this.tmp,{recursive:true,mode:0o700})}
  file(digest:string){if(!/^[a-f0-9]{64}$/.test(digest))throw new Error('Invalid blob identifier');return path.join(this.root,digest.slice(0,2),digest)}
  async put(bytes:Buffer){const digest=createHash('sha256').update(bytes).digest('hex'),dest=this.file(digest);await mkdir(path.dirname(dest),{recursive:true,mode:0o700});try{await access(dest)}catch{const staged=path.join(this.tmp,`${crypto.randomUUID()}.stage`);await writeFile(staged,bytes,{mode:0o600});await rename(staged,dest)}return {digest,path:dest,size:bytes.length}}
  async get(digest:string){return readFile(this.file(digest))}
  async remove(digest:string){try{await unlink(this.file(digest))}catch{/* Already absent: GC is idempotent. */}}
}
