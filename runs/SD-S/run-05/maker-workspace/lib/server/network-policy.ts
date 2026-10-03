import dns from "node:dns/promises";
import ipaddr from "ipaddr.js";
import { ValidationError } from "./validation";

export interface SafeDestination { url: URL; address: string; family: 4|6 }

function isPublic(address: string) {
  try {
    let parsed = ipaddr.parse(address);
    if (parsed.kind() === "ipv6" && (parsed as ipaddr.IPv6).isIPv4MappedAddress()) parsed = (parsed as ipaddr.IPv6).toIPv4Address();
    return parsed.range() === "unicast";
  } catch { return false; }
}

export async function validateDestination(raw: string): Promise<SafeDestination> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new ValidationError("Enter a valid web address.", "url"); }
  if (!["http:","https:"].includes(url.protocol) || url.username || url.password) throw new ValidationError("Only public http and https addresses are supported.", "url");
  const expectedPort=url.protocol === "https:" ? "443" : "80";
  if (url.port && url.port !== expectedPort) throw new ValidationError("Only standard web ports are supported.", "url");
  const host=url.hostname.replace(/^\[|\]$/g, "");
  let answers: {address:string;family:number}[];
  if (ipaddr.isValid(host)) answers=[{address:host,family:ipaddr.parse(host).kind()==="ipv4"?4:6}];
  else answers=await dns.lookup(host,{all:true,verbatim:true});
  if (!answers.length || answers.some(a=>!isPublic(a.address))) throw new ValidationError("That destination is not publicly accessible.", "url");
  return { url, address: answers[0].address, family: answers[0].family as 4|6 };
}
