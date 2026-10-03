import { describe,expect,it } from "vitest";import { fetchPageMetadata } from "@/lib/metadata/fetch-page";
describe("metadata network boundary",()=>{it("refuses loopback destinations without failing the save contract",async()=>{const result=await fetchPageMetadata("http://127.0.0.1:9/private");expect(result.status).toBe("failed");expect(result.messageCode).toBe("unsafe_destination");});});
