import type { AppDatabase } from "@/lib/db/client";
import { createBookmarkRecord } from "@/lib/bookmarks/repository";
import { normalizeBookmarkUrl } from "@/lib/metadata/url";

export function seedLargeLibrary(db:AppDatabase,userId:string):void{
  db.transaction(()=>{
    for(let index=0;index<10_000;index++){
      const url=normalizeBookmarkUrl(`https://example.com/items/${index}`);
      createBookmarkRecord({
        userId,
        url:url.storedUrl,
        hash:url.hash,
        fallbackTitle:url.fallbackTitle,
        metadata:{title:`Reference item ${index}`,description:index===9999?"singular needle phrase":null,status:"complete",messageCode:null},
        tags:[`group-${index%500}`],
      },db);
    }
    db.prepare("UPDATE bookmarks SET is_favorite=1 WHERE user_id=? AND rowid%10=0").run(userId);
  })();
}
