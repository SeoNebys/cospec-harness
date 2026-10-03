import { describe, expect, it } from "vitest";
import { isBlockedAddress } from "@/lib/metadata/network-safety";
describe("network safety", () => {
  it.each([
    "127.0.0.1",
    "10.2.3.4",
    "192.168.1.2",
    "169.254.1.1",
    "::1",
    "fd00::1"
  ])("blocks %s", (ip) => expect(isBlockedAddress(ip)).toBe(true));
  it("allows public addresses", () =>
    expect(isBlockedAddress("93.184.216.34")).toBe(false));
});
