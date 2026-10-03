import { describe,expect,it } from 'vitest';
import { markdownText,renderMarkdown } from './markdown.js';
describe('rich notes',()=>{it('renders the approved subset and strips raw active markup',()=>{const html=renderMarkdown('# Heading\n**Bold** <script>alert(1)</script>');expect(html).toContain('<h1>Heading</h1>');expect(html).toContain('<strong>Bold</strong>');expect(html).not.toContain('<script>')});it('derives searchable plain text',()=>expect(markdownText('A **useful** note')).toBe('A useful note'))});
