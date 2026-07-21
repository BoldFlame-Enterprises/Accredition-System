# VeriGate quick start

## Install and validate

Use Node 22.14.0 and npm 10.9.2. The four applications are independent git submodules with independent lockfiles.

```powershell
npm run ci:all
npm run type-check
npm test
```

## Backend and dashboard

Create `backend/.env` from `.env.example`, configure PostgreSQL, Redis, JWT secrets, and a secret-managed `QR_AUTHORITY_PRIVATE_KEY_BASE64` containing a base64 PKCS#8 DER P-256 private key.

```powershell
npm run setup:db
npm run seed:db
npm run dev:backend
```

In another terminal:

```powershell
npm run dev:web
```

For an existing database, apply `npm run migrate:events` and then `npm run migrate:phase01` before starting the remediated backend.

## Mobile apps

VeriGate Pass and Scan use native SQLCipher through `@op-engineering/op-sqlite`. Expo Go cannot run either application. Use a custom development client or full native/EAS build.

Set a device-reachable `EXPO_PUBLIC_API_URL`, then build/run each application from its directory. Production profiles explicitly set `EXPO_PUBLIC_DEMO_MODE=false`.

Local seed accounts and blank-password login exist only in an intentionally configured demo build:

```powershell
$env:EXPO_PUBLIC_DEMO_MODE='true'
npx expo run:android
```

Do not use demo mode to validate production authentication. Production login requires backend credentials and an initial event sync; subsequent offline unlock is limited to the previously authenticated 24-hour event session.

## End-to-end check

1. Sign in to the dashboard and configure event membership, areas, levels, and assignments.
2. Sign in to Pass with a backend attendee account and sync its own credential.
3. Sign in to Scan with a backend scanner/admin account and sync the event database.
4. Display the rotating Pass QR and scan it for a selected area.
5. Disconnect networking and repeat before the credential/session expires.
6. Reconnect and sync Scan; verify accepted records appear in monitoring/analytics.

Offline presentations are valid for 60 seconds and can be replayed within that window when scanners cannot coordinate. Screenshot blocking is best-effort; zero-replay offline operation is not claimed.
