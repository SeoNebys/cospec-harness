import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiError, MetadataPreview } from './types';

interface Options {
  onPreview?: (preview: MetadataPreview) => void;
  delay?: number;
}

export function useMetadataPreview(url: string, options: Options = {}) {
  const [preview, setPreview] = useState<MetadataPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(false);
  const request = useRef(0);
  const onPreview = useRef(options.onPreview);
  useEffect(() => {
    onPreview.current = options.onPreview;
  }, [options.onPreview]);

  const retrieve = useCallback(
    async (target = url) => {
      const current = ++request.current;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/metadata/preview', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url: target.trim() }),
        });
        const body = (await response.json()) as { data?: MetadataPreview; error?: ApiError };
        if (!response.ok || !body.data)
          throw new Error(body.error?.message ?? 'Page details could not be retrieved.');
        if (current !== request.current) return;
        setPreview(body.data);
        onPreview.current?.(body.data);
      } catch (reason) {
        if (current !== request.current) return;
        setError(reason instanceof Error ? reason.message : 'Page details could not be retrieved.');
      } finally {
        if (current === request.current) setLoading(false);
      }
    },
    [url],
  );

  useEffect(() => {
    if (!/^https?:\/\//i.test(url.trim())) return;
    const timer = window.setTimeout(() => void retrieve(url), options.delay ?? 450);
    return () => window.clearTimeout(timer);
  }, [url, retrieve, options.delay]);

  return { preview, error, isLoading, retrieve };
}
