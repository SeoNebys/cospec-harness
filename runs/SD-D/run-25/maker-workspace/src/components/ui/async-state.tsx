import type { ReactNode } from "react";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return <div role="status">{label}</div>;
}

export function ErrorState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div role="alert">
      <p>{message}</p>
      {action}
    </div>
  );
}
