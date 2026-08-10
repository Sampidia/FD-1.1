import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sampidia.fakeproductdetector',
  appName: 'Fake Detector',
  webDir: 'public',
  server: {
    url: 'https://scan.sampidia.com',
    allowNavigation: [
      'scan.sampidia.com',
      'accounts.google.com',
      'ssl.gstatic.com',
      'www.gstatic.com',
      'fonts.gstatic.com'
    ]
  },
  overrideUserAgent: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#2563eb',
      overlaysWebView: true
    },
    SplashScreen: {
      launchShowDuration: 3000,
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
