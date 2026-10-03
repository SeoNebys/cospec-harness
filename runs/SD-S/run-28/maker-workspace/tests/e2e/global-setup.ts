import fs from "node:fs";
import { createHash } from "node:crypto";

export default async function globalSetup(){
  const databasePath="/work/data/e2e.db";
  for(const suffix of ["","-shm","-wal"]){const file=`${databasePath}${suffix}`;if(fs.existsSync(file))fs.rmSync(file);}
  Object.assign(process.env,{DATABASE_PATH:databasePath,BETTER_AUTH_SECRET:"e2e-secret-that-is-at-least-thirty-two-bytes",APP_BASE_URL:"http://127.0.0.1:4000",TRUSTED_ORIGIN:"http://127.0.0.1:4000",MAIL_TRANSPORT:"memory"});
  const [{getDb},{migrate},{auth},{createBookmarkRecord},{normalizeBookmarkUrl}]=await Promise.all([import("@/lib/db/client"),import("@/lib/db/migrate"),import("@/lib/auth/server"),import("@/lib/bookmarks/repository"),import("@/lib/metadata/url")]);
  migrate(getDb());
  const signup=await auth.api.signUpEmail({body:{name:"Review User",email:"reviewer@example.com",password:"Review-Bookmark-2026!"}});
  const normalized=normalizeBookmarkUrl("https://example.com/isolation-fixture");
  const icon=Buffer.from("89504e470d0a1a0a","hex");
  createBookmarkRecord({userId:signup.user.id,url:normalized.storedUrl,hash:normalized.hash,fallbackTitle:normalized.fallbackTitle,metadata:{title:"Private isolation fixture",description:"Visible only to its owner",status:"complete",messageCode:null,icon:{id:createHash("sha256").update(icon).digest("hex"),mediaType:"image/png",content:icon}}},getDb());
}
