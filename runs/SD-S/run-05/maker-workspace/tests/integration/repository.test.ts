import { beforeEach,describe,expect,it } from "vitest";
import { sqlite } from "@/lib/server/db/connection";
import { createBookmark,deleteBookmark,listBookmarks,listTags,updateBookmark } from "@/lib/server/bookmarks";

beforeEach(()=>{sqlite.exec("DELETE FROM bookmark_tags; DELETE FROM tags; DELETE FROM bookmarks;");});
describe("bookmark repository",()=>{
 it("creates, persists, searches, filters and updates tags case-insensitively",()=>{const a=createBookmark({url:"https://example.com/a",title:"Alpha",description:"Useful design note",tags:["Design"]});createBookmark({url:"https://example.com/b",title:"Beta",description:null,tags:["design","Later"]});expect(listBookmarks("useful","")).toHaveLength(1);expect(listBookmarks("","DESIGN")).toHaveLength(2);expect(listTags()).toEqual([{name:"Design",count:2},{name:"Later",count:1}]);const updated=updateBookmark(a.id,{url:a.url,title:"Changed",description:null,tags:["Fresh"]});expect(updated.title).toBe("Changed");expect(listTags().map(t=>t.name)).toContain("Fresh");});
 it("prevents duplicates and deletes atomically",()=>{const a=createBookmark({url:"https://example.com",title:"One",description:null,tags:[]});expect(()=>createBookmark({url:"https://EXAMPLE.com:443/#x",title:"Two",description:null,tags:[]})).toThrow("already");deleteBookmark(a.id);expect(listBookmarks()).toHaveLength(0);});
});
