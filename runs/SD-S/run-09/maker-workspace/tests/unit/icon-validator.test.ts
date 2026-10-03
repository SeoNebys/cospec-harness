import { describe,expect,it } from "vitest";
import { validateIcon } from "../../src/server/metadata/validate-icon.js";
describe("icon validation",()=>{it("accepts PNG signatures",()=>expect(validateIcon(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,1]))?.mediaType).toBe("image/png"));it("rejects SVG text",()=>expect(validateIcon(Buffer.from("<svg></svg>"))).toBeNull());});
