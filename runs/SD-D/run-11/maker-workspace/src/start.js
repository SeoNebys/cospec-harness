// Entry point. The real server is loaded via dynamic import so that the
// better-sqlite3 native addon is not attached to the *main* module's
// environment — under Node 24 that combination trips an addon cleanup-hook
// assertion at process teardown. Loaded as a dependency it is stable.
await import('./server.js');
