# VeriGate demo guide

This guide distinguishes the local demonstration from backend-integrated behavior.

## Required build

Both mobile apps require native SQLCipher and therefore do not run in Expo Go. Build custom Android development clients or full native/EAS builds. Two devices are preferred for the Pass-to-Scan camera workflow.

## Local demo mode

Local seed identities, quick-login lists, and blank-password login are enabled only when `EXPO_PUBLIC_DEMO_MODE=true`. Production EAS profiles set it to `false`.

Demo mode is suitable for showing UI, camera scanning, area decisions, and offline local logs. It does not prove backend authentication, event authorization, PostgreSQL/Redis persistence, provider delivery, or production revocation.

## Backend-integrated demo

1. Start PostgreSQL, Redis, the backend, and dashboard; apply the Phase 1 migration and seed an event.
2. Configure `QR_AUTHORITY_PRIVATE_KEY_BASE64` only in the backend environment.
3. Build Pass and Scan with `EXPO_PUBLIC_DEMO_MODE=false` and a device-reachable API URL.
4. In the dashboard, give the attendee and scanner active membership in the same event and create area assignments.
5. Sign in to Pass with the attendee password. Initial sync downloads only that attendee's event credential.
6. Sign in to Scan with a scanner/admin password. Initial sync downloads the authorized event projection and trusted public QR authority.
7. Select an area, scan the rotating 60-second presentation, then disconnect networking and repeat while the bounded session/credential remains valid.
8. Create scans, an incident, and—using an authorized role—an emergency override. Reconnect and sync. Confirm per-record acknowledgements and occurrence times in the dashboard/backend.

## Claims to make accurately

- QR v2 uses backend P-256 authority signatures plus a per-installation Pass presentation key.
- Scan verifies signatures, event, expiry, and both signed and locally synced assignments offline.
- A copied presentation can be replayed within its short validity window; screenshot blocking reduces exposure but cannot guarantee non-transferability.
- Production first-use login fails closed on bad credentials, wrong role, transport failure, or failed initial sync.
- Offline unlock reuses a previously authenticated, event-bound session for at most 24 hours.
- Queue records retain their original event, client ID, and occurrence time; only accepted or known-duplicate rows are acknowledged.

## Validation not supplied by a local static/demo run

Real SQLCipher storage, camera behavior, biometrics, device lifecycle, FCM/APNs delivery, and iOS behavior require appropriate development builds, devices, and provider credentials. Expo Go is not a fallback for these checks.
