import type { Bookmark } from './bookmark'
import { comparisonKey } from './tagNormalization'

export interface TagSummary {
  label: string
  comparisonKey: string
  bookmarkCount: number
}

export function newestFirst(bookmarks: Bookmark[]): Bookmark[] {
  return [...bookmarks].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
  )
}

export function filterBookmarks(
  bookmarks: Bookmark[],
  query: string,
  tag: string,
): Bookmark[] {
  const q = comparisonKey(query)
  const tagKey = comparisonKey(tag)
  return newestFirst(bookmarks).filter((bookmark) => {
    const matchesTag = !tagKey || bookmark.tags.some((item) => comparisonKey(item) === tagKey)
    const haystack = [bookmark.title, bookmark.url, bookmark.description, ...bookmark.tags]
      .map(comparisonKey)
      .join('\n')
    return matchesTag && (!q || haystack.includes(q))
  })
}

export function deriveTags(bookmarks: Bookmark[]): TagSummary[] {
  const tags = new Map<string, TagSummary>()
  for (const bookmark of bookmarks) {
    for (const label of bookmark.tags) {
      const key = comparisonKey(label)
      const current = tags.get(key)
      if (current) current.bookmarkCount += 1
      else tags.set(key, { label, comparisonKey: key, bookmarkCount: 1 })
    }
  }
  return [...tags.values()].sort((a, b) => a.label.localeCompare(b.label))
}
