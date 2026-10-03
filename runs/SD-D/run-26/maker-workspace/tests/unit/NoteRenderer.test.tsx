import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderInRouter } from '../helpers/render.js';
import { NoteRenderer } from '@client/features/bookmarks/NoteRenderer.js';
describe('NoteRenderer', () => {
  it('renders readable CommonMark formatting', () => {
    renderInRouter(<NoteRenderer value={'A **bold** note\n\n- first\n- second'} />);
    expect(screen.getByText('bold').tagName).toBe('STRONG');
    expect(screen.getByText('first').closest('li')).toBeTruthy();
  });
  it('suppresses raw HTML, images, and unsafe links', () => {
    const { container } = renderInRouter(
      <NoteRenderer
        value={'<script>alert(1)</script> ![x](https://x/y.png) [bad](javascript:alert(1))'}
      />
    );
    expect(container.querySelector('script,img')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
  });
});
