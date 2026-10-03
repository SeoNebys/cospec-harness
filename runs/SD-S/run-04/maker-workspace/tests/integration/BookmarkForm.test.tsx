// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BookmarkForm } from '../../src/client/features/bookmarks/BookmarkForm';
describe('BookmarkForm title suggestion', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });
  it('starts automatically after paste and leaves the suggestion editable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'found', title: 'Suggested page title' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    render(<BookmarkForm onClose={() => {}} onSaved={() => {}} onEditExisting={() => {}} />);
    const url = screen.getByLabelText(/web address/i);
    fireEvent.paste(url, { clipboardData: { getData: () => 'https://example.com/story' } });
    await waitFor(() =>
      expect(screen.getByLabelText(/title/i)).toHaveValue('Suggested page title'),
    );
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'My own title' } });
    expect(screen.getByLabelText(/title/i)).toHaveValue('My own title');
  });
  it('shows a manual fallback without disabling save', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'unavailable', title: null, reason: 'timeout' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    render(<BookmarkForm onClose={() => {}} onSaved={() => {}} onEditExisting={() => {}} />);
    fireEvent.change(screen.getByLabelText(/web address/i), {
      target: { value: 'https://example.com' },
    });
    fireEvent.blur(screen.getByLabelText(/web address/i));
    await waitFor(() => expect(screen.getByText(/couldn’t find a title/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /save bookmark/i })).toBeEnabled();
  });
});
