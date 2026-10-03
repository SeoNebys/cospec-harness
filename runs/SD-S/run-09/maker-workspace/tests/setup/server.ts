process.env.NODE_ENV ??= "test";
process.env.APP_ORIGIN ??= "http://127.0.0.1:4000";
process.env.AUTH_BASE_URL ??= "http://127.0.0.1:4000";
process.env.AUTH_SECRET ??= "test-secret-that-is-at-least-thirty-two-characters";
process.env.DATABASE_PATH ??= ":memory:";
process.env.MAIL_TRANSPORT ??= "memory";
