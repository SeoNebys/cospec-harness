import { describe,expect,it } from "vitest";
import { folderNameSchema,nameKey,tagNameSchema } from "../../src/shared/validation/organization.js";
describe("organization names",()=>{it("normalizes spacing, Unicode, and case",()=>expect(nameKey("  Café   WORK ")).toBe("café work"));it("enforces limits",()=>{expect(folderNameSchema.safeParse("").success).toBe(false);expect(tagNameSchema.safeParse("x".repeat(51)).success).toBe(false);});});
