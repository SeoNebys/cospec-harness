import fs from "node:fs/promises";
import path from "node:path";
import { config } from "@/lib/config";
import { NextResponse } from "next/server";

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) { const {id}=await params; if(!/^[a-f0-9]{64}$/.test(id))return new NextResponse(null,{status:404}); try { const [body,type]=await Promise.all([fs.readFile(path.join(config.dataDir,"icons",id)),fs.readFile(path.join(config.dataDir,"icons",`${id}.type`),"utf8")]); return new NextResponse(body,{headers:{"content-type":type,"x-content-type-options":"nosniff","cache-control":"public,max-age=31536000,immutable"}}); } catch{return new NextResponse(null,{status:404});} }
