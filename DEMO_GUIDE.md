# QR Code Accreditation System - Demo Guide

This guide will help you showcase the Android apps to the events committee.

## 🎯 Demo Overview

You now have **2 complete Android apps** that demonstrate a secure, offline-first QR code accreditation system:

1. **QR Generator App** - For event attendees to display their access QR codes
2. **Scanner App** - For volunteers to verify QR codes and grant/deny access

## 📱 What's Been Built

### ✅ **QR Generator App Features**

- **Anti-screenshot protection** (screenshots disabled when QR is displayed)
- **Device-bound QR codes** that cannot be shared between devices
- **Offline operation** with local SQLite database
- **10 sample users** with different access levels (General, VIP, Staff, Security, Management)
- **Dynamic QR refresh** every 30 minutes for security
- **Clean, professional UI** optimized for mobile use

### ✅ **Scanner App Features**

- **Real-time camera scanning** with instant feedback
- **Offline verification** using local user database
- **Area-based access control** (6 different areas: Main Arena, VIP Lounge, etc.)
- **Visual/audio feedback** (green for granted, red for denied)
- **Scan logging and statistics** with local storage
- **Role-based scanner accounts** (Volunteer, Security, Admin)

### ✅ **Offline-First Architecture**

- **No internet required** for day-to-day operations
- **Local SQLite databases** on both apps with the same user data
- **Encrypted QR codes** with device-specific validation
- **Audit logging** for security and compliance

## 🚀 How to Test the Apps

### **Option 1: Development Testing (Recommended for Demo)**

1. **Install Expo Go** on your Android phone from Google Play Store
2. **Start QR Generator App**:

   ```bash
   cd qr-generator-app
   pnpm start
   ```

3. **Start Scanner App** (in another terminal):

   ```bash
   cd scanner-app
   pnpm start
   ```

4. **Scan QR codes** from Expo Go to install both apps on your phone

### **Option 2: APK Build (For Distribution)**

1. **Sign up for Expo Account**: https://expo.dev/
2. **Install Expo CLI**:

   ```bash
   npm install -g @expo/cli
   ```

3. **Login to Expo**:

   ```bash
   expo login
   ```

4. **Build APKs**:

   ```bash
   ./build-apps.sh
   ```

5. **Download APKs** from your Expo dashboard once builds complete

## 🎪 Demo Script for Events Committee

### **1. Introduction (2 minutes)**

"Today I'll demonstrate a complete QR code accreditation system designed specifically for sports events. This system addresses key challenges like network reliability, security, and ease of use for volunteers."

### **2. QR Generator App Demo (5 minutes)**

**Show the login screen:**

- "Event attendees use simple email login - no complex passwords needed"
- **Demo users**: Use `john.athlete@sports.com` (General access) and `sarah.vip@company.com` (VIP access)

**Show the QR display:**

- "Notice the anti-screenshot protection - you cannot take screenshots of the QR code"
- "Each QR code is device-specific and cannot be shared"
- "The code refreshes automatically for security"
- **Highlight access levels**: Show how VIP users see more areas than General users

### **3. Scanner App Demo (8 minutes)**

**Login as scanner:**

- Use `scanner1@event.com` for volunteer scanner
- Use `security@event.com` for security scanner role

**Show scanning interface:**

- **Area selection**: Demonstrate selecting different areas (Main Arena, VIP Lounge, etc.)
- **Live scanning**: Point camera at QR code from the Generator app
- **Instant feedback**: Show green checkmark for access granted
- **Access denied**: Try scanning a General user's QR for VIP Lounge area

**Show statistics:**

- "Real-time statistics show scan counts and success rates"
- "All scans are logged locally for audit purposes"

### **4. Key Benefits Demonstration (3 minutes)**

**Offline Operation:**

- "Turn off WiFi on both phones - the system continues working"
- "Perfect for stadiums where network connectivity is unreliable"

**Security Features:**

- "QR codes expire and refresh automatically"
- "Cannot screenshot or share QR codes between devices"
- "All access attempts are logged with timestamps"

**Scalability:**

- "Same database can support 500+ users"
- "Multiple scanner devices can operate simultaneously"
- "Easy to add more areas or change access levels"

### **5. Technical Advantages (2 minutes)**

**For Event Organizers:**

- "No internet dependency during the event"
- "Reduced volunteer training - simple green/red feedback"
- "Complete audit trail for security compliance"
- "Cost-effective - works on any Android device"

**For Attendees:**

- "Simple email login, no app account creation"
- "QR code always available, works offline"
- "Secure - cannot be shared or forwarded"

## 📊 Demo Data

### **Sample Users (QR Generator App)**

```
john.athlete@sports.com     - General (Main Arena, General Entrance, Food Court)
sarah.vip@company.com       - VIP (Main Arena, VIP Lounge, General Entrance, Food Court)
mike.staff@event.com        - Staff (Main Arena, Staff Area, General Entrance, Food Court)
emma.security@event.com     - Security (Main Arena, Security Zone, Staff Area, General Entrance)
david.manager@event.com     - Management (All areas access)
lisa.coach@sports.com       - Staff (Main Arena, Staff Area, General Entrance)
alex.media@news.com         - General (Main Arena, General Entrance)
sophie.sponsor@corp.com     - VIP (Main Arena, VIP Lounge, General Entrance, Food Court)
james.volunteer@event.com   - Staff (General Entrance, Food Court only)
maria.official@sports.org   - Management (All areas access)
```

### **Scanner Users (Scanner App)**

```
scanner1@event.com - Volunteer
scanner2@event.com - Volunteer  
security@event.com - Security
admin@event.com    - Admin
```

### **Areas for Testing**

```
Main Arena        - General access area
VIP Lounge        - VIP and above only
Staff Area        - Staff level and above
Security Zone     - Security and Management only
General Entrance  - All users can access
Food Court        - No restrictions
```

## 🎯 Demo Scenarios

### **Scenario 1: VIP Guest Access**

1. Login as `sarah.vip@company.com` in QR Generator
2. Login as `scanner1@event.com` in Scanner
3. Select "VIP Lounge" in Scanner
4. Scan Sarah's QR → **ACCESS GRANTED** ✅

### **Scenario 2: Access Denied**

1. Login as `john.athlete@sports.com` (General level)
2. Try to scan for "VIP Lounge" access
3. Result: **ACCESS DENIED** ❌ - "No access to VIP Lounge"

### **Scenario 3: Multi-Area Access**

1. Login as `david.manager@event.com` (Management)
2. Show how Management level can access all areas
3. Test different areas: Main Arena ✅, Security Zone ✅, VIP Lounge ✅

### **Scenario 4: Offline Operation**

1. Disconnect both phones from internet
2. Demonstrate that scanning still works perfectly
3. Show that statistics and logging continue working

## 🔐 Security Demonstration

### **Anti-Screenshot Protection**

1. Try to take screenshot while QR is displayed
2. Show that screenshot is blocked or QR is hidden
3. Explain this prevents QR sharing via messaging apps

### **Device Binding**

1. Generate QR on one device
2. Try to display same QR on another device
3. Show that each device generates unique QR codes

### **Access Level Validation**

1. Demonstrate how system enforces access rules
2. Show audit logging of all scan attempts
3. Explain how data is encrypted locally

## 💡 Questions & Answers

### **"How does this compare to traditional badge systems?"**

- No physical badges to lose or forge
- Real-time access control and logging
- Easy to update access permissions
- Environmentally friendly

### **"What about privacy concerns?"**

- Data stored locally on devices, not in cloud
- No personal data beyond name and access level
- Users can delete app to remove all data
- Complies with data protection regulations

### **"How do you handle lost phones?"**

- Admin can disable user access remotely
- QR codes expire automatically
- Device-bound codes prevent misuse
- Replacement access can be issued instantly

### **"What's the cost compared to other solutions?"**

- Uses existing Android devices
- No specialized hardware required
- No ongoing subscription fees for basic operation
- Scales easily from 50 to 5000+ users

## 🎬 Closing the Demo

**Summarize key benefits:**

1. **Reliability** - Works without internet
2. **Security** - Anti-sharing, device-bound QR codes
3. **Simplicity** - Easy for volunteers and attendees
4. **Scalability** - Handles events of any size
5. **Cost-effective** - Uses existing smartphones

**Next steps:**

- "The system is ready for pilot testing at your next event"
- "We can customize access levels and areas for your specific needs"
- "Full admin dashboard and backend synchronization available for larger deployments"

---