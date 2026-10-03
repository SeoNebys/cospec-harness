// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CollectionControls } from '../../src/client/features/bookmarks/CollectionControls';
import { BookmarkCard } from '../../src/client/features/bookmarks/BookmarkCard';
import type { Bookmark, ListCriteria } from '../../src/shared/api-types';
import { renderApp } from '../helpers/render';

const criteria: ListCriteria = { scope: 'active', q: '', tag: null, favorite: null, sort: 'newest' };
const bookmark: Bookmark = { id: crypto.randomUUID(), url: 'https://example.com', title: 'Example', notes: '', tags: ['Research'], isFavorite: false, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), archivedAt: null };

describe('find and organize components', () => {
  it('exposes labeled search, tag, favorite, sort, visible criteria, and clear', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const active = { ...criteria, q: 'design', tag: 'Research', favorite: true };
    renderApp(<CollectionControls criteria={active} tags={['Research']} onChange={onChange} />);
    expect(screen.getByLabelText('Search bookmarks')).toHaveValue('design');
    expect(screen.getByLabelText('Tag')).toHaveValue('Research');
    expect(screen.getByLabelText(/Favorites only/)).toBeChecked();
    expect(screen.getByLabelText('Sort')).toHaveValue('newest');
    expect(screen.getByLabelText('Active filters')).toHaveTextContent('Search: “design”');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ q: '', tag: null, favorite: null }));
  });

  it('debounces search changes without clearing sort', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderApp(<CollectionControls criteria={{ ...criteria, sort: 'title' }} tags={[]} onChange={onChange} />);
    await user.type(screen.getByLabelText('Search bookmarks'), 'guide');
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ q: 'guide', sort: 'title' })), { timeout: 1000 });
  });

  it('gives favorite controls accessible names and pending protection', async () => {
    const user = userEvent.setup();
    const favorite = vi.fn();
    const { rerender } = renderApp(<BookmarkCard bookmark={bookmark} onFavorite={favorite} />);
    await user.click(screen.getByRole('button', { name: /add example to favorites/i }));
    expect(favorite).toHaveBeenCalledWith(bookmark);
    rerender(<BookmarkCard bookmark={{ ...bookmark, isFavorite: true }} onFavorite={favorite} pending />);
    expect(screen.getByRole('button', { name: /remove example from favorites/i })).toBeDisabled();
  });
});
