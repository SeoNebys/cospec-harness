import { beforeEach,describe,expect,it } from "vitest";
import { randomUUID } from "node:crypto";
import { sqlite } from "@/lib/server/db/connection";
import { listBookmarks } from "@/lib/server/bookmarks";

beforeEach(()=>sqlite.exec("DELETE FROM bookmark_tags; DELETE FROM tags; DELETE FROM bookmarks;"));
describe("collection scale",()=>{it("returns a known match from 1,000 bookmarks within one second",()=>{const insert=sqlite.prepare("INSERT INTO bookmarks(id,url,normalized_url,title,description,created_at,updated_at) VALUES(?,?,?,?,?,?,?)");sqlite.transaction(()=>{for(let i=0;i<1000;i++)insert.run(randomUUID(),`https://example.com/${i}`,`https://example.com/${i}`,i===777?"Needle bookmark":`Bookmark ${i}`,null,Date.now()+i,Date.now()+i);})();const start=performance.now();const results=listBookmarks("needle","");expect(results).toHaveLength(1);expect(performance.now()-start).toBeLessThan(1000);});});
