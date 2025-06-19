# Web Admin Dashboard

React-based admin dashboard for managing the QR Code Accreditation System.

## 🎯 Purpose

Provides administrators with a web interface to:
- Manage users and access levels
- Configure areas and permissions
- View real-time analytics and reports
- Monitor security logs and access attempts
- Bulk import/export user data

## 🛠️ Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: React Query
- **Forms**: React Hook Form with Zod validation
- **Charts**: Recharts
- **Icons**: Lucide React
- **Routing**: React Router DOM

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Start development server
pnpm run dev

# Build for production
pnpm run build
```

## 📱 Features (To Be Implemented)

### Dashboard Overview
- Real-time statistics
- Access attempt graphs
- User activity monitoring
- System health indicators

### User Management
- Create, edit, and deactivate users
- Assign access levels and areas
- Bulk user operations
- User activity history

### Access Control
- Manage access levels (General, VIP, Staff, etc.)
- Configure area permissions
- Set time-based access restrictions
- Emergency access controls

### Analytics & Reporting
- Entry/exit logs
- Access pattern analysis
- Security incident reports
- Export capabilities

### Settings
- System configuration
- Security policies
- Notification settings
- Integration management

## 🛠️ Development

```bash
pnpm run dev          # Start development server
pnpm run build        # Build for production
pnpm run preview      # Preview production build
pnpm run lint         # Run ESLint
pnpm run type-check   # TypeScript type checking
```

## 🔗 Integration

The dashboard communicates with the backend API at:
- Development: `http://localhost:3000/api`
- Production: Configure in environment variables
