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
    // Social Login Configuration (better Google Auth)
    "@cap-go/capacitor-social-login": {
      googleClientId: process.env.GOOGLE_ANDROID_CLIENT_ID || "104134177023-e46bef4f1t0b1loaco03sujt9g2nphjo.apps.googleusercontent.com",
      googleScopes: ["profile", "email"],
      googleRedirectUrl: "com.sampidia.fakeproductdetector:/",
    }
  }
};

export default config;
