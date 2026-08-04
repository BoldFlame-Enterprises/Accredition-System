# VeriGate demo guide

This guide distinguishes the local demonstration from backend-integrated behavior.

## Disposable assembled compatibility

Before arranging devices, the repository-level compatibility workflow can prove
blank-database migration, backend/Dashboard startup, browser administration,
production-shared Pass/Scan protocol behavior, offline decisions, retry
idempotency, revocation convergence, operational review, event isolation,
dependency recovery, and exact expiry boundaries:

```bash
npm run ci:all
npm --prefix web-dashboard exec -- playwright install chromium
npm run compatibility:convergence
npm run compatibility:verify
```

The runner owns an isolated Docker project and writes ignored, redacted evidence
under `compatibility-artifacts/<run-id>/`. See [the quick start](QUICK_START.md)
for preflight, smoke-only, diagnostics, runtime, origin configuration, and safe
cleanup commands.

This workflow uses a real browser, backend, PostgreSQL, and Redis. Pass and Scan
drivers import production-shared application code but substitute camera,
installed SQLCipher, SecureStore, biometrics, physical networking, audio, and
push providers. Complete the installed-device checks below before making claims
about those capabilities or about hosted/released builds.

## Required build

Both mobile apps require native SQLCipher and therefore do not run in Expo Go. Build custom Android development clients or full native/EAS builds. Two devices are preferred for the Pass-to-Scan camera workflow.

## Local demo mode

Local seed identities, quick-login lists, and blank-password login are enabled only when `EXPO_PUBLIC_DEMO_MODE=true`. Production EAS profiles set it to `false`.

Demo mode is suitable for showing UI, camera scanning, area decisions, and offline local logs. It does not prove backend authentication, event authorization, PostgreSQL/Redis persistence, provider delivery, or production revocation.

## Backend-integrated demo

1. Start PostgreSQL, Redis, the backend, and dashboard; apply the event and contract migrations, then seed an event.
2. Configure `QR_AUTHORITY_PRIVATE_KEY_BASE64`,
   `QR_AUTHORITY_ACTIVE_KEY_ID`, and `QR_AUTHORITY_KEYRING_JSON` only in the
   backend environment. The keyring must contain exactly one active public key
   matching the private key.
3. Build Pass and Scan with `EXPO_PUBLIC_DEMO_MODE=false` and a device-reachable API URL.
4. In the dashboard, give the attendee and scanner active membership in the same event and create area assignments.
5. Sign in to Pass with the attendee password. Initial sync downloads only that
   attendee's compact v3 credential and current authority key identity.
6. Sign in to Scan with a scanner/admin password. Initial sync downloads the
   authorized event projection, bounded authority keyring, trust generation,
   and non-expired credential/device revocations.
7. Select an area, scan the rotating 60-second presentation, then disconnect networking and repeat while the bounded session/credential remains valid.
8. Create scans, an incident, and—using an authorized role—an emergency override. Reconnect and sync. Confirm per-record acknowledgements and occurrence times in the dashboard/backend.

## Claims to make accurately

- Compact QR v3 proves identity, event, installation, credential generation,
  and possession of the certified Pass key; area authorization comes from
  current synchronized assignments or current server state.
- Scan keeps strict v2 compatibility and verifies v2/v3 signatures, event,
  expiry, synchronized revocations, and active locally synced assignments.
- Presentations have a nominal 60-second lifetime with up to 60 seconds of
  verification clock skew. V3 display is capped at 800 UTF-8 bytes and QR
  version 20.
- Trust is current for 60 seconds, soft-stale until its 24-hour hard expiry,
  and unusable afterward. Only typed inconclusive decisions use authenticated
  server fallback; fallback failure denies.
- A copied presentation can be replayed within its short validity window; screenshot blocking reduces exposure but cannot guarantee non-transferability.
- Production first-use login fails closed on bad credentials, wrong role, transport failure, or failed initial sync.
- Offline unlock reuses a previously authenticated, event-bound session for at most 24 hours.
- Queue records retain their original event, client ID, and occurrence time; only accepted or known-duplicate rows are acknowledged.
- Scan evidence supports repeated-presentation correlation through bounded
  credential/nonce hashes, but it never stores the raw QR, raw nonce,
  signatures, or key material and does not claim zero replay.

## Validation not supplied by a local static/demo run

Real SQLCipher storage, camera behavior, biometrics, device lifecycle, FCM/APNs delivery, and iOS behavior require appropriate development builds, devices, and provider credentials. Expo Go is not a fallback for these checks.

This demo does not authorize v2 retirement or authority-key rotation. Those
operations require supported-client inventory, physical Pass-to-Scan coverage,
a staged active/retiring-key exercise, observation, and an approved rollback
owner.
