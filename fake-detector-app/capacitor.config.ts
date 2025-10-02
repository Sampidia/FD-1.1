import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sampidia.fakeproductdetector',
  appName: 'Fake Products Detector',
  server: {
    url: 'https://scan.sampidia.com'
  },
  plugins: {
    // AdMob Configuration
    AdMob: {
      androidAppId: process.env.ADMOB_ANDROID_APP_ID,
      iosAppId: process.env.ADMOB_IOS_APP_ID
    },
    // Status Bar Configuration (required for edge-to-edge)
    StatusBar: {
      style: "DARK",
      backgroundColor: "#2563eb",
      overlaysWebView: true
    },
    // Splash Screen Configuration with Fade In/Out Animation
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      splashFullScreen: true,
      splashImmersive: true,
      backgroundColor: "#ffffff",
      showSpinner: true,
      spinnerColor: "#2563eb"
    },
    // Android Edge-to-Edge Support
    AndroidEdgeToEdgeSupport: {
      enabled: true
    },
    // Browser - for in-app web views (payment flows)
    Browser: {}
  }
};

export default config;
