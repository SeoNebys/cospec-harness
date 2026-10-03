import { describe, expect, it } from 'vitest';
import { isPublicAddress, normalizeUrl, validatePublicUrl } from '../../src/server/services/urlPolicy.js';
describe('URL policy',()=>{
  it('adds HTTPS and strips fragments',()=>expect(normalizeUrl('example.com/a#x').href).toBe('https://example.com/a'));
  it('rejects non-web schemes and credentials',()=>{expect(()=>normalizeUrl('file:///etc/passwd')).toThrow();expect(()=>normalizeUrl('https://u:p@example.com')).toThrow();});
  it('classifies public and private address families',()=>{expect(isPublicAddress('93.184.216.34')).toBe(true);for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','::1','fc00::1'])expect(isPublicAddress(ip)).toBe(false);});
  it('rejects a hostname when any resolution is private',async()=>{await expect(validatePublicUrl(new URL('https://example.com'),async()=>['93.184.216.34','127.0.0.1'])).rejects.toThrow('public');});
});
