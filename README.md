# VeriGate Access Control

A comprehensive, secure, and offline-capable accreditation system designed for events using QR codes for access control. The system features a simplified architecture optimized for reliability, performance, and ease of deployment.

## 🎯 Project Overview

### **Problem Statement**

Traditional accreditation systems for events often rely on physical badges or complex online verification systems that fail during network outages. This creates bottlenecks at entry points and security vulnerabilities.

### **Solution**

Our QR-based system provides:

- **Offline-first verification** using local SQLite databases on scanner devices
- **Device-bound signed QR presentations** with short validity and screen-capture protection
- **Incremental credential revocation trust** with bounded offline operation
- **Simplified user management** through CSV-like data structure
- **Foreground polling and synchronization** when network is available
- **Bounded operational workflows** with paginated administration and
  event-partitioned synchronization; representative fleet-scale performance
  remains a live-validation responsibility

### **Key Innovation**

Unlike traditional online verification systems, our approach stores encrypted user databases locally on scanner devices, enabling **instant verification** even without internet connectivity while maintaining security through periodic synchronization.

## 🏗️ System Architecture

### **Core Components**

#### 1. **Backend API Server** (`/backend`)

- **Technology**: Node.js + TypeScript + Express
- **Database**: PostgreSQL (primary) + Redis (caching)
- **Purpose**: Central data management, synchronization, and admin operations
- **Key Features**:
  - User and access level management
  - Database synchronization endpoints
  - QR code generation and validation
  - Audit logging and reporting
  - RESTful API for all client applications

#### 2. **Web Admin Dashboard** (`/web-dashboard`)

- **Technology**: React 18 + TypeScript + Vite + Tailwind CSS
- **Purpose**: Administrative interface for event organizers
- **Key Features**:
  - User management (CRUD operations)
  - Access level configuration (General, VIP, Staff, Security, Management)
  - Area management (Main Arena, VIP Lounge, Staff Areas, etc.)
  - Polling-based sync monitoring across scanner devices
  - Comprehensive reporting and analytics
  - Bulk user import/export functionality

#### 3. **VeriGate Pass App** (`/verigate-pass`)

- **Technology**: **Expo (SDK 53)** + TypeScript + Expo Router — not a bare React Native CLI project. Native capability (screen-capture protection, biometrics, encrypted SQLite) comes from the Expo module ecosystem (`expo-screen-capture`, `expo-local-authentication`, `@op-engineering/op-sqlite`) rather than hand-written native modules.
- **Target Users**: Event attendees (VIPs, staff, spectators)
- **Key Features**:
  - **Anti-screenshot QR display** via `expo-screen-capture`
  - **Device-bound signed QR presentations** with a 60-second validity window
  - **Offline QR generation** with periodic access permission updates
  - **Biometric login** (`expo-local-authentication`) with secure credential storage
  - **Backgrounding blur + auto-logout** after inactivity
  - **Access status indicator** showing permitted areas
  - **Foreground event sync + local/provider notification integration**

#### 4. **VeriGate Scan App** (`/verigate-scan`)

- **Technology**: **Expo (SDK 53)** + TypeScript + `expo-camera` — not a bare React Native CLI project or a separate "Vision Camera" native module.
- **Target Users**: Volunteers, security personnel, event staff
- **Key Features**:
  - **Offline QR verification** using an encrypted (SQLCipher, via `@op-engineering/op-sqlite`) local SQLite database
  - **Real-time camera scanning** with instant feedback via `expo-camera`
  - **Installation-bound operator authority** with explicit event selection
    before a Scan device session is issued
  - **Visual/audio feedback** (green/red indicators with distinct tones via `expo-av`), dark theme for low-light use
  - **Area selection, manual entry fallback, emergency override, and incident reporting**
  - **Local scan logging** with automatic sync (retry + backoff) when online
  - **Event-scoped area selection** reconciled against each synchronized
    authorization snapshot

## 🔐 Security Architecture

### **Offline-First Security Model**

#### **QR Code Security**

- **Identity proof, not authorization**: the compact QR proves the attendee,
  event, Pass installation, credential generation, and possession of the
  certified device key. Current area authorization comes from the synchronized
  event snapshot or current PostgreSQL state.
- **Authority Signature**: the backend signs canonical v3 event/device
  credentials with an exact P-256 key; Scan also retains a strict, separate v2
  compatibility verifier
- **Device Binding**: Pass signs each presentation with a per-installation SecureStore key certified by the backend credential
- **Time-Limited Presentations**: displayed presentations rotate every 30 seconds and have a nominal 60-second lifetime; verification separately allows up to 60 seconds of clock skew
- **Bounded Encoding**: v3 presentations are limited to 800 UTF-8 bytes and QR
  version 20 before display
- **Revocation Freshness**: Scan treats trust snapshots as current for 60
  seconds, stale until the 24-hour hard expiry, and unusable after hard expiry.
  Stale/unknown authorization decisions use authenticated server fallback when
  available and otherwise fail closed.
- **Anti-Screenshot Protection**: native mobile protection reduces casual capture but is not a complete replay defense
- **Replay Correlation**: nonce hashes and credential identity support
  correlation, but disconnected scanners cannot guarantee zero replay
- **Tamper Detection**: canonical credential and presentation signatures provide integrity; QR content is signed plaintext, not encrypted payload data

#### **Local Database Security**

- **SQLite Encryption**: Local databases encrypted with SQLCipher
- **Protected Local Keys**: random database keys are stored through each
  platform's secure-storage service; hardware backing depends on the installed
  platform and device and requires native validation
- **Integrity Verification**: startup checks require native SQLCipher capability
  and SQLite `quick_check`; failure enters an explicit recovery flow rather than
  automatically destroying audit evidence
- **Bounded Retention**: acknowledged and terminal audit rows, cached identities,
  and ended-event data use separate event-aware retention rules; unresolved
  queue evidence is preserved or quarantined for operator recovery
- **Sync Validation**: HTTPS/authentication protect transport; snapshot checksums describe content, while signed QR authority data is verified independently

#### **Authentication & Authorization**

- **Purpose-bound Authentication**: Separate account, device, and audit JWT
  audiences backed by current server-side session authority
- **Argon2id Password Hashing**: State-of-the-art password security
- **Role-Based Access Control**: Admin, Scanner, User roles with specific permissions
- **Refresh Token Rotation**: Automatic token refresh for sustained security
- **Rate Limiting**: DDoS protection and abuse prevention

### **Data Flow Security**

1. **Administrator Enrollment** → Pending identity plus a one-time activation
   token for approved out-of-band delivery
2. **QR Generation** → Authority/device-signed plaintext presentations
3. **Database Sync** → Authenticated full event snapshots plus incremental QR
   trust/revocation pages stored transactionally in encrypted local databases
4. **Local Verification** → Offline identity proof plus current synchronized
   authorization, with typed server fallback only for inconclusive decisions
5. **Log Synchronization** → Event-partitioned batch upload with durable
   accepted/duplicate/terminal/retryable acknowledgement state

## 📊 Database Schema

Multi-event tenancy is first-class: `events` and `event_members` sit above everything else, and `access_levels`, `areas`, `access_assignments`, and `scan_logs` are all scoped by `event_id`. The ordered, checksummed registry in `backend/server/database/migrationRegistry.ts` is the schema authority for both blank and existing databases. Membership is **multi-event** — a user can belong to more than one event over time via `event_members`, separate from the per-area `access_assignments` below. See [Database Operations](docs/database-operations.md) before migrating any non-disposable database.

Mobile authority is also event- and app-scoped. A production login is exchanged
for an installation registration before Pass or Scan can use protected mobile
routes. Event administrators see and control registrations only for events they
administer. Deregistration revokes normal authority and permits Scan only a
server-bounded upload of records that occurred before deregistration;
blacklisting permits no final upload and blocks re-registration until an event
administrator removes the block.

Incidents and emergency overrides use explicit, version-checked review actions
instead of direct status replacement. Assignment identifies the expected owner,
while immutable activity records the administrator who actually made each
decision. Any administrator for the event may complete an assigned review.
Their mobile `client_record_id` is idempotent within an event, not globally.
List APIs use bounded descending `(occurred_at, id)` cursors; the dashboard
polls only the recent 50-row page and loads older history on demand.

### **Core Tables** (event-scoped tables shown without their `event_id INTEGER NOT NULL REFERENCES events(id)` column for brevity)

#### **Users Table**

```sql
users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  password_hash TEXT NOT NULL,
  device_id VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('admin', 'scanner', 'user')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### **Access Levels Table**

```sql
access_levels (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);
```

#### **Areas Table**

```sql
areas (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  requires_scan BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true
);
```

#### **Access Assignments Table**

```sql
access_assignments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  access_level_id INTEGER REFERENCES access_levels(id) ON DELETE CASCADE,
  area_id INTEGER REFERENCES areas(id) ON DELETE CASCADE,
  valid_from TIMESTAMP DEFAULT NOW(),
  valid_until TIMESTAMP DEFAULT NOW() + INTERVAL '1 year',
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_id, area_id)
);
```

#### **Scan Logs Table**

```sql
scan_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  area_id INTEGER REFERENCES areas(id) ON DELETE CASCADE,
  scanner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  access_granted BOOLEAN NOT NULL,
  failure_reason TEXT,
  scanned_at TIMESTAMP DEFAULT NOW(),
  device_info JSONB
);
```

### **Sample Data Structure**

#### **Access Levels**

- **General** (Priority 1): Basic access to public areas
- **VIP** (Priority 5): Premium access including VIP lounges
- **Staff** (Priority 3): Work areas and operational zones
- **Security** (Priority 4): Security zones and emergency areas
- **Management** (Priority 6): All areas including restricted zones

#### **Areas**

- **Main Arena**: Primary event venue (all access levels)
- **VIP Lounge**: Exclusive area (VIP, Staff, Management only)
- **Staff Area**: Operational zones (Staff, Security, Management)
- **Security Zone**: Control rooms (Security, Management only)
- **General Entrance**: Main entry point (all access levels)
- **Parking**: Vehicle areas (no scan required)
- **Food Court**: Dining areas (no scan required)

## 🔄 Synchronization Strategy

### **Offline-First Approach**

#### **Scanner App Sync Flow**

1. **Initial Setup**:
   - Download complete event-scoped user and area snapshots
   - Retain the bounded authority keyring, trust generation, and non-expired
     credential/device revocations
   - Store the data in the device's SQLCipher database
2. **During Event**:
   - **Primary**: Verify strict v2/v3 signatures and authorize against current
     local event data
   - **Fallback**: Ask the authenticated server only when a cryptographically
     valid local decision is inconclusive; fail closed if unavailable
   - **Logging**: Store every decision with idempotency and bounded evidence,
     never the raw QR
   - **Foreground Sync**: Poll at a nominal 10-second cadence, with bounded backoff/jitter after failure, and retain manual feedback

3. **Emergency Procedures**:
   - **Manual Override**: Authorized personnel can grant access with reason logging
   - **Network Outage**: Continue only within the previously authenticated
     session, credential bounds, and 24-hour trust hard-expiry policy
   - **Data Corruption**: Re-download database with integrity verification

#### **QR Generator App Sync Flow**

1. **Authentication**: Login once with secure credential storage
2. **QR Generation**: Create device-bound signed presentations locally from the current credential
3. **Permission Updates**: Pull the authenticated attendee's full event projection on a nominal 10-second foreground cadence with backoff/jitter
4. **Offline Capability**: Generate QR codes without network connectivity

Neither mobile app claims supported background synchronization. Both expose manual foreground sync; the automatic scheduler is active only while the authenticated screen lifecycle is active.

### **Data Synchronization Protocols**

#### **Snapshot and queue synchronization**

- User, area, QR trust, and active-cycle metadata are promoted in one local
  SQLite transaction after the complete event snapshot validates; readers see
  either the prior cycle or the complete new cycle
- Scan logs use batches of 25 with at most four batches per cycle
- Incidents and overrides use at most two batches of ten per queue per cycle
- Active scan selection is limited to the signed device-session event and
  eligible retry time. Accepted/duplicate acknowledgements mark durable
  success; structured terminal rejections remain retained without blocking
  later eligible rows; transient/authentication failures remain pending and
  stop safely

#### **Integrity Verification**

- SHA-256 checksums for all synchronized data
- Version numbers for tracking updates
- Rollback capability for corrupted data

#### **Network Resilience**

- Graceful degradation during poor connectivity
- Retry mechanisms with exponential backoff
- Priority synchronization for critical updates

## 📱 Mobile Application Features

### **VeriGate Pass App**

#### **User Experience**

- **Simple Login**: Email/password authentication with biometric option
- **QR Display**: Full-screen QR code with access level indicator
- **Status Information**: Shows permitted areas and access validity
- **Event Updates**: Receive notifications about schedule changes
- **Offline Mode**: Continue showing QR codes without internet

#### **Security Features**

- **Screen Capture Protection**: Prevents screenshots and screen recording
- **App Backgrounding**: Blurs content when app goes to background
- **Device Verification**: QR codes tied to specific device identifiers
- **Auto-Logout**: Security timeout after inactivity
- **Secure Storage**: All credentials stored in device keychain

### **VeriGate Scan App**

#### **Scanning Interface**

- **Optimized Camera**: Auto-focus with QR detection overlay
- **Instant Feedback**: Immediate green/red visual indicators
- **Audio Cues**: Success/failure sounds for noisy environments
- **Large Text Display**: Clear access decision messaging
- **Dark Mode**: Optimized for low-light scanning conditions

#### **Operational Features**

- **Quick Statistics**: Daily scan counts and success rates
- **Area Selection**: Choose scanning location for proper validation
- **User Information**: Display scanned user details for verification
- **Manual Entry**: Backup option for damaged QR codes
- **Emergency Access**: Override capabilities with approval workflow

#### **Administrative Controls**

- **Multi-User Support**: Multiple volunteers can use same device
- **Role-Based UI**: Different interfaces for volunteers vs security
- **Incident Reporting**: Flag suspicious activities or technical issues
- **Sync Status**: Visual indicators for database freshness and connectivity

## 🚀 Deployment Architecture

### **Development Environment**

#### **Prerequisites**

- **Node.js** 22.14.0 and **npm** 10.9.2 (pinned by `.nvmrc` and every package manifest)
- **PostgreSQL** 13+ (Primary database)
- **Redis** 6+ (Optional, for caching and sessions — the backend runs fine without it, fail-open)
- **Expo CLI / EAS CLI** (Mobile app development)
- **Android Studio** (Android development and testing)
- **Xcode** (iOS development, macOS only)

Each of the four apps (`backend`, `web-dashboard`, `verigate-pass`, `verigate-scan`) is an **independent git submodule with its own tracked npm lockfile** — they are not a unified npm/pnpm workspace, because the web dashboard needs React 18 and the Expo apps need React 19; hoisting them into one workspace causes duplicate-React-type conflicts. Use `npm ci` for clean, reproducible installs.

#### **Quick Start**

```bash
# Clone (with submodules) and setup
git clone --recurse-submodules <repository-url>
cd verigate-access-control
nvm use
npm run ci:all

# Backend
cd backend
cp .env.example .env
# Edit .env with your database credentials
# For a blank disposable database:
npm run setup:db
# For an existing database instead, inspect the immutable migration ledger:
npm run migrate:status
# Run this only after the documented backup and isolated-restore gates pass.
npm run migrate:db
# Only for an explicitly confirmed disposable database: set
# ALLOW_DATABASE_SEED=true and SEED_DATABASE_NAME_CONFIRMATION to the exact
# current database name in .env, then remove/reset both values afterward.
npm run seed:db
npm run dev

# Web dashboard (separate terminal)
cd web-dashboard
cp .env.example .env
npm run dev

# Mobile apps require a custom dev client/full native build. Expo Go cannot
# load the native SQLCipher dependency used by either application.
cd verigate-pass && npm start
cd verigate-scan && npm start
```

The root package supplies `concurrently` and the convenience scripts. `npm run ci:all` installs the root and all four independent packages from their lockfiles. After that, the root wrappers include `npm run setup:db`, `npm run seed:db`, `npm run dev` (backend + dashboard), `npm run dev:backend`, `npm run dev:web`, `npm run start:pass`, and `npm run start:scan`.

### **Production Deployment**

#### **Docker Containerization**

```yaml
# docker-compose.yml includes:
- PostgreSQL database with persistent volumes
- Redis cache for session management
- Backend API server with auto-restart
- Web dashboard with Nginx reverse proxy
- Environment-specific configuration
```

#### **Cloud Deployment Options**

##### VPS/Dedicated Server

- Single server deployment with Docker Compose
- Suitable for events up to 1000 participants
- Cost-effective for single-use events

##### Cloud Platform (AWS/Azure/GCP)

- Managed database services (RDS/Cloud SQL)
- Container orchestration (ECS/AKS/GKE)
- Auto-scaling capabilities for large events
- CDN for mobile app distribution

##### Serverless

- API Gateway + Lambda functions
- DynamoDB or managed PostgreSQL
- Cost-effective for infrequent usage

### **Mobile App Distribution**

#### **VeriGate Pass App Distribution**

- **Internal Distribution**: Enterprise app distribution
- **App Store**: Public release for user download
- **APK/IPA**: Direct installation for testing

#### **VeriGate Scan App Distribution**

- **Restricted Distribution**: Only for authorized personnel
- **Device Management**: MDM integration for enterprise deployment
- **Kiosk Mode**: Dedicated devices for high-traffic areas

## 🛠️ Development Workflow

### **Project Structure**

```file structure
verigate-access-control/
├── backend/                 # Node.js/TypeScript API Server
│   ├── server/
│   │   ├── routes/         # API endpoints (auth, sync, qr, etc.)
│   │   ├── middleware/     # Authentication, validation, error handling
│   │   ├── config/         # Database and Redis configuration
│   │   ├── scripts/        # Database setup and seeding
│   │   └── types/          # TypeScript type definitions
│   ├── dist/               # Compiled JavaScript (auto-generated)
│   ├── .env.example        # Environment template
│   └── package.json        # Backend dependencies
│
├── web-dashboard/          # React Admin Dashboard
│   ├── src/               # React source code
│   ├── package.json       # Web dependencies
│   └── README.md          # Web-specific documentation
│
├── verigate-pass/         # Expo (SDK 53) attendee app
│   ├── app/                # Expo Router routes
│   ├── src/                 # Services (DB, sync, auth, notifications), context
│   ├── package.json       # Mobile dependencies
│   └── README.md          # Pass app documentation
│
├── verigate-scan/         # Expo (SDK 53) scanner app
│   ├── app/                # Expo Router routes
│   ├── src/                 # Services (DB, sync, audio feedback), context
│   ├── package.json       # Scanner dependencies
│   └── README.md          # Scanner documentation
│
├── package.json           # Root convenience scripts (each app installs independently)
├── docker-compose.yml     # Complete deployment setup
├── .gitignore            # Comprehensive ignore rules
└── README.md             # This documentation
```

Native `android/`/`ios/` folders for the two Expo apps don't exist in git — they're generated on demand by `npx expo prebuild` and are gitignored, matching normal Expo project layout.

### **Development Commands**

#### **Root Level (convenience wrappers, no shared workspace)**

```bash
npm run ci:all          # reproducible install for root and all four apps
npm run setup:db        # backend: apply the registry to a blank database
npm run migrate:status  # backend: read-only ledger/checksum status
npm run migrate:db      # backend: apply pending capability migrations
npm run seed:db         # backend: gated destructive demo-data replacement
npm run dev             # backend + web dashboard, concurrently
npm run dev:backend     # backend only
npm run dev:web         # web dashboard only
npm run start:pass      # verigate-pass (Expo dev server)
npm run start:scan      # verigate-scan (Expo dev server)
npm run type-check      # all four apps
npm run lint            # dashboard and both mobile apps
npm test                # committed backend, dashboard, Pass, and Scan tests
npm run doctor          # Expo Doctor for both mobile apps
npm run validate        # type-check, lint, tests, builds, and Expo Doctor
```

The aggregate test gate runs the committed backend, dashboard, Pass, and Scan suites. These tests and static builds validate source behavior; they are not substitutes for hosted-service, provider, or physical-device validation.

#### **Backend Specific**

```bash
cd backend
npm run dev             # Start with hot reload (ts-node-dev)
npm run build           # Compile TypeScript to JavaScript
npm start               # Run compiled JavaScript
npm run setup:db        # Apply the complete registry to a blank database
npm run migrate:status  # Read-only ledger/checksum status
npm run migrate:db      # Apply every pending capability in registry order
npm run seed:db         # Gated destructive demo-data replacement
npm run type-check      # TypeScript type validation
npm test                # Jest test suite
```

#### **Web Dashboard Specific**

```bash
cd web-dashboard
npm run dev             # Start Vite development server
npm run build           # Type-check + build for production
npm run preview         # Preview production build
```

#### **Mobile Apps (Expo)**

```bash
# Development bundler (run the result in a custom development client)
cd verigate-pass        # or verigate-scan
npm start               # Start the Expo dev server
npm run android         # Run on Android device/emulator
npm run ios             # Run on iOS device/simulator
npm run type-check      # TypeScript validation
npm run lint            # Expo lint
npm run doctor          # Expo project compatibility checks

# Full feature set including SQLCipher-encrypted local DB requires a custom
# dev client / prebuild (op-sqlite is a native module, incompatible with Expo Go):
npx expo prebuild
npx expo run:android    # or: npx expo run:ios

# EAS cloud builds
npm run build:android   # or: npm run build:ios
```

## 📚 API Documentation

### **Authentication Endpoints**

```apis
POST /api/auth/login
  Body: { email, password, client_kind }
  Dashboard response: { user, accessToken, csrfToken } + HttpOnly refresh cookie
  Mobile response: { user, accessToken, refreshToken }

GET /api/auth/csrf
  Response: { csrfToken } for the current browser refresh session

POST /api/auth/refresh
  Dashboard: refresh cookie + X-CSRF-Token
  Mobile: Body { refreshToken }

POST /api/auth/activate
POST /api/auth/reset-password
POST /api/auth/logout
POST /api/auth/logout-all
```

### **Event Endpoints**

```apis
GET /api/events
  Response: events[] the caller is a member of (all events, if admin)

POST /api/events            (admin)
  Body: { name, slug, description?, starts_at?, ends_at? }

GET /api/events/:id/members  (admin)
POST /api/events/:id/members (admin)   Body: { user_id, role_in_event? }
```

### **QR Code Endpoints**

```apis
GET /api/qr/generate?event_id=<id>
  Headers: { Authorization: "Bearer <token>" }
  Query: { device_id, device_public_key, protocol_version: 3 }
  Response: { contract_version: "qr-credential-v3", credential, active_authority_key_id, registration_generation, expires_at, generated_at }

POST /api/qr/verify        (deprecated alias for the same verification authority)
  Body: { qr_content, area_id, event_id }
  Response: { access_granted, user, area, reason? }
```

### **Scan Endpoints**

```apis
POST /api/scan/verify       # the one real, server-side verification fallback path
  Body: { qr_code, area_id, event_id, device_scan_id, device_info?, local_evidence? }
  Response: { access_granted, user?, area?, reason?, decision_code?, persistence }
```

### **Synchronization Endpoints**

```apis
GET /api/sync/users-database?event_id=<id>
  Response: { contract_version: "event-user-v2", users[], metadata: { checksum, timestamp, version, event_id } }

GET /api/sync/areas-database?event_id=<id>
  Response: { areas[], access_levels[], metadata: { checksum, timestamp, event_id } }

GET /api/sync/qr-trust?event_id=<id>&cursor=<opaque>&limit=<n>
  Response: { contract_version: "qr-trust-v1", generation, generated_at, hard_expires_at, authority_keys[], revocations[], next_cursor, checksum }

POST /api/sync/scan-logs
  Body: { logs[] /* device_scan_id plus bounded decision evidence */, device_id, event_id }
  Response: { contract_version: "queue-ack-v2", results[], accepted, duplicates, rejected, retryable_errors, total }
```

### **Admin, Analytics & Notification Endpoints**

```apis
GET /api/admin/dashboard?event_id=<id>
  Response: { members, areas, access_levels, scans, scans_by_area, recent_scans, device_activity }

GET /api/analytics/scan-volume?event_id=<id>      # hourly buckets + peak hours
GET /api/analytics/breakdown?event_id=<id>        # by area / access level / scanner + grant rate
GET /api/analytics/export/scans.csv?event_id=<id>  # CSV export

POST /api/notifications/register-device   Body: { event_id, token, platform }
POST /api/notifications/unregister-device Body: { token }
POST /api/notifications/send              (admin)
  Body: { event_id, title, body, audience: "event", confirm_broadcast: true }
     or { event_id, title, body, audience: "users", user_ids: [...] }
GET  /api/notifications/jobs/:id?event_id=<id> (event admin) # job + recipient-state summary
POST /api/notifications/sync-heartbeat    Body: { device_id, app, event_id, platform? }
GET  /api/notifications/device-status?event_id=<id>  (admin) # polled sync monitor

POST /api/devices/session
GET  /api/devices/state                     # Pass registration state
GET  /api/devices/scan-state                # Scan registration state
GET  /api/devices/events/:event_id          # event-administrator registration directory
POST /api/devices/events/:event_id/registrations/:id/deregister
POST /api/devices/events/:event_id/registrations/:id/blacklist
POST /api/devices/events/:event_id/registrations/:id/unblacklist
POST /api/devices/audit-credential          # Scan-only bounded deregistration upload

GET  /api/incidents?event_id=<id>&limit=<1..200>&cursor=<opaque> (admin)
GET  /api/incidents/summary?event_id=<id>  (admin)
POST /api/incidents                        Body: { event_id, description, category?, area_id?, client_record_id, occurred_at }
  Response: { contract_version: "queue-ack-v2", client_record_id, status, record? }
POST /api/incidents/:id/actions/:action     # assign, begin-review, resolve, dismiss, reopen
GET  /api/incidents/:id/activity
GET  /api/incidents/overrides?event_id=<id>&limit=<1..200>&cursor=<opaque> (admin)
GET  /api/incidents/overrides/summary?event_id=<id> (admin)
POST /api/incidents/overrides              Body: { event_id, area_id, reason, access_granted?, user_id?, client_record_id, occurred_at }
  Response: { contract_version: "queue-ack-v2", client_record_id, status, record? }
POST /api/incidents/overrides/:id/actions/:action # assign, begin-review, complete-review, reopen
GET  /api/incidents/overrides/:id/activity

GET /api/users
  Query: { page?, limit?, search?, role?, is_active? }
  Response: { users[], pagination }

POST /api/users                (admin)
POST /api/users/bulk-import     (admin)  Body: { csv }
GET  /api/users/export/csv      (admin)
POST /api/users/:id/reissue-activation (admin)
```

## 🧪 Testing Strategy

### **Test Data**

After running `npm run seed:db` in `backend/`, these test accounts are available (all scoped to the seeded "VeriGate Demo Championship" event):

The command always requires `ALLOW_DATABASE_SEED=true` and
`SEED_DATABASE_NAME_CONFIRMATION` equal to `SELECT current_database()`, and it
refuses `NODE_ENV=production`. It transactionally deletes assignments, scans,
memberships, `%@test.com` users, access levels, areas, and events. Cascades also
remove event-scoped device tokens/sync status/credentials, incidents, and
emergency overrides. Other global users are preserved, but rows tied to deleted
events are not. Use only a disposable development database.

- **Admin**: `admin@test.com / password123` (Full system access)
- **Scanner**: `scanner@test.com / password123` (Scanner app access, Staff level)
- **VIP User**: `vip@test.com / password123` (VIP areas access)
- **Staff**: `staff@test.com / password123` (Staff areas access)
- **General**: `general@test.com / password123` (Basic access)

### **Testing Scenarios**

#### **Offline Testing**

1. Setup scanner app with synced database
2. Disconnect from internet
3. Verify QR codes work without connectivity
4. Reconnect and verify logs sync properly

#### **Security Testing**

1. Attempt QR code screenshot/sharing between devices
2. Test expired QR code rejection
3. Verify unauthorized area access denial
4. Test device-bound QR code validation

#### **Performance Testing**

1. Bulk scan testing (100+ scans/minute)
2. Large database sync (1000+ users)
3. Network interruption during sync
4. Multiple concurrent scanner devices

## 🔧 Configuration

### **Environment Variables**

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=verigate_access_control
DB_USER=postgres
DB_PASSWORD=your_secure_password

# Redis (Optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_REQUIRED=false
REDIS_CONNECT_TIMEOUT_MS=1500

# JWT Security
JWT_ACCOUNT_ACCESS_SECRET=independent_random_value_of_at_least_32_bytes
JWT_ACCOUNT_REFRESH_SECRET=independent_random_value_of_at_least_32_bytes
JWT_DEVICE_ACCESS_SECRET=independent_random_value_of_at_least_32_bytes
JWT_DEVICE_REFRESH_SECRET=independent_random_value_of_at_least_32_bytes
JWT_AUDIT_ACCESS_SECRET=independent_random_value_of_at_least_32_bytes
JWT_ISSUER=https://your-api.example.com
JWT_EXPIRE_TIME=1h
JWT_REFRESH_EXPIRE_TIME=7d

# Encryption
ENCRYPTION_KEY=your_32_character_encryption_key

# QR signing authority (private key remains backend-only; mobile apps receive public credentials)
QR_AUTHORITY_PRIVATE_KEY_BASE64=<base64 PKCS8 DER P-256 private key from secret manager>

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Push notifications - Android FCM (free)
FCM_PROJECT_ID=
FCM_CLIENT_EMAIL=
FCM_PRIVATE_KEY=

# Push notifications - iOS APNs (gated, default off - needs a paid Apple Developer account)
APNS_ENABLED=false
APNS_KEY_PATH=
APNS_KEY_ID=
APNS_TEAM_ID=
APNS_BUNDLE_ID=
APNS_PRODUCTION=false
```

### **Production Security Checklist**

- [ ] Change all default passwords and secrets
- [ ] Enable HTTPS with valid SSL certificates
- [ ] Configure firewall rules for database access
- [ ] Record deployment-specific backup/PITR owner, retention, RPO, and RTO
- [ ] Prove the latest backup with an isolated restore before schema migration
- [ ] Enable audit logging and monitoring
- [ ] Implement intrusion detection
- [ ] Regular security updates and patches

## 📈 Scalability Considerations

### **User Capacity**

- **Small Events** (50-200 users): Single server deployment
- **Medium Events** (200-1000 users): Load balancer + multiple API servers
- **Large Events** (1000+ users): Microservices with auto-scaling

### **Scanner Device Management**

- **Few Devices** (2-5): Manual configuration
- **Many Devices** (10+): MDM integration for automated deployment
- **Enterprise Scale**: Custom device management dashboard

### **Database Performance**

- **Indexing**: Optimized indexes for scan logs and user lookups
- **Partitioning**: Time-based partitioning for scan logs
- **Read Replicas**: Separate read/write workloads
- **Caching**: Redis for frequent database queries

## 🎬 End-to-end demo (no mocks, against the real backend)

```bash
# 1. Postgres + Redis (docker-compose, or your own local instances)
docker-compose up -d postgres redis

# 2. Backend
cd backend && npm ci
cp .env.example .env   # fill in DB_* at minimum
npm run setup:db
# For this disposable database only, set ALLOW_DATABASE_SEED=true and set
# SEED_DATABASE_NAME_CONFIRMATION to its exact current_database(), then:
npm run seed:db
npm run dev             # http://localhost:3000

# 3. Web dashboard (new terminal)
cd web-dashboard && npm ci
npm run dev              # http://localhost:5173

# 4. Pass app (new terminal) - use a custom development client
cd verigate-pass && npm ci && npm start

# 5. Scan app (new terminal)
cd verigate-scan && npm ci && npm start
```

Then:
1. Open the dashboard, sign in as `admin@test.com` / `password123` (seeded above), confirm the "VeriGate Demo Championship" event is selected.
2. Create a new user (or use the seeded `vip@test.com`) and assign them an access level + area under **Access & Assignments**.
3. In the pass app, log in as that user with their email + `password123` (fill in the password field so it authenticates against the real backend and syncs) — the QR screen shows their real, event-scoped access level and areas.
4. In the scan app, log in as `scanner@test.com` / `password123`, select the same area, and scan the pass app's QR — you'll get a real green "GRANTED" result plus audio feedback, logged locally.
5. Tap **Sync with event** in the scan app to upload the scan log to the backend.
6. Back in the dashboard, the polling **Overview**/**Analytics** pages refresh approximately every 10 seconds; backend live aggregates use five-second cache windows retained for 15 seconds. **Sync Monitor** uses the same polling model.
7. In **Access & Assignments**, change that user's access level or area. With a correctly configured provider/device, Pass can receive the Android notification; otherwise provider sending fails open and the foreground/manual sync path still refreshes access.

For local SQLCipher encryption and the rest of the mobile feature set (biometric login, manual entry, overrides, incident reporting), build a dev client per the mobile apps' READMEs (`npx expo prebuild && npx expo run:android`) instead of using Expo Go.

## 🧭 Future Work

Repository tests validate deterministic configuration, migration, authorization,
queue, retention, and UI contracts. They do not establish a current APK/IPA
build, installation, physical-device notification/camera/biometric/SQLCipher
behavior, process-kill recovery, provider delivery, fleet performance, or hosted
end-to-end behavior. APNs remains gated off by default and requires separate
provider/device validation. Scan intentionally remains local-notification-only.

## 🤝 Contributing

### **Development Guidelines**

1. Follow TypeScript strict mode conventions
2. Write comprehensive tests for new features
3. Document API changes in README
4. Use conventional commits for version control
5. Test mobile apps on both iOS and Android

### **Contribution Process**

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request with detailed description

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

### **Technical Support**

- **Issues**: Create GitHub issues for bugs and feature requests
- **Documentation**: Check component-specific READMEs for detailed information
- **Community**: Join project discussions for community support

### **Emergency Contact**

For critical production issues during events:

- Monitor system health dashboard
- Check application logs for error details
- Escalate to development team via designated channels

---
