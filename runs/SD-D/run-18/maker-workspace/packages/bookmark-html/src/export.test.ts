import { describe,expect,it } from 'vitest';
import { exportBookmarksHtml } from './export.js';
describe('browser bookmark export',()=>{it('escapes values and discloses format loss',()=>{const html=exportBookmarksHtml([{url:'https://example.com/?a=1&b=2',title:'A < B',createdAt:'2024-01-01T00:00:00Z'}]);expect(html).toContain('A &lt; B');expect(html).toContain('a=1&amp;b=2');expect(html).toContain('Rich notes, tags')})});
