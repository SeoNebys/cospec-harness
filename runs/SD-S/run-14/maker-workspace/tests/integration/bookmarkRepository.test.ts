import { beforeEach, describe, expect, it } from 'vitest'
import { IndexedDbBookmarkRepository } from '../../src/storage/bookmarkRepository'

const input = { title: 'Example', url: 'https://example.com/', description: 'Note', tags: ['Work'] }

async function clearDatabase() {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('keepwise-bookmarks')
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

describe('IndexedDB repository', () => {
  beforeEach(clearDatabase)
  it('creates, reloads, updates, and deletes transactionally', async () => {
    const repository = new IndexedDbBookmarkRepository()
    const created = await repository.create(input)
    expect((await new IndexedDbBookmarkRepository().list())[0]).toEqual(created)
    const updated = await repository.update(created.id, { ...input, title: 'Changed' })
    expect(updated.id).toBe(created.id)
    expect(updated.createdAt).toBe(created.createdAt)
    expect(updated.title).toBe('Changed')
    await repository.delete(created.id)
    expect(await repository.list()).toEqual([])
  })
  it('reports a missing update', async () => await expect(new IndexedDbBookmarkRepository().update('missing', input)).rejects.toThrow('no longer exists'))
})
