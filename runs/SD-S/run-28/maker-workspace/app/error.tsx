"use client";
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) { return <main className="app-shell"><div className="empty-state" style={{marginTop:"6rem"}}><h2>That didn’t quite work</h2><p>Your changes are safe. Try loading this view again.</p><button className="button button-primary" onClick={reset}>Try again</button></div></main>; }
