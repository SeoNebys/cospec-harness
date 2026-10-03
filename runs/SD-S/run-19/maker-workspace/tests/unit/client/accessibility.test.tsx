import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../src/client/App.js';
import { BookmarkCard } from '../../../src/client/components/BookmarkCard.js';
import type { Bookmark } from '../../../src/shared/types.js';

afterEach(() => vi.unstubAllGlobals());

describe('cross-story accessibility', () => {
  it('exposes labeled controls, loading status, ready state, and keyboard focus', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === '/api/tags') return new Response(JSON.stringify({ items: [] }), { status: 200 });
      return new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 });
    }));
    const user = userEvent.setup();
    const { container } = render(<App />);
    expect(await screen.findByText('Nothing saved yet.')).toBeInTheDocument();
    expect(container.querySelector('[data-harness-ready="true"]')).toBeInTheDocument();
    expect(screen.getByLabelText('Web address')).toBeInTheDocument();
    expect(screen.getByLabelText('Search bookmarks')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by tag')).toBeInTheDocument();
    await user.tab();
    expect(document.activeElement).not.toBe(document.body);
  });

  it('uses modal alert semantics and returns focus after cancellation', async () => {
    const bookmark: Bookmark = {
      id: 1, url: 'https://example.com/', title: 'Accessible bookmark', description: null, tags: [],
      createdAt: '2026-09-24T10:00:00.000Z', updatedAt: '2026-09-24T10:00:00.000Z',
    };
    const user = userEvent.setup();
    render(<BookmarkCard bookmark={bookmark} />);
    const trigger = screen.getByRole('button', { name: 'Delete Accessible bookmark' });
    await user.click(trigger);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Keep bookmark' })).toHaveFocus();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Keep bookmark' }));
    expect(trigger).toHaveFocus();
  });
});
