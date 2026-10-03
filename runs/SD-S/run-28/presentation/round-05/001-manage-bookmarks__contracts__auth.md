# Authentication Interface Contract

**Provider**: Better Auth mounted at `/api/auth/[...all]`  
**Mode**: Email/password with database-backed sessions

This document fixes the subset of Better Auth used by the application. The implementation must pin the library version in `package-lock.json` and contract-test these flows so library upgrades cannot silently change the UI boundary.

## Common Rules

- Auth endpoints accept and return JSON unless the provider endpoint performs a documented redirect.
- The production session is an HTTP-only, secure, same-site cookie. JavaScript does not read or persist the session token.
- Protected page and bookmark endpoints validate the database session on the server.
- Mutation requests must come from the configured trusted origin.
- Registration, sign-in, and recovery endpoints are rate-limited by client and normalized email identity.
- Validation errors identify correctable fields but never return password content.
- Recovery requests always return the same accepted state, whether the email is registered or not.
- A successful password reset revokes all existing sessions for the account.

## Required Provider Endpoints

### Register

`POST /api/auth/sign-up/email`

```json
{
  "name": "Avery",
  "email": "avery@example.com",
  "password": "a-long-private-password"
}
```

Expected outcomes:

- Success creates the account and an authenticated session, then the UI routes to `/bookmarks`.
- Duplicate normalized email returns a non-sensitive conflict suitable for an existing-account prompt.
- Passwords must be 12–128 characters; the UI shows the limit before submission.

### Sign in

`POST /api/auth/sign-in/email`

```json
{
  "email": "avery@example.com",
  "password": "a-long-private-password",
  "rememberMe": true
}
```

Expected outcomes:

- Valid credentials create or rotate the database session and route to `/bookmarks`.
- Invalid credentials return one generic message that does not reveal whether the email exists.

### Read session

`GET /api/auth/get-session`

Expected outcomes:

- A valid session returns the provider's user/session DTO; the application consumes only user ID, name, email, and session expiry.
- A missing, expired, or revoked session is treated as unauthenticated.

### Sign out

`POST /api/auth/sign-out`

Expected outcomes:

- Revokes the current database session, clears its cookie, and routes to `/sign-in`.

### Request password reset

`POST /api/auth/request-password-reset`

```json
{
  "email": "avery@example.com",
  "redirectTo": "https://configured-origin/reset-password"
}
```

Expected outcomes:

- Always returns the same accepted UI state.
- If the account exists, dispatches a single-use, time-limited reset link through the configured mail adapter without waiting for SMTP completion in the public response.
- `redirectTo` is server-configured or exact-origin validated; arbitrary redirect destinations are rejected.

### Reset password

`POST /api/auth/reset-password`

```json
{
  "token": "opaque-token-from-reset-link",
  "newPassword": "a-new-long-private-password"
}
```

Expected outcomes:

- A valid unexpired token changes the password, consumes the token, and revokes every existing session.
- Invalid, expired, or already-consumed tokens return the same reset-link error and an action to request another link.

## Authorization Contract

The routing proxy may redirect requests that have no session cookie, but this is only a convenience. Each server-rendered library page and each `/api/bookmarks`, `/api/tags`, and `/api/icons` handler must obtain a verified Better Auth session and pass `session.user.id` into the data-access operation.

For any bookmark or icon not owned by the authenticated user, the API returns the same `404` response used for a nonexistent ID. It never confirms that another user's resource exists.

## Test Mail Contract

Development and automated tests use an in-memory mail adapter with the same `sendResetPassword` interface as SMTP. Tests retrieve the most recent message only through test code; no production HTTP endpoint exposes reset tokens. The end-to-end fixture may print the reset URL to the isolated test runner log with secret redaction enabled outside test mode.

## Review Account

The seed command creates the following local review-only account when `SEED_REVIEW_USER=true`:

- Email: `reviewer@example.com`
- Password: `Review-Bookmark-2026!`

The seed is idempotent and must be disabled by default in production configuration.
