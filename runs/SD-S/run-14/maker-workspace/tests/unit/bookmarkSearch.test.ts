import { describe, expect, it } from 'vitest'
import type { Bookmark } from '../../src/domain/bookmark'
import { deriveTags, filterBookmarks } from '../../src/domain/bookmarkSearch'

const make = (id: string, title: string, tags: string[] = [], description = ''): Bookmark => ({ id, title, url: `https://${id}.example.com/`, description, tags, createdAt: `2026-01-0${id}T00:00:00.000Z`, updatedAt: `2026-01-0${id}T00:00:00.000Z` })
const data = [make('1', 'Design systems', ['Work', 'Design']), make('2', 'Weekend recipe', ['Home'], 'Olive bread')]

describe('bookmark discovery', () => {
  it('searches every field without case sensitivity', () => {
    expect(filterBookmarks(data, 'DESIGN', '')).toHaveLength(1)
    expect(filterBookmarks(data, 'olive', '')).toHaveLength(1)
    expect(filterBookmarks(data, '2.example', '')).toHaveLength(1)
  })
  it('combines query and one tag filter', () => expect(filterBookmarks(data, 'recipe', 'HOME').map(x => x.id)).toEqual(['2']))
  it('derives reusable tags and counts', () => expect(deriveTags([...data, make('3', 'Other', ['work'])]).find(x => x.comparisonKey === 'work')?.bookmarkCount).toBe(2))
  it('filters 1,000 items well below one second', () => {
    const many = Array.from({ length: 1000 }, (_, i) => make(String(i), `Bookmark ${i}`, [i % 2 ? 'Odd' : 'Even']))
    const start = performance.now()
    expect(filterBookmarks(many, '999', 'Odd')).toHaveLength(1)
    expect(performance.now() - start).toBeLessThan(1000)
  })
})
