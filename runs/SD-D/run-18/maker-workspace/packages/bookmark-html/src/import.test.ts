import { describe,expect,it } from 'vitest';
import { parseBookmarksHtml } from './import.js';
describe('browser bookmark import',()=>{it('turns folder paths into tags and skips unsafe schemes',()=>{const result=parseBookmarksHtml('<DL><DT><H3>Work</H3><DL><DT><A HREF="https://example.com">Example &amp; more</A><DT><A HREF="javascript:x">Bad</A></DL></DL>');expect(result.items).toEqual([{url:'https://example.com',title:'Example & more',tags:['Work']}]);expect(result.issues).toHaveLength(1)})});
