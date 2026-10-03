import React from 'react';

export default function EmptyState({ title, hint }) {
  return (
    <div className="empty">
      <div style={{ fontSize: '1.1em', marginBottom: 6 }}>{title}</div>
      {hint && <div>{hint}</div>}
    </div>
  );
}
