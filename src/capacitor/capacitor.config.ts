// Capacitor configuration for pocketbank

import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pocketbank.app',
  appName: 'PocketBank',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: "#ffffffff",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      iosSplashStyle: "default",
      iosSplashImageName: "splash",
      androidSpinnerStyle: "default",
      iosSpinnerStyle: "default",
      spinnerColor: "#3880ff",
      showSpinner: true,
      androidSpinnerResourceName: "spinner",
      iosSpinnerResourceName: "spinner",
      splashFullScreen: true,
      splashImmersive: true,
      layoutName: "launch_screen",
      useDialog: true
    },
    LocalNotifications: {
      displayInForeground: true
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    Haptics: {
      enabled: true
    },
    Keyboard: {
      resize: "body"
    },
    StatusBar: {
      style: "dark",
      backgroundColor: "#ffffffff"
    },
    Device: {
      enabled: true
    },
    App: {
      enabled: true
    },
    Camera: {
      enabled: true
    },
    Geolocation: {
      enabled: true
    },
    Network: {
      enabled: true
    },
    Storage: {
      enabled: true
    },
    Preferences: {
      enabled: true
    },
    SecureStorage: {
      enabled: true
    },
    Filesystem: {
      enabled: true
    }
  }
};

export default config;
