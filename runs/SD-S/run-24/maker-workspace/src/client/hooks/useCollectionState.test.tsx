import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useCollectionState } from './useCollectionState.js';

describe('useCollectionState', () => {
  it('reads and writes collection state in the URL', () => {
    window.history.replaceState({}, '', '/?q=react&tags=Code%2CReading&favorite=true&sort=title');
    const { result } = renderHook(() => useCollectionState());
    expect(result.current.query).toMatchObject({
      q: 'react',
      tags: ['Code', 'Reading'],
      favorite: true,
      archived: false,
      sort: 'title',
    });
    act(() => result.current.setQuery({ archived: true, sort: 'updated' }));
    expect(window.location.search).toContain('archived=true');
    expect(result.current.query.sort).toBe('updated');
  });

  it('resets and responds to browser navigation', () => {
    const { result } = renderHook(() => useCollectionState());
    act(() => result.current.setQuery({ q: 'needle', tags: ['one'] }));
    act(() => result.current.reset());
    expect(result.current.query).toEqual({ q: '', tags: [], archived: false, sort: 'newest' });
    act(() => {
      window.history.pushState({}, '', '/?q=back');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current.query.q).toBe('back');
  });
});
