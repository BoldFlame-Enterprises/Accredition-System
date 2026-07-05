# Quick Start Guide - VeriGate Access Control

## 🚀 How to Test on Your Phone (Easiest Method)

### Step 1: Install Expo Go

- Download **Expo Go** from Google Play Store / App Store on your phone
- This works for everything except the encrypted local database (see each app's README for the dev-client build needed for that)

### Step 2: Start the VeriGate Pass App

```bash
cd verigate-pass
npm install
npm start
```

- A QR code will appear in the terminal
- Open Expo Go on your phone and scan this QR code
- The VeriGate Pass app will load on your phone

### Step 3: Start the VeriGate Scan App (in a new terminal)

```bash
cd verigate-scan
npm install
npm start
```

- Another QR code will appear
- Scan this QR code with Expo Go to load the VeriGate Scan app

## 📱 Testing the Complete System

Both apps work fully offline against seeded local demo data with no password. To test against the real backend instead (real event scoping, sync, dashboard visibility), enter `password123` for any of the seeded backend accounts below - see the root README's "End-to-end demo" section for the full backend setup.

### Test Scenario 1: VIP Access (local demo data, no backend needed)

1. **VeriGate Pass App**: Login with `sarah.vip@company.com` (leave password blank) - you'll see a QR code with VIP access level
2. **VeriGate Scan App**: Login with `scanner1@event.com` (leave password blank), pick area "VIP Lounge", point the camera at the QR code from the Pass app → **ACCESS GRANTED** ✅

### Test Scenario 2: Access Denied

1. **VeriGate Pass App**: Login with `john.athlete@sports.com` (General level)
2. **VeriGate Scan App**: Select area "VIP Lounge", scan the General user's QR code → **ACCESS DENIED** ❌

## 🎯 Local Demo Users (built into each app, no backend required)

### VeriGate Pass App (Event Attendees)

```
john.athlete@sports.com     - General Level
sarah.vip@company.com       - VIP Level
mike.staff@event.com        - Staff Level
emma.security@event.com     - Security Level
david.manager@event.com     - Management Level (All areas)
```

### VeriGate Scan App (Volunteers)

```
scanner1@event.com - Volunteer
scanner2@event.com - Volunteer
security@event.com - Security
admin@event.com     - Admin
```

## 🎯 Backend Demo Users (for real event sync - see root README)

```
admin@test.com / password123    - Admin
scanner@test.com / password123  - Scanner
vip@test.com / password123      - VIP
staff@test.com / password123    - Staff
general@test.com / password123  - General
```

## 🔧 Troubleshooting

### If you see Metro bundler warnings

- The apps will still work perfectly in Expo Go
- You'll see a QR code in the terminal - that means it's working

### If QR code doesn't appear

- Make sure you're in the correct directory (`verigate-pass` or `verigate-scan`)
- Make sure `npm install` completed successfully first

### If apps don't connect

- Make sure your phone and computer are on the same WiFi network
- Check that Expo Go is updated to the latest version
- If testing against the real backend, make sure `EXPO_PUBLIC_API_URL` (or `expo.extra.apiBaseUrl` in `app.json`) points at a reachable IP, not `localhost` (your phone can't reach your computer's `localhost`)

## 🎪 For the Events Committee Demo

1. **Show both apps running on your phone**
2. **Demonstrate the login process** for both attendees and volunteers
3. **Show live QR scanning** with immediate visual + audio feedback
4. **Test different access levels** (VIP vs General)
5. **Highlight offline operation** (turn off WiFi and show it still works)
6. **Show the admin dashboard** reflecting a scan a few seconds after syncing, if demoing against the real backend

## 🚀 Next Steps for Production

1. Create an Expo account: https://expo.dev/signup
2. Run `eas login`
3. `npx expo prebuild && eas build --profile production --platform android` (or `ios`) in each app directory
4. Download builds from the Expo dashboard
