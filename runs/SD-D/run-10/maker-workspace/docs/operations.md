# Keepwell operations

Run `npm ci`, `npm run build`, and `npm run db:migrate` before starting the service. The production process starts with `npm start`, binds to the configured `HOST`/`PORT`, applies any pending migration before readiness, checks SQLite and the search projection, verifies that the asset directory is readable and writable, and only then returns `200` from `/health/ready`.

Use a strong `SESSION_SECRET`, an SMTP `MAIL_TRANSPORT`, an explicit allowlist in `APP_ORIGINS`, and persistent absolute paths for `DATABASE_PATH` and `ASSET_DIRECTORY`. Terminate TLS at the service or a trusted reverse proxy and only enable `TRUST_PROXY` for a controlled proxy.

## Backups and restore

The database and asset tree form one logical backup. Pause writes or take a SQLite online backup/checkpoint, then capture the SQLite database (including WAL files when applicable) and the entire asset directory in the same backup generation. Keep encrypted, versioned copies outside the host. Test restoration by restoring both parts into an isolated environment, running migrations, starting the application, and checking `/health/ready`, authenticated media, bookmark notes, and search results.

## Maintenance

The application periodically removes expired sessions, consumed/expired password reset tokens, expired bulk confirmations, expired draft media, and attached media that has remained unreferenced for a grace period. Cleanup is idempotent. Structured logs include request IDs and redact authentication material; never add raw cookies, reset links, notes, or credentials to logs.

On shutdown, send `SIGTERM` and allow the foreground process to close the HTTP listener and SQLite connection. Monitor readiness failures, repeated metadata-fetch rejection, rate limiting, SQLite integrity failures, and asset filesystem capacity.
