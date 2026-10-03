import { describe,expect,it } from 'vitest';
import { detectImageType,extractMetadata } from '../../../../src/server/metadata/extractor.js';
describe('metadata extraction',()=>{
  it('prefers HTML title and standard description and resolves icons',()=>{const result=extractMetadata('<title> Page &amp; title </title><meta property="og:title" content="Other"><meta name="description" content=" A  useful summary "><link rel="icon" href="/icon.png">','https://site.com/story');expect(result).toMatchObject({title:'Page & title',titleSource:'html-title',description:'A useful summary',descriptionSource:'meta-description',iconUrl:'https://site.com/icon.png'})});
  it('uses social values then hostname fallback',()=>{expect(extractMetadata('<meta property="og:title" content="Social">','https://site.com').title).toBe('Social');expect(extractMetadata('','https://site.com').title).toBe('site.com')});
  it('caps title and description',()=>{const result=extractMetadata(`<title>${'a'.repeat(600)}</title><meta name="description" content="${'b'.repeat(2100)}">`,'https://site.com');expect([...result.title]).toHaveLength(512);expect([...result.description!]).toHaveLength(2000)});
  it('accepts raster signatures and rejects SVG/HTML',()=>{expect(detectImageType(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))).toBe('image/png');expect(detectImageType(Buffer.from('<svg></svg>'))).toBeNull()});
});
