import type { ReactNode } from 'react';
export function Field({
  label,
  htmlFor,
  error,
  children,
  className = '',
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`field ${className}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error && (
        <div className="field-error" id={`${htmlFor}-error`}>
          {error}
        </div>
      )}
    </div>
  );
}
