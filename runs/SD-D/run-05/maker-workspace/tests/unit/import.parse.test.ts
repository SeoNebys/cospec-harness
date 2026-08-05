import { describe, it, expect } from 'vitest'
import { parseNetscape } from '../../src/main/services/importExport'

const SAMPLE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3>Bookmarks bar</H3>
    <DL><p>
        <DT><A HREF="https://example.com/one" ADD_DATE="1700000000">First &amp; Best</A>
        <DT><H3>Recipes</H3>
        <DL><p>
            <DT><A HREF="https://example.com/pasta">Pasta</A>
            <DT><A HREF="https://example.com/bread">Bread</A>
        </DL><p>
    </DL><p>
</DL><p>`

// FR-027: parse the standard Netscape bookmarks file.
describe('parseNetscape', () => {
  it('extracts links with titles and decodes entities', () => {
    const items = parseNetscape(SAMPLE)
    const urls = items.map((i) => i.url)
    expect(urls).toEqual([
      'https://example.com/one',
      'https://example.com/pasta',
      'https://example.com/bread'
    ])
    expect(items[0].title).toBe('First & Best')
  })

  it('maps the enclosing folder to a tag but skips generic roots', () => {
    const items = parseNetscape(SAMPLE)
    // "Bookmarks bar" is a generic root → no tag
    expect(items.find((i) => i.url.endsWith('/one'))!.folder).toBeUndefined()
    // "Recipes" is a real folder → tag
    expect(items.find((i) => i.url.endsWith('/pasta'))!.folder).toBe('Recipes')
  })

  it('reads the original date-added (ADD_DATE) when present (FR-028a)', () => {
    const items = parseNetscape(SAMPLE)
    // 1700000000 seconds = 2023-11-14T...
    expect(items.find((i) => i.url.endsWith('/one'))!.savedAt).toMatch(/^2023-11-14T/)
    // no ADD_DATE on the recipe links → undefined (import will use "now")
    expect(items.find((i) => i.url.endsWith('/pasta'))!.savedAt).toBeUndefined()
  })
})
