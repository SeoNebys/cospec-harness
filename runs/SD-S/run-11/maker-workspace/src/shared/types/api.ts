export interface Problem { type: string; title: string; status: number; detail?: string; requestId?: string; errors?: Record<string, string[]>; existingBookmarkId?: string }
