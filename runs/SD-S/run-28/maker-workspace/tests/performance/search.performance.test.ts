import { describe,expect,it } from "vitest";
import { listBookmarks } from "@/lib/bookmarks/repository";
import { seedLargeLibrary } from "@/tests/fixtures/large-library";
import { testDatabase } from "@/tests/helpers/database";

describe("large library search",()=>{it("keeps repeated search and filter p95 below two seconds for 10,000 bookmarks and 500 tags",()=>{const{db,userId}=testDatabase();seedLargeLibrary(db,userId);const cases:Array<{q?:string;tags?:string[];favorite?:boolean}>=[{q:"singular needle"},{q:"Reference item"},{tags:["group-17"]},{tags:["group-31","group-32"]},{favorite:true}];const durations:number[]=[];for(let index=0;index<30;index++){const input=cases[index%cases.length];const start=performance.now();const result=listBookmarks(userId,input,db);durations.push(performance.now()-start);if(input.q==="singular needle")expect(result.items).toHaveLength(1);}durations.sort((a,b)=>a-b);const p95=durations[Math.ceil(durations.length*.95)-1];expect(p95).toBeLessThan(2000);},35_000);});
