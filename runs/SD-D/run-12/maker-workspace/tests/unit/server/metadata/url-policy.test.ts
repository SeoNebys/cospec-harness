import { describe, expect, it } from 'vitest';
import { isPublicAddress, validatePublicUrl, UrlPolicyError } from '../../../../src/server/metadata/url-policy.js';

const publicResolver = async () => [{address:'93.184.216.34',family:4 as const}];
describe('URL policy',()=>{
  it.each(['file:///etc/passwd','ftp://site.com','http://user:pass@site.com','http://site.com:8080','http://127.0.0.1','http://localhost','http://thing.local'])('rejects unsafe URL %s',async(input)=>{await expect(validatePublicUrl(input,publicResolver)).rejects.toBeInstanceOf(UrlPolicyError)});
  it('accepts and canonicalizes a normal public URL',async()=>{const result=await validatePublicUrl('HTTPS://news.site.com:443/a#b',publicResolver);expect(result.normalizedUrl).toBe('https://news.site.com/a')});
  it.each(['0.0.0.0','10.0.0.1','100.64.0.1','127.0.0.1','169.254.169.254','172.16.0.1','192.168.1.1','198.51.100.2','224.0.0.1','::1','fc00::1','fe80::1','2001:db8::1'])('classifies %s as non-public',(address)=>expect(isPublicAddress(address)).toBe(false));
  it('rejects a mixed public and private DNS answer',async()=>{await expect(validatePublicUrl('https://site.com',async()=>[{address:'93.184.216.34',family:4},{address:'10.0.0.1',family:4}])).rejects.toMatchObject({code:'unsafe_destination'})});
});
