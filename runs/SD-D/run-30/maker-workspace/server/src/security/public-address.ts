import ipaddr from 'ipaddr.js';

const denied=new Set(['unspecified','broadcast','multicast','linkLocal','loopback','private','reserved','carrierGradeNat','uniqueLocal','ipv4Mapped']);
export function isPublicAddress(address:string):boolean{
  try { const parsed=ipaddr.parse(address); return !denied.has(parsed.range()); } catch { return false; }
}
