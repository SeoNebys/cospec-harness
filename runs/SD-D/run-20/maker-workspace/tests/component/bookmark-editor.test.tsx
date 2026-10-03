// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { NoteRenderer } from '../../src/client/features/editor/NoteRenderer';
import { TagAutocomplete } from '../../src/client/features/tags/TagAutocomplete';
it('renders only structured formatting and safe external links', () => {
  render(
    <NoteRenderer
      document={{
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Useful',
                marks: [{ type: 'bold' }, { type: 'link', attrs: { href: 'https://example.com' } }],
              },
            ],
          },
        ],
      }}
    />,
  );
  const link = screen.getByRole('link', { name: 'Useful' });
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  expect(link.querySelector('strong')).not.toBeNull();
});
it('suggests and reuses an existing tag with the keyboard', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ items: [{ id: '1', label: 'Research' }] }),
    }),
  );
  const change = vi.fn();
  const user = userEvent.setup();
  render(<TagAutocomplete labels={[]} onChange={change} />);
  await user.type(screen.getByRole('combobox'), 'res');
  await waitFor(() => expect(screen.getByRole('option', { name: /Research/ })).toBeInTheDocument());
  await user.keyboard('{Enter}');
  expect(change).toHaveBeenCalledWith(['Research']);
  vi.unstubAllGlobals();
});
