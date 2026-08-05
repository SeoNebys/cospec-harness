import type { BookmarksApi } from '../main/preload'

declare global {
  interface Window {
    api: BookmarksApi
  }
}

export {}
