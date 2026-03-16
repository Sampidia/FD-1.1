import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sampidia.fakeproductdetector',
  appName: 'Fake Detector',
  webDir: 'public',
  server: {
    url: 'https://scan.sampidia.com',
    allowNavigation: ['scan.sampidia.com']
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#2563eb',
      overlaysWebView: true
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      launchFadeOutDuration: 800,
      splashFullScreen: true,
      splashImmersive: true,
      backgroundColor: '#ffffff',
      showSpinner: true,
      spinnerColor: '#2563eb'
    },
    AndroidEdgeToEdgeSupport: {
      enabled: true
    },
    AdMob: {
      appId: 'ca-app-pub-1169009766287256~1198481965',
      initializeOnProgess: true
    }
  }
};

export default config;
