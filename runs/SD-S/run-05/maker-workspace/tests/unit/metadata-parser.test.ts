import { describe,expect,it } from "vitest";
import { parseMetadata } from "@/lib/server/metadata-parser";

describe("metadata parser",()=>{
 it("prefers title and standard description without executing markup",()=>expect(parseMetadata(`<title>A &amp; B</title><meta name="description" content="  A useful   page "><meta property="og:description" content="other"><script>throw 1</script>`)).toEqual({title:"A & B",description:"A useful page"}));
 it("falls back to Open Graph and clamps fields",()=>{const result=parseMetadata(`<meta property="og:title" content="Hello"><meta property="og:description" content="${"x".repeat(400)}">`);expect(result.title).toBe("Hello");expect(result.description).toHaveLength(300);});
 it("returns absent values for missing metadata",()=>expect(parseMetadata("<main>No metadata</main>")).toEqual({title:undefined,description:undefined}));
});
