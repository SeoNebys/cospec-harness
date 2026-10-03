// @vitest-environment jsdom
import type { ReactElement } from 'react';
import { render } from '@testing-library/react';

export function renderApp(element: ReactElement) {
  return render(element);
}
