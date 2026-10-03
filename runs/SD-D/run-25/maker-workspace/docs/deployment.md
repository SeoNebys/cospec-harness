# Deployment

Use Node.js 24, persistent storage for both `DATABASE_PATH` and `ICON_DIRECTORY`, and HTTPS at the configured `APP_BASE_URL`. Generate a unique high-entropy `BETTER_AUTH_SECRET`; never reuse the review value. Apply `npm run db:migrate` before starting the prepared build with `npm start`.

Production must use an SMTP/provider transport, secure cookies, and a trusted HTTPS recovery origin. Keep capture email limited to local review. Restrict outbound metadata traffic at the network layer as defense in depth; the application independently blocks non-public addresses, revalidates redirects, pins resolved addresses, limits response size, and enforces a five-second deadline.

Back up the SQLite database and icon directory together. Do not log passwords, session cookies, reset tokens, CSRF values, private note contents, or full bookmark URLs.
