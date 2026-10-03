"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="error-page"><h1>Something went wrong</h1><p>Your bookmarks are still safe. Try loading this view again.</p><button onClick={reset}>Try again</button></main>;
}
