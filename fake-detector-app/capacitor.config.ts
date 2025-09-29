import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sampidia.productchecker',
  appName: 'Fake Products Detector',
  webDir: 'out',
  plugins: {
    // AdMob Configuration
    AdMob: {
      androidAppId: process.env.ADMOB_ANDROID_APP_ID,
      iosAppId: process.env.ADMOB_IOS_APP_ID
    }
  }
};

export default config;
