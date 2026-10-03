Object.assign(process.env, { NODE_ENV: "test" });
process.env.BETTER_AUTH_SECRET ??= "test-secret-that-is-at-least-thirty-two-bytes";
process.env.APP_BASE_URL ??= "http://127.0.0.1:4000";
process.env.TRUSTED_ORIGIN ??= "http://127.0.0.1:4000";
process.env.MAIL_TRANSPORT ??= "memory";
