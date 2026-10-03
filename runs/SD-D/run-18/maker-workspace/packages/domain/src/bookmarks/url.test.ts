import { describe,expect,it } from 'vitest';
import { normalizeUrl } from './url.js';
describe('URL normalization',()=>{it('removes fragments and default ports',()=>expect(normalizeUrl('HTTPS://Example.COM:443/a?q=1#part')).toBe('https://example.com/a?q=1'));it('rejects active and local-only schemes',()=>expect(()=>normalizeUrl('javascript:alert(1)')).toThrow())});
