import { describe, expect, it } from "vitest";
import { isPublicAddress, isSpecialUseHostname } from "../../src/server/metadata/ip-policy.js";

describe("metadata network policy", () => {
  it.each(["127.0.0.1","10.0.0.4","172.16.0.1","192.168.1.1","169.254.1.1","100.64.0.1","192.0.2.1","198.51.100.1","203.0.113.1","0.0.0.0","224.0.0.1","::1","::","fc00::1","fe80::1","ff02::1","::ffff:127.0.0.1"])("blocks %s",(ip)=>expect(isPublicAddress(ip)).toBe(false));
  it.each(["8.8.8.8","1.1.1.1","2606:4700:4700::1111"])("allows public address %s",(ip)=>expect(isPublicAddress(ip)).toBe(true));
  it.each(["localhost","x.local","service.internal","name.test"])("blocks special hostname %s",(host)=>expect(isSpecialUseHostname(host)).toBe(true));
});
