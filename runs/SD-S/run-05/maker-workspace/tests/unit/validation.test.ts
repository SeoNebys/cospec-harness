import { describe,expect,it } from "vitest";
import { cleanText,normalizeTag,parseBookmarkUrl } from "@/lib/server/validation";

describe("bookmark validation",()=>{
 it("normalizes supported URLs and removes fragments",()=>expect(parseBookmarkUrl(" https://EXAMPLE.com:443/a?q=1#x ").normalizedUrl).toBe("https://example.com/a?q=1"));
 it("rejects unsafe schemes and credentials",()=>{expect(()=>parseBookmarkUrl("file:///etc/passwd")).toThrow();expect(()=>parseBookmarkUrl("https://u:p@example.com")).toThrow();});
 it("normalizes tags and inert text",()=>{expect(normalizeTag("  Design  ")).toEqual({name:"Design",normalizedName:"design"});expect(cleanText("a\u0000  b",20)).toBe("a b");});
});
