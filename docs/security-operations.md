# Security operations

This runbook describes source-supported controls. It does not claim that a
hosted environment, backup, provider integration, or physical device has been
verified.

## Required production configuration

- Supply five independent JWT keys of at least 32 non-placeholder bytes:
  `JWT_ACCOUNT_ACCESS_SECRET`, `JWT_ACCOUNT_REFRESH_SECRET`,
  `JWT_DEVICE_ACCESS_SECRET`, `JWT_DEVICE_REFRESH_SECRET`, and
  `JWT_AUDIT_ACCESS_SECRET`.
- Set a stable `JWT_ISSUER`, exact comma-separated `CORS_ORIGINS`, and an
  independent `AUTH_ABUSE_HMAC_SECRET`.
- Keep database, Redis, encryption, QR authority, and provider credentials in
  the deployment secret manager. Never commit them.
- Use verified database TLS. Keep SSL query parameters out of `DATABASE_URL`;
  configure `DB_SSL`, `DB_SSL_REJECT_UNAUTHORIZED`, and
  `DB_SSL_CA_BASE64` explicitly.
- Leave `REDIS_REQUIRED=false` when cache fallback is acceptable. Set it to
  `true` only where Redis loss must prevent readiness. Initial connection time
  is bounded by `REDIS_CONNECT_TIMEOUT_MS`.

Production startup rejects missing, repeated, short, or placeholder JWT keys.

## Schema changes

The checksummed registry is the only schema authority. Inspect it with
`npm run migrate:status` and apply it with `npm run migrate:db`.

Before changing a non-disposable database, follow the provider-approved backup
and isolated restore procedure. Confirm the exact target, certificate chain,
backup integrity, maintenance window, rollback owner, and historical timestamp
timezone. This repository does not automate or attest hosted backups.

The current registry continues through migration 10,
`identity-enrollment-and-abuse-controls`, migration 11,
`event-membership-role-integrity`, and migration 12,
`notification-delivery-jobs`.

Do not edit an applied migration or its checksum. A mismatch is a stop
condition.

## Account enrollment and recovery

There is no public self-registration. An administrator creates or imports a
pending identity and receives each raw activation token once. The operator must
deliver it through an approved out-of-band channel; no email provider is
implemented. Activation expires after 24 hours.

Administrator-issued password reset tokens expire after 30 minutes. Activation,
reset, password change, administrative deactivation, logout, and logout-all
invalidate the affected server-side session authority. Passwords must be 15 to
128 characters and pass the local common-password check.

Do not log or retain activation/reset tokens after delivery.

## Browser and mobile sessions

The Dashboard keeps access and CSRF values in memory. Its rotating refresh token
is an HttpOnly, Secure production cookie. Refresh and logout require an exact
allowed origin and a session-bound CSRF header. Browser refreshes are
coordinated across tabs without putting bearer credentials in persistent
storage.

Pass and Scan keep body-carried credentials in SecureStore. Logout attempts
server revocation and always clears local authority even when the network call
fails. Device deregistration revokes normal authority; a short Scan audit
credential can upload only eligible pre-cutoff records. Blacklisting permits no
final upload.

## Abuse and traffic controls

Login failure counters are PostgreSQL-backed and keyed with HMAC-normalized
account/network identifiers. Store failures fail login closed. Public login,
ordinary account, device sync, audit upload, and expensive administration use
separate bounded request budgets. Body allocation happens after authentication
on protected routes.

Traffic settings are:

- `AUTH_RATE_WINDOW_MS` / `AUTH_RATE_MAX`
- `API_RATE_WINDOW_MS` / `API_RATE_MAX`
- `SYNC_RATE_MAX`
- `AUDIT_UPLOAD_RATE_MAX`
- `EXPENSIVE_RATE_MAX`

The availability limiter currently has an explicit in-process fallback. Do not
run more than one backend instance until a shared limiter store is implemented
and verified under load.

## Health, shutdown, and incident response

- `GET /health` is liveness and does not prove dependency availability.
- `GET /ready` performs a bounded PostgreSQL probe and reports database,
  listener, and Redis mode. Route traffic only to a 200 response.
- SIGTERM/SIGINT first remove readiness, stop accepting traffic, allow a
  ten-second drain, close remaining connections, then disconnect Redis and
  PostgreSQL. Repeated shutdown requests share one operation.
- Every API response has an `X-Request-Id`; API responses are `no-store`.
  Production unexpected 500 responses are generic. Search structured logs by
  request ID; do not add bodies, cookies, authorization headers, passwords, or
  tokens to logs.

For suspected credential exposure: remove the service from traffic, rotate the
affected purpose-specific key, revoke affected session families or devices,
review event-scoped audit activity, and restore readiness only after current
configuration and dependency probes pass.
