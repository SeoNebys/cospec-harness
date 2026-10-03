import type { Bookmark, BookmarkInput, BookmarkRepository } from '../src/domain/bookmark'

export class MemoryRepository implements BookmarkRepository {
  items: Bookmark[]
  fail = false
  constructor(items: Bookmark[] = []) { this.items = items }
  async list() { return [...this.items] }
  async create(input: BookmarkInput) {
    if (this.fail) throw new Error('failed')
    const item = { ...input, id: String(this.items.length + 1), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    this.items.push(item); return item
  }
  async update(id: string, input: BookmarkInput) {
    if (this.fail) throw new Error('failed')
    const current = this.items.find(x => x.id === id)!
    const item = { ...current, ...input, id, createdAt: current.createdAt, updatedAt: new Date(Date.now() + 1000).toISOString() }
    this.items = this.items.map(x => x.id === id ? item : x); return item
  }
  async delete(id: string) { if (this.fail) throw new Error('failed'); this.items = this.items.filter(x => x.id !== id) }
}

export const sample: Bookmark = { id: '1', title: 'Example', url: 'https://example.com/', description: 'A useful reference', tags: ['Work'], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
