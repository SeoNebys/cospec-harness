import { describe,expect,it } from "vitest";import { parseSearch } from "@/lib/search/parser";
describe("search parser scale",()=>{it("parses the maximum useful Boolean expression promptly",()=>{const query=Array.from({length:40},(_,i)=>`tag:t${i}`).join(" OR ");const started=performance.now();expect(parseSearch(query)).not.toBeNull();expect(performance.now()-started).toBeLessThan(100)})});
