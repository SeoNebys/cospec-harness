import type { ReactNode } from 'react';
export function StatusMessage({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <div className={`status ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
