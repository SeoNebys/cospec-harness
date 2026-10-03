import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../../src/client/App.js';

afterEach(() => vi.unstubAllGlobals());

describe('save and list experience', () => {
  it('retrieves editable details, saves, and displays an openable bookmark', async () => {
    const bookmark = {
      id: 1, url: 'https://example.com/', title: 'Corrected title', description: 'A description', tags: [],
      createdAt: '2026-09-24T12:00:00.000Z', updatedAt: '2026-09-24T12:00:00.000Z',
    };
    let listCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/bookmarks' && (!init?.method || init.method === 'GET')) {
        listCalls += 1;
        return new Response(JSON.stringify({ items: listCalls > 1 ? [bookmark] : [], total: listCalls > 1 ? 1 : 0 }), { status: 200 });
      }
      if (url === '/api/tags') return new Response(JSON.stringify({ items: [] }), { status: 200 });
      if (url === '/api/metadata') return new Response(JSON.stringify({ url: bookmark.url, normalizedUrl: bookmark.url, title: 'Fetched title', description: 'A description', source: 'remote', warning: null }), { status: 200 });
      if (url === '/api/bookmarks' && init?.method === 'POST') return new Response(JSON.stringify(bookmark), { status: 201 });
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText(/nothing saved yet/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/web address/i), 'https://example.com');
    await user.click(screen.getByRole('button', { name: /get page details/i }));
    const title = await screen.findByLabelText(/^title$/i);
    expect(title).toHaveValue('Fetched title');
    await user.clear(title);
    await user.type(title, 'Corrected title');
    await user.click(screen.getByRole('button', { name: /^save bookmark$/i }));
    const link = await screen.findByRole('link', { name: 'Corrected title' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('shows a fallback warning while keeping save available', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/bookmarks')) return new Response(JSON.stringify({ items: [], total: 0 }), { status: 200 });
      if (url === '/api/tags') return new Response(JSON.stringify({ items: [] }), { status: 200 });
      return new Response(JSON.stringify({
        url: 'https://example.com/article', normalizedUrl: 'https://example.com/article', title: 'Article · example.com',
        description: null, source: 'fallback', warning: 'We could not retrieve page details, so we made a title from the address.',
      }), { status: 200 });
    }));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(/nothing saved yet/i);
    await user.type(screen.getByLabelText(/web address/i), 'https://example.com/article');
    await user.click(screen.getByRole('button', { name: /get page details/i }));
    expect(await screen.findByText(/could not retrieve page details/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /^save bookmark$/i })).toBeEnabled());
  });
});
