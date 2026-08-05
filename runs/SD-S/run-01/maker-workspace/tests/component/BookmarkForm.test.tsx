import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../src/data/db';
import { add } from '../../src/data/bookmarkRepository';
import { normalizeUrl } from '../../src/lib/url';
import { ValidationError } from '../../src/models/bookmark';
import { BookmarkForm } from '../../src/components/BookmarkForm';
import type { NewBookmarkInput } from '../../src/models/bookmark';

beforeEach(async () => {
  await db.bookmarks.clear();
});

// A save handler that mimics App: it runs the same validation the repository does.
function makeOnSave() {
  return vi.fn(async (input: NewBookmarkInput) => {
    normalizeUrl(input.url); // throws ValidationError on bad url, like repo.add
  });
}

describe('BookmarkForm', () => {
  it('submits entered values (FR-001)', async () => {
    const user = userEvent.setup();
    const onSave = makeOnSave();
    render(<BookmarkForm onSave={onSave} onCancel={() => {}} />);

    await user.type(screen.getByLabelText('Web address'), 'example.com');
    await user.type(screen.getByLabelText('Title'), 'My Site');
    await user.click(screen.getByRole('button', { name: 'Save bookmark' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'example.com', title: 'My Site' }),
    );
  });

  it('shows an error and does not close when the address is invalid (FR-003)', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => {
      throw new ValidationError('Please enter a web address.');
    });
    render(<BookmarkForm onSave={onSave} onCancel={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Save bookmark' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('web address');
  });

  it('warns when the address already exists (FR-013)', async () => {
    await add({ url: 'https://dup.example/', title: 'Existing' });
    const user = userEvent.setup();
    render(<BookmarkForm onSave={makeOnSave()} onCancel={() => {}} />);

    const urlInput = screen.getByLabelText('Web address');
    await user.type(urlInput, 'dup.example');
    await user.tab(); // triggers onBlur duplicate check

    expect(await screen.findByRole('alert')).toHaveTextContent(/already have a bookmark/i);
  });
});
