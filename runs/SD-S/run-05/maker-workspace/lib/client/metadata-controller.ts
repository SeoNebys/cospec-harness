import type { MetadataPreview } from "@/lib/contracts/metadata";

export class MetadataController {
  private sequence=0; private abort?:AbortController;
  cancel(){this.sequence++;this.abort?.abort();}
  async run(url:string,request:(signal:AbortSignal)=>Promise<MetadataPreview>){
    this.cancel(); const id=this.sequence; this.abort=new AbortController();
    const result=await request(this.abort.signal); return id===this.sequence?result:null;
  }
}
