import dns from 'node:dns/promises';
import { isPublicAddress } from './public-address.js';
export async function resolvePublic(hostname:string):Promise<string[]>{
  const rows=await dns.lookup(hostname,{all:true,verbatim:true});
  if(!rows.length||rows.some(row=>!isPublicAddress(row.address))) throw new Error('BLOCKED_DESTINATION');
  return rows.map(row=>row.address);
}
