import { useRef, useState } from 'react';
import { api } from '../../api/client';

type Result = { status: 'found' | 'unavailable'; title: string | null; reason?: string };

export function useTitlePreview(onTitle: (title: string) => void, canApply: () => boolean) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'failed'>('idle');
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  function cancel() {
    sequence.current += 1;
    controller.current?.abort();
    setStatus('idle');
  }
  async function request(url: string) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return;
    }
    if (!['http:', 'https:'].includes(parsed.protocol) || !canApply()) return;
    const own = ++sequence.current;
    controller.current?.abort();
    controller.current = new AbortController();
    setStatus('loading');
    try {
      const result = await api<Result>('/title-previews', {
        method: 'POST',
        body: JSON.stringify({ url }),
        signal: controller.current.signal,
      });
      if (own !== sequence.current || !canApply()) return;
      if (result.status === 'found' && result.title) {
        onTitle(result.title);
        setStatus('idle');
      } else setStatus('failed');
    } catch (error) {
      if (
        own === sequence.current &&
        !(error instanceof DOMException && error.name === 'AbortError')
      )
        setStatus('failed');
    }
  }
  return { status, request, cancel };
}
