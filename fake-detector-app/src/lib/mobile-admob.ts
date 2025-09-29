import { AdMob, AdMobRewardItem, RewardAdPluginEvents } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

// AdMob Configuration
const ADMOB_CONFIG = {
  android: {
    appId: process.env.ADMOB_ANDROID_APP_ID || 'ca-app-pub-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    rewardedAdId: process.env.ADMOB_ANDROID_REWARDED_AD_ID || 'ca-app-pub-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
  },
  ios: {
    appId: process.env.ADMOB_IOS_APP_ID || 'ca-app-pub-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    rewardedAdId: process.env.ADMOB_IOS_REWARDED_AD_ID || 'ca-app-pub-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
  }
};

// Test device IDs for development
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
 * Initialize AdMob for the mobile app
 */
export const initializeMobileAdMob = async (): Promise<void> => {
  // Only initialize in native mobile apps
  if (!Capacitor.isNativePlatform()) {
    console.log('AdMob: Skipping initialization - not running on native platform');
    return;
  }

  try {
    const isDevelopment = process.env.NODE_ENV === 'development';

    await AdMob.initialize({
      testingDevices: isDevelopment ? TEST_DEVICE_IDS : [],
      initializeForTesting: isDevelopment
    });

    console.log('✅ AdMob initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize AdMob:', error);
    throw error;
  }
};

/**
 * Load a rewarded video ad
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

    if (!rewardedAdId) {
      throw new Error(`No rewarded ad ID configured for ${platform}`);
    }

    await AdMob.prepareRewardVideoAd({
      adId: rewardedAdId,
      isTesting: process.env.NODE_ENV === 'development'
    });

    console.log('✅ Basic point reward ad loaded');
    return true;
  } catch (error) {
    console.error('❌ Failed to load basic point ad:', error);
    return false;
  }
};

/**
 * Show the rewarded ad and return the result
 */
export const showBasicPointAd = async (userId: string): Promise<AdRewardResult> => {
  if (!Capacitor.isNativePlatform()) {
    console.log('AdMob: Ad showing skipped - not running on native platform');
    return { success: false, error: 'Not running on mobile platform' };
  }

  try {
    // Show the ad
    await AdMob.showRewardVideoAd();

    // For now, assume reward was granted if no error
    // In production, you'd want proper event listeners
    console.log('🎉 Ad shown successfully, requesting reward...');

    // Award the basic point via API immediately for POC
    // In production, this should be triggered by AdMob events
    const response = await fetch('/api/rewards/ad-basic-point', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Basic point awarded:', data);
      return { success: true };
    } else {
      const errorData = await response.json();
      console.error('❌ Failed to award points:', errorData);
      return { success: false, error: errorData.message };
    }

  } catch (error) {
    console.error('❌ Failed to show rewarded ad:', error);
    return { success: false, error: 'Failed to show ad' };
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

  // Default to true if we can't check (allow ad display)
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
