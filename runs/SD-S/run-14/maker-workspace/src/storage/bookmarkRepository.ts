import type { Bookmark, BookmarkInput, BookmarkRepository } from '../domain/bookmark'
import { RepositoryError } from '../domain/bookmark'

const DB_NAME = 'keepwise-bookmarks'
const STORE_NAME = 'bookmarks'
const DB_VERSION = 1

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Storage request failed'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error ?? new Error('Storage transaction was cancelled'))
    transaction.onerror = () => reject(transaction.error ?? new Error('Storage transaction failed'))
  })
}

async function openDatabase(): Promise<IDBDatabase> {
  const request = indexedDB.open(DB_NAME, DB_VERSION)
  request.onupgradeneeded = () => {
    const database = request.result
    if (!database.objectStoreNames.contains(STORE_NAME)) {
      database.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
  }
  return requestResult(request)
}

function asRepositoryError(error: unknown): RepositoryError {
  return new RepositoryError('Your change could not be saved. Please try again.', {
    cause: error,
  })
}

export class IndexedDbBookmarkRepository implements BookmarkRepository {
  async list(): Promise<Bookmark[]> {
    try {
      const database = await openDatabase()
      const transaction = database.transaction(STORE_NAME, 'readonly')
      const result = await requestResult(transaction.objectStore(STORE_NAME).getAll())
      await transactionDone(transaction)
      database.close()
      return result
    } catch (error) {
      throw asRepositoryError(error)
    }
  }

  async create(input: BookmarkInput): Promise<Bookmark> {
    const now = new Date().toISOString()
    const bookmark: Bookmark = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    }
    await this.write('add', bookmark)
    return bookmark
  }

  async update(id: string, input: BookmarkInput): Promise<Bookmark> {
    try {
      const database = await openDatabase()
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const existing = await requestResult<Bookmark | undefined>(store.get(id))
      if (!existing) {
        transaction.abort()
        throw new RepositoryError('That bookmark no longer exists.')
      }
      const updated: Bookmark = { ...existing, ...input, id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() }
      store.put(updated)
      await transactionDone(transaction)
      database.close()
      return updated
    } catch (error) {
      if (error instanceof RepositoryError) throw error
      throw asRepositoryError(error)
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const database = await openDatabase()
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).delete(id)
      await transactionDone(transaction)
      database.close()
    } catch (error) {
      throw asRepositoryError(error)
    }
  }

  private async write(action: 'add' | 'put', bookmark: Bookmark): Promise<void> {
    try {
      const database = await openDatabase()
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME)[action](bookmark)
      await transactionDone(transaction)
      database.close()
    } catch (error) {
      throw asRepositoryError(error)
    }
  }
}

export const bookmarkRepository = new IndexedDbBookmarkRepository()
