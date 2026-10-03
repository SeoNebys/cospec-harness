// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/client/App';
import { renderApp } from '../helpers/render';

describe('application readiness', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('marks a valid loaded state ready', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [], total: 0, availableTags: [], criteria: { scope: 'active', q: '', tag: null, favorite: null, sort: 'newest' } }), { status: 200 })));
    const { container } = renderApp(<App />);
    expect(screen.getByText(/loading your bookmarks/i)).toBeInTheDocument();
    await waitFor(() => expect(container.querySelector('[data-harness-ready="true"]')).toBeInTheDocument());
  });

  it('does not mark an error state ready', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const { container } = renderApp(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't load/i);
    expect(container.querySelector('[data-harness-ready="true"]')).not.toBeInTheDocument();
  });
});
