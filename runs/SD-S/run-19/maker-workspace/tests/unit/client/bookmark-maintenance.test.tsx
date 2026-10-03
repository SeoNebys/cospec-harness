import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Bookmark } from '../../../src/shared/types.js';
import { BookmarkCard } from '../../../src/client/components/BookmarkCard.js';

const bookmark: Bookmark = {
  id: 7,
  url: 'https://example.com/',
  title: 'Original title',
  description: 'Original description',
  tags: ['Research'],
  createdAt: '2026-09-24T10:00:00.000Z',
  updatedAt: '2026-09-24T10:00:00.000Z',
};

afterEach(() => vi.unstubAllGlobals());

describe('bookmark maintenance controls', () => {
  it('edits prefilled values and reports completion', async () => {
    const onChanged = vi.fn();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ...bookmark, title: 'Updated title' }), { status: 200 })));
    const user = userEvent.setup();
    render(<BookmarkCard bookmark={bookmark} onChanged={onChanged} />);
    await user.click(screen.getByRole('button', { name: /edit original title/i }));
    const title = screen.getByLabelText(/^title$/i);
    expect(title).toHaveValue('Original title');
    await user.clear(title);
    await user.type(title, 'Updated title');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(onChanged).toHaveBeenCalled();
  });

  it('cancels deletion, then confirms it and restores focus', async () => {
    const onChanged = vi.fn();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));
    const user = userEvent.setup();
    render(<BookmarkCard bookmark={bookmark} onChanged={onChanged} />);
    const deleteButton = screen.getByRole('button', { name: /delete original title/i });
    await user.click(deleteButton);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /keep bookmark/i }));
    expect(deleteButton).toHaveFocus();
    await user.click(deleteButton);
    await user.click(screen.getByRole('button', { name: /delete permanently/i }));
    expect(onChanged).toHaveBeenCalled();
  });
});
