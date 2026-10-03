import { describe,expect,it } from 'vitest';
import { isPublicAddress,validateOutboundHostname } from '../../../src/server/security/ip-policy.js';
describe('outbound address policy',()=>{
  it.each(['127.0.0.1','10.1.2.3','172.16.2.3','192.168.1.1','169.254.1.1','0.0.0.0','::1','fc00::1','fe80::1','::ffff:127.0.0.1'])('blocks %s',(address)=>expect(isPublicAddress(address)).toBe(false));
  it.each(['8.8.8.8','1.1.1.1','2606:4700:4700::1111'])('allows public %s',(address)=>expect(isPublicAddress(address)).toBe(true));
  it.each(['localhost','anything.local','intranet'])('blocks host %s',(host)=>expect(()=>validateOutboundHostname(host)).toThrow());
});
