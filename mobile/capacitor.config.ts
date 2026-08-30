import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.finledge.mobile',
  appName: 'FinLedge Mobile',
  webDir: 'www',
  android: {
    path: 'android'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      backgroundColor: "#0a0e14",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      useDialog: false,
    },
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      androidIsEncryption: false,
      androidBiometric: {
        biometricAuth: false
      }
    }
  }
};

export default config;
