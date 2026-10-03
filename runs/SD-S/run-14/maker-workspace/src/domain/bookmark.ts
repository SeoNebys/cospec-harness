export interface Bookmark {
  id: string
  title: string
  url: string
  description: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface BookmarkInput {
  title: string
  url: string
  description: string
  tags: string[]
}

export interface BookmarkRepository {
  list(): Promise<Bookmark[]>
  create(input: BookmarkInput): Promise<Bookmark>
  update(id: string, input: BookmarkInput): Promise<Bookmark>
  delete(id: string): Promise<void>
}

export class RepositoryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RepositoryError'
  }
}
