# QR Code-based Accreditation System for Sports Events

A comprehensive, secure, and offline-capable accreditation system designed for sports events using QR codes for access control. The system features a simplified architecture optimized for reliability, performance, and ease of deployment.

## 🎯 Project Overview

### **Problem Statement**

Traditional accreditation systems for sports events often rely on physical badges or complex online verification systems that fail during network outages. This creates bottlenecks at entry points and security vulnerabilities.

### **Solution**

Our QR-based system provides:

- **Offline-first verification** using local SQLite databases on scanner devices
- **Secure QR codes** with device-bound encryption and anti-screenshot protection
- **Simplified user management** through CSV-like data structure
- **Real-time synchronization** when network is available
- **Scalable architecture** supporting 500+ users with multiple entry points

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
  - Real-time sync monitoring across scanner devices
  - Comprehensive reporting and analytics
  - Bulk user import/export functionality

#### 3. **QR Generator Mobile App** (`/SportGatePass`)

- **Technology**: React Native CLI + TypeScript + Native Modules
- **Target Users**: Event attendees (athletes, VIPs, staff, spectators)
- **Key Features**:
  - **Anti-screenshot QR display** using native screen capture protection
  - **Device-bound QR codes** that cannot be shared or copied
  - **Offline QR generation** with periodic access permission updates
  - **Simple authentication** with secure credential storage
  - **Access status indicator** showing permitted areas
  - **Event information** and updates
  - **Fast local builds** (2-5 minutes vs 400+ minutes with Expo)

#### 4. **Scanner Mobile App** (`/SportGateScan`)

- **Technology**: React Native CLI + Native Camera + SQLite
- **Target Users**: Volunteers, security personnel, event staff
- **Key Features**:
  - **Offline QR verification** using encrypted local SQLite database
  - **Real-time camera scanning** with instant feedback via Vision Camera
  - **Role-based access** (volunteer, security, admin privileges)
  - **Visual/audio feedback** (green/red indicators with sounds)
  - **Local scan logging** with automatic sync when online
  - **Emergency override** capabilities for authorized personnel
  - **Multi-area support** for volunteers working different zones
  - **Native performance** with direct hardware access

## 🔐 Security Architecture

### **Offline-First Security Model**

#### **QR Code Security**

- **Encrypted Content**: QR codes contain HMAC-SHA256 encrypted user data
- **Device Binding**: QR codes include device-specific fingerprints
- **Time-Limited Tokens**: QR codes expire and refresh automatically (1-hour default)
- **Anti-Screenshot Protection**: Native mobile protection prevents screenshots
- **Tamper Detection**: Checksum validation ensures QR integrity

#### **Local Database Security**

- **SQLite Encryption**: Local databases encrypted with SQLCipher
- **Device-Specific Keys**: Encryption keys tied to device hardware
- **Integrity Verification**: SHA-256 checksums validate database integrity
- **Data Expiration**: Local data auto-expires after event completion
- **Sync Validation**: All synchronization includes cryptographic verification

#### **Authentication & Authorization**

- **JWT-based Authentication**: Secure token-based authentication
- **Argon2id Password Hashing**: State-of-the-art password security
- **Role-Based Access Control**: Admin, Scanner, User roles with specific permissions
- **Refresh Token Rotation**: Automatic token refresh for sustained security
- **Rate Limiting**: DDoS protection and abuse prevention

### **Data Flow Security**

1. **User Registration** → Secure password hashing and storage
2. **QR Generation** → Device-bound encrypted tokens
3. **Database Sync** → Encrypted payload with integrity checks
4. **Local Verification** → Offline validation with audit logging
5. **Log Synchronization** → Batch upload with deduplication

## 📊 Database Schema

### **Core Tables**

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
   - Download compressed user database (encrypted SQLite)
   - Verify database integrity with SHA-256 checksum
   - Store locally with device-specific encryption
2. **During Event**:
   - **Primary**: Verify QR codes using local database
   - **Fallback**: API verification if local check inconclusive
   - **Logging**: Store all scans locally with timestamps
   - **Periodic Sync**: Upload logs and check for database updates (every 30 minutes)

3. **Emergency Procedures**:
   - **Manual Override**: Authorized personnel can grant access with reason logging
   - **Network Outage**: Continue offline operation indefinitely
   - **Data Corruption**: Re-download database with integrity verification

#### **QR Generator App Sync Flow**

1. **Authentication**: Login once with secure credential storage
2. **QR Generation**: Create device-bound QR codes locally
3. **Permission Updates**: Refresh access permissions hourly when online
4. **Offline Capability**: Generate QR codes without network connectivity

### **Data Synchronization Protocols**

#### **Delta Synchronization**

- Only sync changes since last update timestamp
- Minimize bandwidth usage for large user databases
- Conflict resolution using server-side timestamps

#### **Integrity Verification**

- SHA-256 checksums for all synchronized data
- Version numbers for tracking updates
- Rollback capability for corrupted data

#### **Network Resilience**

- Graceful degradation during poor connectivity
- Retry mechanisms with exponential backoff
- Priority synchronization for critical updates

## 📱 Mobile Application Features

### **QR Generator App**

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

### **Scanner App**

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

- **Node.js** 18+ (Backend and build tools)
- **PostgreSQL** 13+ (Primary database)
- **Redis** 6+ (Optional, for caching and sessions)
- **pnpm** 8+ (Package manager for workspaces)
- **React Native CLI** (Mobile app development)
- **Android Studio** (Android development and testing)
- **Xcode** (iOS development, macOS only)

#### **Quick Start**

```bash
# Clone and setup
git clone <repository-url>
cd accreditation-system

# Install all dependencies
pnpm install:all

# Setup backend environment
cd backend
cp .env.example .env
# Edit .env with your database credentials

# Initialize database
pnpm run setup:db
pnpm run seed:db

# Start development
cd ..
pnpm run dev  # Starts backend + web dashboard

# Mobile apps (separate terminals)
cd qr-generator-app && pnpm start
cd scanner-app && pnpm start
```

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

#### **QR Generator App Distribution**

- **Internal Distribution**: Enterprise app distribution
- **App Store**: Public release for user download
- **APK/IPA**: Direct installation for testing

#### **Scanner App Distribution**

- **Restricted Distribution**: Only for authorized personnel
- **Device Management**: MDM integration for enterprise deployment
- **Kiosk Mode**: Dedicated devices for high-traffic areas

## 🛠️ Development Workflow

### **Project Structure**

```file structure
accreditation-system/
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
├── SportGatePass/         # React Native CLI QR Generator App
│   ├── src/               # React Native source
│   ├── android/           # Android native code
│   ├── ios/               # iOS native code
│   ├── package.json       # Mobile dependencies
│   └── README.md          # QR Generator documentation
│
├── SportGateScan/         # React Native CLI Scanner App
│   ├── src/               # React Native source
│   ├── android/           # Android native code
│   ├── ios/               # iOS native code
│   ├── package.json       # Scanner dependencies
│   └── README.md          # Scanner documentation
│
├── build-react-native.sh  # Fast local build script for mobile apps
├── package.json           # Root workspace configuration
├── docker-compose.yml     # Complete deployment setup
├── .gitignore            # Comprehensive ignore rules
└── README.md             # This documentation
```

### **Development Commands**

#### **Root Level (All Components)**

```bash
pnpm install:all        # Install dependencies for all components
pnpm dev                # Start backend + web dashboard
pnpm build              # Build all components for production
pnpm test               # Run tests across all components
pnpm lint               # Lint all components
pnpm type-check         # TypeScript validation
pnpm clean              # Clean all build artifacts and dependencies
```

#### **Backend Specific**

```bash
cd backend
pnpm run dev            # Start with hot reload (ts-node-dev)
pnpm run build          # Compile TypeScript to JavaScript
pnpm run start          # Run compiled JavaScript
pnpm run setup:db       # Create database tables and indexes
pnpm run seed:db        # Populate with test data
pnpm run type-check     # TypeScript type validation
```

#### **Web Dashboard Specific**

```bash
cd web-dashboard
pnpm run dev            # Start Vite development server
pnpm run build          # Build for production
pnpm run preview        # Preview production build
```

#### **Mobile Apps (React Native CLI)**

```bash
# Development
cd SportGatePass        # or SportGateScan
pnpm start              # Start Metro bundler
pnpm run android        # Run on Android device/emulator
pnpm run ios            # Run on iOS device/simulator

# Fast local builds (recommended)
./build-react-native.sh # Interactive build script
# Options: 1=Pass, 2=Scan, 3=Both apps

# Manual builds
cd SportGatePass/android && ./gradlew assembleRelease  # Android APK
cd SportGatePass && npx react-native run-ios --scheme=Release  # iOS
```

## 📚 API Documentation

### **Authentication Endpoints**

```apis
POST /api/auth/register
  Body: { email, name, phone, password, role? }
  Response: { user, accessToken, refreshToken }

POST /api/auth/login
  Body: { email, password }
  Response: { user, accessToken, refreshToken }

POST /api/auth/refresh
  Body: { refreshToken }
  Response: { accessToken, refreshToken }
```

### **QR Code Endpoints**

```apis
GET /api/qr/generate
  Headers: { Authorization: "Bearer <token>" }
  Response: { qr_content, user_info, expires_at }

POST /api/qr/verify
  Body: { qr_content, area_id }
  Response: { access_granted, user_name, message }
```

### **Synchronization Endpoints**

```apis
GET /api/sync/users-database
  Headers: { Authorization: "Bearer <token>" }
  Response: { users[], metadata: { checksum, timestamp, version } }

GET /api/sync/areas-database
  Headers: { Authorization: "Bearer <token>" }
  Response: { areas[], metadata: { checksum, timestamp } }

POST /api/sync/scan-logs
  Body: { logs[], device_id }
  Response: { processed, errors, total }

GET /api/sync/check-updates
  Query: { users_version?, areas_version? }
  Response: { users_update_available, areas_update_available }
```

### **Admin Endpoints**

```apis
GET /api/admin/dashboard
  Response: { stats, recent_scans, active_users }

GET /api/users
  Query: { page?, limit?, search? }
  Response: { users[], pagination }

POST /api/users
  Body: { email, name, phone, access_level, areas[] }
  Response: { user }
```

## 🧪 Testing Strategy

### **Test Data**

After running `pnpm run seed:db`, these test accounts are available:

- **Admin**: `admin@test.com / password123` (Full system access)
- **Scanner**: `scanner@test.com / password123` (Scanner app access)
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
DB_NAME=accreditation_system
DB_USER=postgres
DB_PASSWORD=your_secure_password

# Redis (Optional)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Security
JWT_SECRET=your_production_jwt_secret_256_bits_minimum
JWT_REFRESH_SECRET=your_production_refresh_secret
JWT_EXPIRE_TIME=1h
JWT_REFRESH_EXPIRE_TIME=7d

# Encryption
ENCRYPTION_KEY=your_32_character_encryption_key
PEPPER_SECRET=additional_password_security_pepper

# QR Configuration
QR_CODE_EXPIRE_MINUTES=60
QR_CODE_REFRESH_INTERVAL=30

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### **Production Security Checklist**

- [ ] Change all default passwords and secrets
- [ ] Enable HTTPS with valid SSL certificates
- [ ] Configure firewall rules for database access
- [ ] Setup backup and recovery procedures
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
