import { api } from './api.js';
export const previewImport = (html: string, fileName: string) =>
  api(`/api/imports/preview?fileName=${encodeURIComponent(fileName)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/html' },
    body: html
  });
export const commitImport = (id: string) =>
  api(`/api/imports/${id}/commit`, { method: 'POST', body: '{}' });
export const cancelImport = (id: string) => api(`/api/imports/${id}`, { method: 'DELETE' });
