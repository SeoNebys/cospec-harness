// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BookmarkForm } from '../../src/client/features/bookmarks/BookmarkForm';
import { BookmarkCard } from '../../src/client/features/bookmarks/BookmarkCard';
import { CollectionState } from '../../src/client/features/bookmarks/CollectionState';
import { renderApp } from '../helpers/render';

describe('save and revisit components', () => {
  it('shows new collection guidance', () => {
    const action = vi.fn();
    renderApp(<CollectionState kind="new" onAction={action} />);
    expect(screen.getByRole('heading', { name: /next good find/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add your first/i })).toBeInTheDocument();
  });

  it('requires a manually entered title and focuses the first invalid field', async () => {
    const user = userEvent.setup();
    renderApp(<BookmarkForm onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/titles are entered by hand/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/web address/i), 'not-a-url');
    await user.click(screen.getByRole('button', { name: /save bookmark/i }));
    expect(await screen.findByText(/complete web address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/web address/i)).toHaveFocus();
    expect(screen.getByLabelText(/web address/i)).toHaveValue('not-a-url');
  });

  it('submits notes and removable tags', async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockResolvedValue(undefined);
    renderApp(<BookmarkForm onSubmit={submit} onCancel={vi.fn()} />);
    await user.type(screen.getByLabelText(/web address/i), 'https://example.com');
    await user.type(screen.getByLabelText(/^title/i), 'Example');
    await user.type(screen.getByLabelText(/notes/i), 'Useful');
    await user.type(screen.getByLabelText(/^tags/i), 'Research{Enter}');
    expect(screen.getByRole('button', { name: /remove research tag/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /save bookmark/i }));
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ title: 'Example', notes: 'Useful', tags: ['Research'] }));
  });

  it('opens saved destinations without replacing collection context', () => {
    renderApp(<BookmarkCard bookmark={{ id: crypto.randomUUID(), url: 'https://example.com', title: 'Example', notes: '', tags: [], isFavorite: false, status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), archivedAt: null }} />);
    const link = screen.getByRole('link', { name: 'Example' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
