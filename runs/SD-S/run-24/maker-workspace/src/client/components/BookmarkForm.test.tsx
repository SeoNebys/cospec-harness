import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiClientError } from '../api.js';
import { BookmarkForm } from './BookmarkForm.js';

describe('BookmarkForm', () => {
  it('submits trimmed values and keeps the form accessible', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<BookmarkForm open mode="create" onClose={() => undefined} onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText('Title'), ' Example ');
    await user.type(screen.getByLabelText('Web address'), 'https://example.com');
    await user.type(screen.getByLabelText('Notes'), 'Read it');
    await user.click(screen.getByRole('button', { name: 'Save bookmark' }));
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Example',
      url: 'https://example.com',
      notes: 'Read it',
      tags: [],
    });
  });

  it('retains values and displays field errors after a failed request', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(
      new ApiClientError('Check the highlighted fields.', 'VALIDATION_ERROR', {
        url: ['Enter a valid HTTP or HTTPS address.'],
      }),
    );
    render(<BookmarkForm open mode="create" onClose={() => undefined} onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText('Title'), 'Example');
    await user.type(screen.getByLabelText('Web address'), 'bad');
    await user.click(screen.getByRole('button', { name: 'Save bookmark' }));
    expect(await screen.findByText('Enter a valid HTTP or HTTPS address.')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Example');
  });
});
