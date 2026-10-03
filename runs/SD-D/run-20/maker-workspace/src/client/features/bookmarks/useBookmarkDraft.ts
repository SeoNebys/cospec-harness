import { useEffect, useRef, useState } from 'react';
import type { BookmarkDto } from '../../../shared/schemas/api';
import type { NoteDocument } from '../../../shared/schemas/noteDocument';
import { api } from '../../lib/api';

export interface Preview {
  id: string;
  url: string;
  normalizedUrl: string;
  title: string;
  description: string | null;
  iconUrl: string | null;
  previewImageUrl: string | null;
  status: string;
  warnings: Array<{ code: string; message: string }>;
  expiresAt: string;
}
export interface BookmarkDraft {
  url: string;
  previewId?: string;
  title: string;
  description: string;
  noteDocument: NoteDocument | null;
  tagLabels: string[];
  readingState: 'none' | 'unread' | 'read';
}

export function useBookmarkDraft(initial?: BookmarkDto) {
  const [draft, setDraft] = useState<BookmarkDraft>({
    url: initial?.url ?? '',
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    noteDocument: initial?.noteDocument ?? null,
    tagLabels: initial?.tags.map((tag) => tag.label) ?? [],
    readingState: initial?.readingState ?? 'none',
  });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const patch = (change: Partial<BookmarkDraft>) => setDraft((current) => ({ ...current, ...change }));
  const retrieve = async (urlOverride?: string) => {
    const address = urlOverride ?? draft.url;
    if (!/^https?:\/\//i.test(address.trim())) return;
    controller.current?.abort();
    controller.current = new AbortController();
    setLoading(true);
    setError('');
    try {
      const result = await api<Preview>('/api/metadata-previews', {
        method: 'POST',
        body: JSON.stringify({ url: address }),
        signal: controller.current.signal,
      });
      setPreview(result);
      patch({
        url: result.url,
        previewId: result.id,
        title: result.title,
        description: result.description ?? '',
      });
    } catch (caught) {
      if ((caught as Error).name !== 'AbortError')
        setError(caught instanceof Error ? caught.message : 'Details could not be fetched.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => () => controller.current?.abort(), []);
  return { draft, patch, preview, loading, error, retrieve };
}
