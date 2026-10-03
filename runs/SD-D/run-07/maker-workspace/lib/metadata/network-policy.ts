import dns from "node:dns/promises";
import ipaddr from "ipaddr.js";

const denied = new Set(["unspecified","broadcast","multicast","linkLocal","loopback","private","uniqueLocal","reserved","carrierGradeNat"]);

export function isPublicAddress(address: string) {
  try {
    let parsed = ipaddr.parse(address);
    if (parsed.kind() === "ipv6" && (parsed as ipaddr.IPv6).isIPv4MappedAddress()) parsed = (parsed as ipaddr.IPv6).toIPv4Address();
    return !denied.has(parsed.range());
  } catch { return false; }
}

export async function resolvePublic(hostname: string) {
  const answers = await dns.lookup(hostname,{all:true,verbatim:true});
  if (!answers.length || answers.some(a=>!isPublicAddress(a.address))) throw Object.assign(new Error("This destination is not available."),{code:"BLOCKED_DESTINATION"});
  return answers[0];
}

export function validateFetchUrl(input: string) {
  const url = new URL(input);
  if (!["http:","https:"].includes(url.protocol)) throw Object.assign(new Error("Only HTTP and HTTPS pages are supported."),{code:"UNSUPPORTED_SCHEME"});
  if (url.username||url.password) throw Object.assign(new Error("Addresses with credentials are blocked."),{code:"INVALID_URL"});
  if (url.port && !["80","443"].includes(url.port)) throw Object.assign(new Error("This network port is not supported."),{code:"UNSUPPORTED_PORT"});
  return url;
}
