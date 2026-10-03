import { useEffect, useState } from 'react';
export function useBookmarkSelection(contextKey: string, announce: (message: string) => void) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    queueMicrotask(() =>
      setIds((current) => {
        if (current.size) announce('Selection cleared because the library view changed.');
        return new Set();
      }),
    );
  }, [contextKey, announce]);
  const toggle = (id: string) =>
    setIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < 100) next.add(id);
      else announce('You can select at most 100 bookmarks.');
      return next;
    });
  return { ids, toggle, clear: () => setIds(new Set()) };
}
