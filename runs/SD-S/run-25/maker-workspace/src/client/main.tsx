import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App, { AppErrorBoundary } from './App';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('The application root element is missing.');
}

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
