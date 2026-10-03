// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CollectionToolbar } from '../../src/client/features/bookmarks/CollectionToolbar';
describe('CollectionToolbar', () => {
  it('combines search/tags/favorites and clears in one action', () => {
    const setQuery = vi.fn(),
      setFavorite = vi.fn(),
      toggleTag = vi.fn(),
      clear = vi.fn();
    render(
      <CollectionToolbar
        query="design"
        setQuery={setQuery}
        favorite={true}
        setFavorite={setFavorite}
        tags={[{ id: '00000000-0000-4000-8000-000000000001', name: 'Ideas', bookmarkCount: 2 }]}
        selected={[]}
        toggleTag={toggleTag}
        clear={clear}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Ideas/ }));
    expect(toggleTag).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Clear all/i }));
    expect(clear).toHaveBeenCalled();
  });
});
