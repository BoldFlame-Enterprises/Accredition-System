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
  is bounded by `REDIS_CONNECT_TIMEOUT_MS`. Post-start `error` and `end`
  transitions remove required readiness immediately; both modes use one
  bounded recovery loop and cache commands use only a client reporting
  `isReady`.

Production startup rejects missing, repeated, short, or placeholder JWT keys.

## Schema changes

The checksummed registry is the only schema authority. Inspect it with
`npm run migrate:status` and apply it with `npm run migrate:db`.

Before changing a non-disposable database, follow the provider-approved backup
and isolated restore procedure. Confirm the exact target, certificate chain,
backup integrity, maintenance window, rollback owner, and historical timestamp
timezone. This repository does not automate or attest hosted backups.

The current registry continues through migration 16. Migration 13
`qr-credential-trust` adds credential/revocation and trust-generation
authority; migration 14 `scan-decision-evidence` adds nullable, bounded
scan-decision evidence; migration 15 `notification-recipient-delivery` adds
fenced recipient-level delivery; and migration 16 `event-case-idempotency`
makes client record identity event-scoped and adds case-history cursor indexes.
Apply them only through the migration runner after the normal backup/restore
and historical-lineage preflight.

Before migration 16, aggregate duplicate `(event_id, client_record_id)` values
for incidents and overrides. Any duplicate within one event is a stop
condition requiring data-owner reconciliation; the migration will refuse to
guess. Reusing the same client identity in different events is valid.

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

Account event discovery happens before mobile session exchange. Once Pass or
Scan has a device session, synchronization uses the signed and persisted
registration event and does not call account-only event discovery. Mobile HTTP
operations and refresh share a deadline; timed-out idempotent writes retain
their original idempotency key when retried.

## QR trust, offline decisions, and replay limits

The compact v3 QR is identity proof, not an embedded authorization list. It
binds attendee, event, Pass installation, credential/registration generations,
and the Pass public key under an exact P-256 authority signature. The selected
area is authorized from Scan's synchronized active event projection or current
PostgreSQL state during server fallback.

Presentations have a nominal 60-second lifetime and permit at most 60 seconds
of clock skew at either boundary. Pass refuses a v3 presentation above 800
UTF-8 bytes or QR version 20. Those source limits are not physical camera
evidence.

Scan's QR trust snapshot is current for 60 seconds and hard-expires after 24
hours. Between those thresholds it is soft-stale: invalid signatures, wrong
events, invalid time bounds, and known revocations remain conclusive denials;
otherwise authorization may require refresh or authenticated server fallback.
After hard expiry, trust-dependent authorization requires synchronization or
server authority and fails closed when unavailable. This 24-hour offline
revocation bound is an explicit availability/security tradeoff: a disconnected
scanner may remain unaware of a new revocation until the hard window expires.

Each camera attempt is correlated with a `device_scan_id`. Persisted evidence
may contain credential ID, nonce hash, decision code/source, trust generation,
user-snapshot time, and scanner installation ID. Never retain raw QR content,
raw nonces, authority/device signatures, presented email, or key material.
Nonce correlation and short lifetimes reduce investigation ambiguity; they do
not provide a zero-replay guarantee across disconnected scanners.

## QR authority rotation and v2 compatibility

Production requires `QR_AUTHORITY_ACTIVE_KEY_ID`,
`QR_AUTHORITY_PRIVATE_KEY_BASE64`, and `QR_AUTHORITY_KEYRING_JSON`. The active
private key must be exact PKCS#8 P-256. The keyring contains one matching active
65-byte uncompressed P-256 public point and at most seven retiring verification
keys; each retiring key needs a future `verify_until` Unix timestamp. Startup
fails closed for missing, duplicate, placeholder, malformed, wrong-curve, or
inconsistent key material.

Use this staged rotation:

1. Inventory the current public-key fingerprint and secret owner without
   copying private material into tickets, repository files, or chat.
2. Publish the new public key as trusted while the old key remains active.
3. Wait at least the approved 24-hour Scan hard-trust window, or prove
   equivalent supported-fleet synchronization.
4. Switch the active private key and key ID, then force connected Pass clients
   to renew.
5. Keep the old public key retiring until every old credential, the 60-second
   clock skew, and the approved offline window have elapsed.
6. Verify supported Pass/Scan adoption and run rollback/overlap observations
   before removing the retiring key.

The backend and Scan retain strict v2 verification only for migration
compatibility. Do not retire v2 until migrations 13/14 are safely deployed,
dual-verifier Scan adoption and fresh trust sync are established, Pass v3
adoption is observed, the maximum v2 credential plus skew/offline windows have
elapsed since last issuance, physical camera pairs pass, and product/security
owners approve the minimum supported versions and rollback plan. Repository
tests do not satisfy these release gates.

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
