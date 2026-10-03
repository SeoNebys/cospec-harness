import { describe,expect,it } from 'vitest';
import { normalizeUrl } from '../../../src/shared/urls/normalize-url.js';

describe('normalizeUrl',()=>{
  it.each([
    ['HTTP://Example.COM','http://example.com/'],
    [' https://Example.COM:443 ','https://example.com/'],
    ['http://example.com:80?a=1','http://example.com/?a=1'],
    ['https://EXAMPLE.com/Path%2FKeep?b=2&a=1#Part','https://example.com/Path%2FKeep?b=2&a=1#Part'],
    ['https://[2606:4700:4700::1111]','https://[2606:4700:4700::1111]/'],
  ])('normalizes %s conservatively', (input,expected)=>expect(normalizeUrl(input)).toBe(expected));
  it('preserves differences outside scheme, host, default port, and empty root',()=>{
    expect(normalizeUrl('https://example.com/Path')).not.toBe(normalizeUrl('https://example.com/path'));
    expect(normalizeUrl('https://example.com/?a=1&b=2')).not.toBe(normalizeUrl('https://example.com/?b=2&a=1'));
    expect(normalizeUrl('https://example.com/#one')).not.toBe(normalizeUrl('https://example.com/#two'));
  });
  it.each(['javascript:alert(1)','ftp://example.com','https://user:pass@example.com','not a url',''])('rejects %s',(input)=>expect(()=>normalizeUrl(input)).toThrow());
});
