import {
  AdMob,
  AdMobRewardItem,
  RewardAdPluginEvents,
  AdLoadInfo,
  AdmobConsentStatus,
  AdmobConsentDebugGeography
} from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

// AdMob Configuration
const ADMOB_CONFIG = {
  android: {
    appId: process.env.ADMOB_ANDROID_APP_ID || 'ca-app-pub-1169009766287256~1198481965',
    rewardedAdId: process.env.ADMOB_ANDROID_REWARDED_AD_ID || 'ca-app-pub-1169009766287256/5704703183'
  },
  ios: {
    appId: process.env.ADMOB_IOS_APP_ID || 'ca-app-pub-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    rewardedAdId: process.env.ADMOB_IOS_REWARDED_AD_ID || 'ca-app-pub-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
  }
};

// Test device IDs for development (replace with actual device IDs)
const TEST_DEVICE_IDS = [
  'ANDROID_TEST_DEVICE_ID',
  'IOS_TEST_DEVICE_ID'
];

// Ad reward constants
export const AD_REWARD_POINTS = 1;
export const AD_WATCH_DURATION_SEC = 30;

export interface AdRewardResult {
  success: boolean;
  reward?: AdMobRewardItem;
  error?: string;
}

export interface AdStatus {
  loaded: boolean;
  showing: boolean;
  error?: string;
}

/**
 * Initialize AdMob with GDPR/UMP compliance following official documentation
 */
export const initializeMobileAdMob = async (): Promise<void> => {
  // Only initialize in native mobile apps
  if (!Capacitor.isNativePlatform()) {
    console.log('AdMob: Skipping initialization - not running on native platform');
    return;
  }

  try {
    console.log('🚀 Starting AdMob initialization with GDPR compliance...');

    const isDevelopment = process.env.NODE_ENV === 'development';

    // Step 1: Gather consent information (GDPR/UMP compliance)
    const consentInfo = await AdMob.requestConsentInfo({
      // For testing on real devices, uncomment and set your device ID:
      // debugGeography: AdmobConsentDebugGeography.EEA,
      // testDeviceIdentifiers: ['YOUR_DEVICE_ID']
    });

    console.log('📋 Consent info retrieved:', consentInfo);

    // Step 2: Handle tracking authorization (required on iOS)
    const trackingInfo = await AdMob.trackingAuthorizationStatus();

    if (trackingInfo.status === 'notDetermined') {
      console.log('🔍 Requesting tracking authorization...');
      await AdMob.requestTrackingAuthorization();
    }

    const finalTrackingStatus = await AdMob.trackingAuthorizationStatus();
    console.log('📱 Tracking authorization status:', finalTrackingStatus);

    // Step 3: Show consent form if required
    const shouldShowConsent = consentInfo.isConsentFormAvailable &&
                             consentInfo.status === AdmobConsentStatus.REQUIRED &&
                             finalTrackingStatus.status === 'authorized';

    if (shouldShowConsent) {
      console.log('📜 Showing GDPR consent form...');
      const consentResult = await AdMob.showConsentForm();
      console.log('✅ Consent form result:', consentResult);
    } else {
      console.log('ℹ️ Consent form not required or already handled');
    }

    // Step 4: Initialize AdMob
    await AdMob.initialize({
      testingDevices: isDevelopment ? TEST_DEVICE_IDS : [],
      initializeForTesting: isDevelopment
    });

    console.log('✅ AdMob fully initialized with GDPR compliance');

  } catch (error) {
    console.error('❌ Failed to initialize AdMob:', error);
    throw error;
  }
};

/**
 * Load a rewarded video ad with proper event listeners
 */
export const loadBasicPointAd = async (): Promise<boolean> => {
  // Only work on mobile platforms
  if (!Capacitor.isNativePlatform()) {
    console.log('AdMob: Ad loading skipped - not running on native platform');
    return false;
  }

  try {
    const platform = Capacitor.getPlatform().toLowerCase();
    const rewardedAdId = ADMOB_CONFIG[platform as keyof typeof ADMOB_CONFIG]?.rewardedAdId;

    if (!rewardedAdId || rewardedAdId.includes('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')) {
      console.warn('⚠️ AdMob rewarded ad ID not configured properly');
      return false;
    }

    // Listen for ad loaded event
    AdMob.addListener(RewardAdPluginEvents.Loaded, (info: AdLoadInfo) => {
      console.log('✅ Reward ad loaded successfully:', info);
    });

    // Prepare the rewarded ad (this will trigger the Loaded event when ready)
    await AdMob.prepareRewardVideoAd({
      adId: rewardedAdId,
      isTesting: process.env.NODE_ENV === 'development'
    });

    console.log('🎬 Basic point reward ad loading...');
    return true;
  } catch (error) {
    console.error('❌ Failed to start loading basic point ad:', error);
    return false;
  }
};

/**
 * Show the rewarded ad (prepares the ad if needed, then shows it)
 */
export const showBasicPointAd = async (userId: string): Promise<AdRewardResult> => {
  if (!Capacitor.isNativePlatform()) {
    console.log('AdMob: Ad showing skipped - not running on native platform');
    return { success: false, error: 'Not running on mobile platform' };
  }

  const platform = Capacitor.getPlatform().toLowerCase();
  const rewardedAdId = ADMOB_CONFIG[platform as keyof typeof ADMOB_CONFIG]?.rewardedAdId;

  if (!rewardedAdId || rewardedAdId.includes('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')) {
    console.warn('⚠️ AdMob rewarded ad ID not configured properly');
    return { success: false, error: 'Ad ID not configured' };
  }

  return new Promise(async (resolve) => {
    try {
      console.log('🎬 Preparing and showing reward video ad...');

      // First, ensure the ad is prepared/loaded
      try {
        await AdMob.prepareRewardVideoAd({
          adId: rewardedAdId,
          isTesting: process.env.NODE_ENV === 'development'
        });
        console.log('✅ Ad prepared successfully');
      } catch (prepareError) {
        console.error('❌ Failed to prepare ad:', prepareError);
        resolve({ success: false, error: 'Failed to prepare ad' });
        return;
      }

      // Wait a moment for the ad to be ready, then show it
      setTimeout(async () => {
        try {
          console.log('📺 Showing reward video ad...');
          await AdMob.showRewardVideoAd();

          // Set up listeners AFTER showing the ad
          const rewardListener = await AdMob.addListener(RewardAdPluginEvents.Rewarded, async (rewardItem: AdMobRewardItem) => {
            console.log('🎉 User earned reward from ad:', rewardItem);

            try {
              // Award the basic point via API (now event-driven!)
              const response = await fetch('/api/rewards/ad-basic-point', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
              });

              if (response.ok) {
                const data = await response.json();
                console.log('✅ Basic point awarded via reward event:', data);
                resolve({ success: true, reward: rewardItem });
              } else {
                const errorData = await response.json();
                console.error('❌ Failed to award points:', errorData);
                resolve({ success: false, error: errorData.message });
              }
            } catch (apiError) {
              console.error('❌ API error awarding points:', apiError);
              resolve({ success: false, error: 'Failed to award points' });
            }

            // Clean up listener
            rewardListener.remove();
          });

          const failedListener = await AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (error) => {
            console.error('❌ Reward ad failed to load after show:', error);
            resolve({ success: false, error: 'Ad failed to load' });
            failedListener.remove();
          });

        } catch (showError) {
          console.error('❌ Failed to show reward ad:', showError);
          resolve({ success: false, error: 'Failed to show ad' });
        }
      }, 1000); // Give ad time to load

    } catch (error) {
      console.error('❌ Failed to setup reward ad flow:', error);
      resolve({ success: false, error: 'Failed to setup ad' });
    }
  });
};

/**
 * Show GDPR consent form manually (for user settings/preferences)
 */
export const showConsentForm = async (): Promise<boolean> => {
  try {
    const consentInfo = await AdMob.requestConsentInfo();

    if (consentInfo.isConsentFormAvailable && consentInfo.status === AdmobConsentStatus.REQUIRED) {
      const result = await AdMob.showConsentForm();
      console.log('📜 Consent form shown:', result);
      return true;
    }

    return false; // Consent form not needed
  } catch (error) {
    console.error('❌ Failed to show consent form:', error);
    return false;
  }
};

/**
 * Check if the user can earn an ad reward today (rate limiting)
 */
export const canEarnAdRewardToday = async (): Promise<boolean> => {
  try {
    const response = await fetch('/api/rewards/ad-basic-point', {
      method: 'GET'
    });

    if (response.ok) {
      const data = await response.json();
      return data.canEarnReward || false;
    }
  } catch (error) {
    console.error('Failed to check reward status:', error);
  }

  // Default to false if we can't check (prevent spam)
  return false;
};

/**
 * Get the user's current reward status
 */
export const getUserRewardStatus = async () => {
  try {
    const response = await fetch('/api/rewards/ad-basic-point', {
      method: 'GET'
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('Failed to get reward status:', error);
  }

  return null;
};

/**
 * Is the app running on a mobile platform with AdMob support
 */
export const isMobileAdMobAvailable = (): boolean => {
  return Capacitor.isNativePlatform();
};

/**
 * Get platform-specific AdMob configuration
 */
export const getPlatformAdConfig = () => {
  if (!Capacitor.isNativePlatform()) return null;

  const platform = Capacitor.getPlatform().toLowerCase();
  return ADMOB_CONFIG[platform as keyof typeof ADMOB_CONFIG] || null;
};
