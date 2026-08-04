# VeriGate quick start

## Prerequisites and installation

Use Node 22.14.0, npm 10.9.2, Git, Docker Engine or Docker Desktop with Compose,
and enough free ports for isolated PostgreSQL, Redis, backend, and Dashboard
containers. The four applications are independent git submodules with their own
lockfiles.

```bash
git submodule update --init --recursive
npm run ci:all
npm --prefix web-dashboard exec -- playwright install chromium
npm run verify:qr-contract-fixtures
npm run type-check
```

On a Linux host that does not already have Chromium system dependencies, use
`npm --prefix web-dashboard exec -- playwright install --with-deps chromium`.

## Reproducible assembled-system check

The compatibility runner creates a uniquely named disposable database and
Docker project, generates matching ephemeral QR authority material and secrets
without printing them, migrates the blank database, waits for readiness, runs
the requested checks, collects redacted evidence, and removes containers,
volumes, and its secret environment file.

Run preflight without starting services:

```bash
npm run compatibility:preflight
```

Run the blank-stack migration/readiness and same-origin browser smoke check:

```bash
npm run compatibility:run
```

Run all identity, access, retry, isolation, recovery, and expiry scenarios:

```bash
npm run compatibility:convergence
```

Verify the latest evidence manifests and SHA-256 sidecars again:

```bash
npm run compatibility:verify
```

A warm smoke run normally takes roughly 2-8 minutes and the full run roughly
4-15 minutes; first-time image builds and browser installation can take longer.
Evidence is written under `compatibility-artifacts/<run-id>/`. Each scenario has
a versioned JSON manifest and matching `.sha256` file; service logs and
Playwright HTML reports are stored beside them. The directory is ignored by Git.

The full workflow covers:

1. administrative event, membership, area, level, and assignment setup;
2. Pass authentication, device registration, and attendee synchronization;
3. device-bound v3 credential and presentation generation;
4. an offline authorized-area grant;
5. an offline unauthorized-area denial;
6. typed inconclusive verification with authenticated server fallback;
7. a lost response, retry, duplicate acknowledgement, and exactly one row;
8. administrative revocation converging to Pass and Scan;
9. offline incident and emergency-override capture and upload;
10. operational record review in the production Dashboard image;
11. concurrent event isolation with overlapping logical fixture data;
12. backend/Redis failure, fail-closed behavior, and recovery; and
13. exact before/at/after credential, trust, session, and account boundaries.

Pass and Scan import production-shared protocol, request, synchronization,
decision, and queue code. Deterministic adapters replace camera transport,
installed SQLCipher, SecureStore, biometrics, OS connectivity, audio, and push
providers; every affected evidence manifest lists those substitutions.

## Failure diagnosis and cleanup

Start with the command error, then inspect the newest run directory:

- `services.log` for PostgreSQL, Redis, migration, backend, and Nginx output;
- Playwright reports/screenshots for browser failures;
- the numbered manifest nearest the failure for request/correlation IDs and
  durable assertion results; and
- `npm run compatibility:verify` for schema, scenario-set, hash, or redaction
  failures.

Normal `run` commands clean up automatically, including after a test failure.
If the process was interrupted after `compatibility:up`, or cleanup itself
failed, retry the runner-owned cleanup:

```bash
npm run compatibility:down
```

Cleanup is restricted to project names beginning with `verigate-compat-` and
the isolated database naming contract. If cleanup fails, its run state and
secret environment file are deliberately retained for another cleanup attempt;
do not commit or copy `.compatibility/`.

## Dashboard origin modes

The root container serves the Dashboard and proxies relative `/api` requests to
the backend on the Compose network. This is the default, credential-safe
same-origin mode.

For an externally hosted Dashboard, set `VITE_API_URL` to the exact public API
base URL before building the Dashboard. Configure the backend `CORS_ORIGINS`
with the exact Dashboard origin and credentials support. Production does not
permit a wildcard credentialed origin.

## Development backend and Dashboard

Create `backend/.env` from `.env.example`, configure PostgreSQL, Redis, JWT
secrets, and a secret-managed `QR_AUTHORITY_PRIVATE_KEY_BASE64` containing a
base64 PKCS#8 DER P-256 private key. For a disposable development database:

```bash
npm run setup:db
npm run seed:db
npm run dev:backend
```

In another terminal:

```bash
npm run dev:web
```

For a non-disposable existing database, follow `docs/database-operations.md`;
do not use the compatibility runner or seed command against it.

## Mobile applications and proof boundary

VeriGate Pass and Scan require native SQLCipher through
`@op-engineering/op-sqlite`; Expo Go cannot run either application. Set a
device-reachable `EXPO_PUBLIC_API_URL`, keep `EXPO_PUBLIC_DEMO_MODE=false` for
backend-integrated validation, and use a custom development client or full
native/EAS build.

The disposable compatibility run does not prove an installed SQLCipher binding,
camera, biometrics, physical radio transitions, FCM/APNs delivery, hosted
infrastructure, APK/IPA installation, or released-build behavior. Those checks
remain part of final live validation. Offline presentations are short-lived but
can still be replayed while disconnected scanners cannot coordinate.
