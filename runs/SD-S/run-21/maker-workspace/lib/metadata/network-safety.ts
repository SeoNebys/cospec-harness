import dns from "node:dns/promises";
import net from "node:net";
import { AppProblem } from "@/lib/http/problem";
import { parseWebUrl } from "@/lib/bookmarks/normalize-url";

function blockedV4(ip: string) {
  const p = ip.split(".").map(Number);
  return (
    p[0] === 0 ||
    p[0] === 10 ||
    p[0] === 127 ||
    p[0] >= 224 ||
    (p[0] === 169 && p[1] === 254) ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) ||
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
    (p[0] === 192 && p[1] === 0 && p[2] === 2) ||
    (p[0] === 198 && p[1] === 51 && p[2] === 100) ||
    (p[0] === 203 && p[1] === 0 && p[2] === 113)
  );
}
function blockedV6(ip: string) {
  const value = ip.toLowerCase();
  return (
    value === "::" ||
    value === "::1" ||
    value.startsWith("fe8") ||
    value.startsWith("fe9") ||
    value.startsWith("fea") ||
    value.startsWith("feb") ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    value.startsWith("ff") ||
    value.startsWith("2001:db8")
  );
}
export function isBlockedAddress(ip: string) {
  return net.isIPv4(ip) ? blockedV4(ip) : net.isIPv6(ip) ? blockedV6(ip) : true;
}
export async function assertPublicUrl(value: string) {
  const url = parseWebUrl(value);
  if (url.port && !(["80", "443"] as string[]).includes(url.port))
    throw new AppProblem(
      422,
      "Address cannot be inspected",
      "Only standard web ports can be inspected."
    );
  let records;
  try {
    records = await dns.lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new AppProblem(
      422,
      "Page could not be reached",
      "The destination name could not be resolved."
    );
  }
  if (!records.length || records.some((r) => isBlockedAddress(r.address)))
    throw new AppProblem(
      422,
      "Address cannot be inspected",
      "Local, private, and reserved network destinations are blocked."
    );
  return url;
}
