import dns from 'node:dns/promises';
import net from 'node:net';

const blocked4 = new net.BlockList(), blocked6 = new net.BlockList();
for (const [network,prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]] as const) blocked4.addSubnet(network,prefix,'ipv4');
for (const [network,prefix] of [['::',128],['::1',128],['::ffff:0:0',96],['64:ff9b::',96],['100::',64],['2001:db8::',32],['fc00::',7],['fe80::',10],['ff00::',8]] as const) blocked6.addSubnet(network,prefix,'ipv6');
export class UnsafeDestinationError extends Error {}
export function isPublicAddress(address:string,family:4|6){return family===4?!blocked4.check(address,'ipv4'):!blocked6.check(address,'ipv6')}
export async function resolvePublic(hostname:string){
  const literal=net.isIP(hostname); const answers=literal?[{address:hostname,family:literal as 4|6}]:await dns.lookup(hostname,{all:true,verbatim:true});
  if(!answers.length||answers.some(a=>!isPublicAddress(a.address,a.family as 4|6)))throw new UnsafeDestinationError('Page details are unavailable for this address.');
  return answers[0]!;
}
export function validateFetchUrl(raw:string){const url=new URL(raw);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new UnsafeDestinationError('Page details are unavailable for this address.');const port=url.port?Number(url.port):(url.protocol==='https:'?443:80);if(![80,443].includes(port))throw new UnsafeDestinationError('Page details are unavailable for this address.');url.hash='';return url;}
