import { describe,expect,it } from "vitest";
import { decodeCursor,encodeCursor } from "../../src/shared/validation/bookmark-query.js";
describe("stable cursors",()=>{it("round trips sort value and id",()=>expect(decodeCursor(encodeCursor({sortValue:"alpha",id:12}))).toEqual({sortValue:"alpha",id:12}));});
