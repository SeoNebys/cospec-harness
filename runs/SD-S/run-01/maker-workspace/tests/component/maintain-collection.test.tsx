// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BookmarkForm } from '../../src/client/features/bookmarks/BookmarkForm';
import { ArchiveView } from '../../src/client/features/bookmarks/ArchiveView';
import { DeleteBookmarkDialog } from '../../src/client/features/bookmarks/DeleteBookmarkDialog';
import type { Bookmark } from '../../src/shared/api-types';
import { renderApp } from '../helpers/render';

const archived: Bookmark = { id: crypto.randomUUID(), url: 'https://example.com', title: 'Archived example', notes: 'Keep this', tags: ['Research'], isFavorite: true, status: 'archived', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), archivedAt: new Date().toISOString() };

describe('maintain collection components', () => {
  it('populates edit mode and preserves entered values on failure', async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockRejectedValue(new Error('Try again'));
    renderApp(<BookmarkForm bookmark={{ ...archived, status: 'active', archivedAt: null }} onSubmit={submit} onCancel={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Edit bookmark' })).toBeInTheDocument();
    const title = screen.getByRole('textbox', { name: 'Title' });
    await user.clear(title); await user.type(title, 'Changed title');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Try again');
    expect(title).toHaveValue('Changed title');
  });

  it('shows restore and permanent delete actions in a distinct archive view', () => {
    renderApp(<ArchiveView bookmarks={[archived]} pendingId={null} onRestore={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByLabelText('Archived bookmarks')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete permanently' })).toBeInTheDocument();
  });

  it('names the destructive action, cancels with Escape, and restores focus', async () => {
    const user = userEvent.setup();
    const cancel = vi.fn();
    const trigger = document.createElement('button'); trigger.textContent = 'trigger'; document.body.append(trigger); trigger.focus();
    const { unmount } = renderApp(<DeleteBookmarkDialog bookmark={archived} busy={false} onCancel={cancel} onConfirm={vi.fn()} />);
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Archived example');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(cancel).toHaveBeenCalled();
    unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });
});
