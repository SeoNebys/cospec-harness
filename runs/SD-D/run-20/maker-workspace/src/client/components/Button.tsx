import type { ButtonHTMLAttributes } from 'react';
export function Button({
  className = '',
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  return (
    <button className={`button ${variant === 'primary' ? '' : variant} ${className}`.trim()} {...props} />
  );
}
