import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.js';
import { Providers } from './app/providers.js';
import './styles/global.css';
import './styles/responsive.css';

createRoot(document.getElementById('root')!).render(<StrictMode><Providers><App /></Providers></StrictMode>);
