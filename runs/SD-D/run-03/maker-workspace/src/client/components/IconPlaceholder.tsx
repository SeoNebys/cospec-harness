export interface IconPlaceholderProps {
  label?: string;
  size?: "small" | "medium" | "large";
}

export function IconPlaceholder({ label = "No site icon", size = "medium" }: IconPlaceholderProps) {
  return (
    <span className={`icon-placeholder icon-placeholder--${size}`} role="img" aria-label={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M6.5 3.5h7.8l3.2 3.2v13.8h-11z" />
        <path d="M14 3.8V7h3.2M9 11h6M9 14h6M9 17h4" />
      </svg>
    </span>
  );
}
