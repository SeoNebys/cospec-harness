import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router';
import type { ReactElement } from 'react';
export const renderInRouter = (value: ReactElement) =>
  render(<BrowserRouter>{value}</BrowserRouter>);
