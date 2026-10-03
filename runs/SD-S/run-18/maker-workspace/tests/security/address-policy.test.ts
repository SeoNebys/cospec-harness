import { describe, expect, it } from "vitest";
import { isPublicAddress, resolvePublicAddresses } from "~/services/metadata/address-policy.server";

describe("metadata address policy", () => {
  it.each([
    "127.0.0.1", "127.1.2.3", "0.0.0.0", "10.0.0.1", "100.64.0.1", "169.254.169.254",
    "172.16.0.1", "192.168.1.1", "224.0.0.1", "192.0.2.1", "198.51.100.2", "203.0.113.3",
    "::1", "::", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "64:ff9b::a00:1", "2001:db8::1",
  ])("blocks %s", (address) => expect(isPublicAddress(address)).toBe(false));

  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])("allows %s", (address) => expect(isPublicAddress(address)).toBe(true));

  it("rejects mixed public and private DNS answers", async () => {
    await expect(resolvePublicAddresses("example.com", async () => [
      { address: "93.184.216.34", family: 4 as const },
      { address: "127.0.0.1", family: 4 as const },
    ])).rejects.toThrow("blocked");
  });
});
