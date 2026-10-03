"use client";

export function LiveStatus({ message }: { message: string }) {
  return <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{message}</p>;
}
