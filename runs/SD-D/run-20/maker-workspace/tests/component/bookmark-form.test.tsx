// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { BookmarkForm } from '../../src/client/features/bookmarks/BookmarkForm';
it('starts from a URL, fills fetched details, and keeps them editable', async () => {
  const fetcher = vi.fn().mockResolvedValue({
    ok: true,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({
      id: '00000000-0000-4000-8000-000000000000',
      url: 'https://example.com/',
      normalizedUrl: 'https://example.com/',
      title: 'Fetched title',
      description: 'Fetched description',
      iconUrl: null,
      previewImageUrl: null,
      status: 'partial',
      warnings: [],
      expiresAt: new Date().toISOString(),
    }),
  });
  vi.stubGlobal('fetch', fetcher);
  render(<BookmarkForm onSaved={vi.fn()} onCancel={vi.fn()} />);
  const url = screen.getByLabelText('Web address');
  await userEvent.type(url, 'https://example.com');
  await userEvent.click(screen.getByRole('button', { name: 'Fetch details' }));
  expect(await screen.findByDisplayValue('Fetched title')).toBeInTheDocument();
  await userEvent.clear(screen.getByLabelText('Title'));
  await userEvent.type(screen.getByLabelText('Title'), 'My own title');
  expect(screen.getByDisplayValue('My own title')).toBeInTheDocument();
  vi.unstubAllGlobals();
});
