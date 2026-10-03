import { fetchPageMetadata } from "./fetch-page";
import { fetchIcon } from "./icons";
import { normalizeUrl } from "@/lib/bookmarks/url";
import { database } from "@/lib/db/connection";
import { migrate } from "@/lib/db/migrate";
import { nowIso } from "@/lib/time";

export async function previewMetadata(url:string) {
  const normalizedUrl=normalizeUrl(url);const db=database();migrate(db);const cached=db.prepare("SELECT * FROM metadata_cache WHERE url_normalized=? AND expires_at>?").get(normalizedUrl,nowIso()) as {title:string|null;description:string|null;icon_url:string|null}|undefined;
  if(cached){const missing=[] as string[];if(!cached.title)missing.push("title");if(!cached.description)missing.push("description");if(!cached.icon_url)missing.push("icon");return{requestedUrl:url,finalUrl:normalizedUrl,normalizedUrl,title:cached.title,description:cached.description,iconUrl:cached.icon_url,missing,cacheStatus:"hit"};}
  const result=await fetchPageMetadata(normalizedUrl); const iconUrl=await fetchIcon(result.iconCandidates);
  const missing=[] as string[]; if(!result.title)missing.push("title");if(!result.description)missing.push("description");if(!iconUrl)missing.push("icon");
  db.prepare("INSERT OR REPLACE INTO metadata_cache(url_normalized,status,title,description,icon_url,expires_at,created_at) VALUES(?,?,?,?,?,?,?)").run(normalizedUrl,"success",result.title,result.description,iconUrl,new Date(Date.now()+86400_000).toISOString(),nowIso());
  return {requestedUrl:url,finalUrl:result.finalUrl,normalizedUrl,title:result.title,description:result.description,iconUrl,missing,cacheStatus:"miss"};
}
