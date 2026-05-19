# SecureBank Mobile

Production-ready React Native banking mobile application with biometric authentication, push notifications, and comprehensive financial management features.

## Features

- ✅ **Authentication**
  - Email/Password login & registration
  - Biometric authentication (Face ID/Touch ID)
  - JWT token management with auto-refresh
  - Secure token storage with Expo SecureStore

- ✅ **Account Management**
  - Multiple account types (Savings, Checking, Business)
  - Real-time balance updates
  - Account creation and management

- ✅ **Transactions**
  - View transaction history
  - Transfer money between accounts
  - Payment processing
  - QR code scanning for payments

- ✅ **Cards**
  - Credit/Debit card management
  - Card details and limits
  - Card activation/deactivation

- ✅ **Security**
  - Biometric authentication
  - Two-factor authentication (2FA)
  - Secure data storage
  - Session management

- ✅ **Notifications**
  - Push notifications for transactions
  - Account alerts
  - Security notifications

- ✅ **UI/UX**
  - Material Design with React Native Paper
  - Smooth animations with Reanimated
  - Bottom tab navigation
  - Gesture support

## Tech Stack

- **Framework**: React Native (Expo 50)
- **Language**: TypeScript
- **State Management**: Redux Toolkit
- **Navigation**: React Navigation 6
- **UI Library**: React Native Paper
- **Authentication**: Expo Local Authentication
- **Storage**: Expo SecureStore, AsyncStorage
- **Notifications**: Expo Notifications
- **Camera/QR**: Expo Camera, Barcode Scanner
- **Charts**: React Native Chart Kit

## Quick Start

### Prerequisites

- Node.js 18+
- Expo CLI
- iOS Simulator or Android Emulator (or physical device)

### Installation

```bash
npm install
```

### Run the App

```bash
# Start Expo development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run on Web
npm run web
```

## Project Structure

```
├── src/
│   ├── navigation/      # Navigation configuration
│   ├── screens/         # Screen components
│   │   ├── auth/       # Authentication screens
│   │   └── main/       # Main app screens
│   ├── store/          # Redux store & slices
│   ├── services/       # API services
│   ├── utils/          # Utilities (biometric, notifications)
│   └── theme/          # App theme configuration
├── App.tsx             # App entry point
├── app.json            # Expo configuration
└── package.json
```

## Key Features Implementation

### Biometric Authentication

```typescript
import * as LocalAuthentication from "expo-local-authentication";
```

- Face ID/Touch ID support
- Fallback to passcode
- Secure credential storage

### Push Notifications

```typescript
import * as Notifications from "expo-notifications";
```

- Transaction alerts
- Account notifications
- Security alerts

### QR Code Scanning

```typescript
import { Camera } from "expo-camera";
import { BarCodeScanner } from "expo-barcode-scanner";
```

- Scan QR codes for payments
- Generate QR codes for receiving money

### Secure Storage

```typescript
import * as SecureStore from "expo-secure-store";
```

- Encrypted token storage
- Secure credential management

## API Integration

Configure API endpoint in [src/services/api.ts](src/services/api.ts):

```typescript
const API_URL = "http://localhost:8080/api"; // Change for production
```

## Screens

- **Authentication**
  - Login Screen (with biometric option)
  - Register Screen

- **Main App**
  - Dashboard (overview, quick actions)
  - Accounts (list, create, manage)
  - Transactions (history, filters)
  - Cards (view, manage)
  - Profile (settings, security)

## State Management

Redux Toolkit slices:

- `authSlice` - Authentication state
- `accountsSlice` - Account management
- `transactionsSlice` - Transaction history

## Security Features

1. **Biometric Authentication** - Face ID/Touch ID
2. **Secure Token Storage** - Expo SecureStore
3. **Auto Token Refresh** - Axios interceptors
4. **Session Management** - Redux state
5. **Encrypted Communication** - HTTPS only

## Build for Production

```bash
# Build for iOS
expo build:ios

# Build for Android
expo build:android
```

## Testing on Physical Device

1. Install Expo Go app from App Store/Play Store
2. Run `npm start`
3. Scan QR code with Expo Go app

## Environment Variables

Create `.env` file:

```
API_URL=https://api.securebank.com
```

## Contributing

This is a production-ready template. Customize branding, colors, and features as needed.

## License

MIT
