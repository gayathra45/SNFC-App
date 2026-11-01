# SANASA NFC Writer — Android Application

## 1. Project Overview

**SANASA NFC Writer** is a standalone, production-oriented Android application developed specifically for authorized **SANASA General Insurance Branch Staff**. 

The application enables branch staff to wirelessly receive individual card URLs from the existing SANASA Insurance web portal, write those authorized URLs to physical NFC cards as NDEF URI records, perform strict byte-for-byte read-back verification directly from the tag chip, and synchronize preparation and verification records in real time with the backend database.

---

## 2. Mandatory Isolation & Repository Architecture

This application is developed in the dedicated `NFC App/SANASA NFC Writer/` directory, maintaining clean separation from the existing SANASA web and mobile applications:

```
COMMON_PARENT/
├── SanasaInsuarance/              # Existing Insurance System (Website, Backend, Mobile App)
│   ├── backend/                   # Node/Express API, MongoDB, Socket.IO
│   ├── frontend/                  # Next.js Web Portal (Branch Office Staff & Admin)
│   └── mobile_app/                # Policyholder Mobile Application
│
└── NFC App/                       # NFC Writer Root
    └── SANASA NFC Writer/         # Standalone Android Application
        ├── app/
        │   ├── _layout.tsx        # Root Stack Navigation & Provider
        │   ├── index.tsx          # Auth Router & Splash Redirector
        │   ├── card-detail.tsx    # Card Inspection Modal
        │   ├── settings.tsx       # Diagnostics & Server IP Settings
        │   ├── (auth)/
        │   │   └── login.tsx      # Branch Staff Authentication
        │   └── (tabs)/
        │       ├── _layout.tsx    # Executive Bottom Tab Navigator
        │       ├── index.tsx      # Dashboard & Incoming Wireless Transfer Banner
        │       ├── pairing.tsx    # Desktop Portal Pairing (6-digit Code)
        │       ├── writer.tsx     # Physical NFC Writer & Verification Screen
        │       └── history.tsx    # Write History Log & Diagnostics
        ├── assets/                # App Icons & SANASA Corporate Logos
        ├── src/
        │   ├── config/
        │   │   └── api.ts         # Server Host IP & Dynamic Endpoint Config
        │   └── services/
        │       ├── authService.ts # Branch Staff Login & Session Management
        │       ├── pairingService.ts # Wireless Device Pairing Service
        │       ├── nfcService.ts  # Hardware Detection, NDEF Write & Verification
        │       ├── socketService.ts # Real-Time Socket.IO Wireless Event Client
        │       ├── storageService.ts # Secure Persistence & URL Masking
        │       └── syncService.ts # Backend Sync & Offline Pending Queue
        ├── package.json
        ├── app.json               # Android Permissions & Native NFC Plugin
        ├── tsconfig.json          # TypeScript Configuration
        └── README.md
```

---

## 3. Technology Stack

- **Framework**: React Native with Expo SDK 58
- **Language**: TypeScript (Strict Mode)
- **Navigation**: Expo Router (File-based Typed Routing)
- **NFC Engine**: `react-native-nfc-manager` (Native Android NDEF URI writer and tag reader)
- **Real-Time Gateway**: `socket.io-client` v4 (WSS / WebSocket with automatic reconnection)
- **Local Persistence**: `@react-native-async-storage/async-storage`
- **Sensors & Feedback**: `expo-haptics` (tactile confirmation on tag detection & write)
- **Icons**: `@expo/vector-icons` (MaterialCommunityIcons)

---

## 4. Main User & Security Model

- **Authorized Users**: SANASA Branch Office Staff (`OfficeStaff`) and Administrators (`Admin`).
- **Authentication**: Authenticates through the existing `/api/auth/login` endpoint with email/NIC and password.
- **Branch Isolation**: Each staff member is strictly scoped to their assigned branch (e.g. Galle, Matara, Colombo). Cards from other branches are inaccessible.
- **Session Security**: Staff tokens and pairing IDs are stored locally in isolated storage. Full secret access tokens are never logged or displayed in plain text; URLs are displayed using secure masking (`https://.../driver-access/••••••••3a8f`).
- **Safe Logout**: Provides complete local session clearance and unpairs active devices upon logout.

---

## 5. End-to-End Business Workflow

1. **Staff Login**: A branch staff member logs into the SANASA Insurance website on their computer and into this NFC Writer app on their Android phone.
2. **Device Pairing**:
   - On the website (Optional NFC Cards tab), the staff member clicks **"Pair NFC Writer Phone"**.
   - The backend issues a single-use 6-character cryptographic code (e.g. `RXKJG7`) valid for 5 minutes.
   - On the phone, the staff member enters the code in the **Device Pairing** tab.
   - The device is securely bound to the staff session and branch for the duration of the shift.
3. **Wireless Transfer**:
   - On the website, under the approved card request, staff clicks **"Transfer to NFC Writer"** on an individual card.
   - The backend pushes an authorized transfer job via Socket.IO directly to the paired phone.
4. **Card Reception**:
   - The Android app receives the job in real time and displays an alert card on the Dashboard with Card ID, Order ID, and masked URL preview.
5. **Physical Card Detection**:
   - Staff taps **"Hold Card to Phone & Write"** or opens the **NFC Writer** tab.
   - Clear placement instructions and antenna illustration guide the user to hold the physical card against the center-top back of the phone.
6. **Explicit Write Confirmation**:
   - Staff confirms the write operation by tapping **"Confirm & Start NFC Write"** (preventing accidental writes).
7. **NDEF Writing**:
   - The app detects the physical tag, checks capacity, and writes the exact authorized URL as an NDEF URI record.
8. **Byte-for-Byte Read-Back Verification**:
   - Immediately after writing, the app reads back the stored NDEF payload from the physical chip.
   - Compares the read-back URI with the expected backend URL.
   - The card is considered verified only if both URIs match exactly.
9. **Backend Synchronization**:
   - The app notifies `POST /api/nfc-card/writer/complete` with Card ID, Tag UID, and verified read-back URI.
   - The backend marks the card record as verified and ready.
   - If all cards in the request are completed, the backend updates the request status to **"Ready for Collection"**.
   - Socket.IO broadcasts updated status to the website in real time.
10. **Partial Failure & Offline Handling**:
    - If the write succeeds on the tag but the network drops, the app marks the card as **"Written - Sync Pending"** and queues it locally.
    - Staff can tap **"Sync Now"** once connection is restored, without rewriting the physical card.

---

## 6. Multi-Device Android Compatibility

- **Hardware Detection**: Runtime check using `NfcManager.isSupported()`. If the phone has no NFC chip, displays a clear explanation rather than crashing or simulating false success.
- **NFC Power State**: Runtime check using `NfcManager.isEnabled()`. If NFC is turned off, displays an alert with a direct shortcut to open Android NFC Settings (`NfcManager.goToNfcSetting()`).
- **Tested Manufacturers**: Designed and tested across Android devices from Google Pixel (e.g., Pixel 7/8/9), Samsung Galaxy (e.g., S22/S23/S24, A-series), Xiaomi, and Motorola.
- **Supported NFC Tag Types**:
  - NFC Forum Type 2 Tags (NXP NTAG213, NTAG215, NTAG216)
  - Mifare Ultralight / Ultralight C
  - NFC Forum Type 4 Tags (IsoDep)
- **Minimum Android Version**: Android 10.0 (API level 29) or higher.

---

## 7. How to Run Locally

### Prerequisites
1. Ensure the SANASA backend server is running on port 5000 (`npm run dev` in `SanasaInsuarance/backend`).
2. Ensure Node.js v18+ and npm are installed.

### Start the Application
In the `NFC App/SANASA NFC Writer` directory:

```bash
# Start Expo development server
npm run start

# Launch directly on connected Android device / emulator
npm run android
```

### Port Forwarding for Physical Device or Emulator
If running an Android emulator or a physical phone via USB debugging:

```bash
adb reverse tcp:5000 tcp:5000
```

Alternatively, tap the gear icon in the app header and configure your machine's LAN IP (e.g. `http://192.168.42.36:5000`).
