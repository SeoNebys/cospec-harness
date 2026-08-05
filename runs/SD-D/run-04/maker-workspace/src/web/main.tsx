import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ListPage } from './pages/ListPage';
import './styles.css';

// SPA entry. Single view for the US1 MVP; a router adds read-later/archived
// views in later stories (T012 shell, extended in US3/US4).

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');
createRoot(root).render(
  <StrictMode>
    <ListPage />
  </StrictMode>
);
