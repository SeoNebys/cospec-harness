import { describe,expect,it } from "vitest";
import { validateDestination } from "@/lib/server/network-policy";

describe("metadata destination policy",()=>{
 it.each(["http://127.0.0.1","http://10.0.0.1","http://169.254.169.254","http://[::1]"])("blocks non-global address %s",async url=>await expect(validateDestination(url)).rejects.toThrow("publicly"));
 it("rejects nonstandard ports and credentials",async()=>{await expect(validateDestination("https://example.com:444")).rejects.toThrow("ports");await expect(validateDestination("https://a:b@example.com")).rejects.toThrow("public");});
 it("accepts a globally routable literal",async()=>expect((await validateDestination("https://1.1.1.1")).address).toBe("1.1.1.1"));
});
