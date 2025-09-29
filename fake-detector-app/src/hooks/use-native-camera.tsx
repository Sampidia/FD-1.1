import { useState, useCallback } from 'react';
import { Camera, CameraResultType, CameraSource, CameraDirection, Photo } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

interface CameraResult {
  success: boolean;
  imageData?: string;
  error?: string;
}

interface UseNativeCamera {
  takeFrontPhoto: () => Promise<CameraResult>;
  takeBackPhoto: () => Promise<CameraResult>;
  pickFromGallery: () => Promise<CameraResult>;
  isNative: boolean;
  isLoading: boolean;
}

/**
 * Hook for using native mobile camera capabilities
 * Falls back to web behavior when not running natively
 */
export function useNativeCamera(): UseNativeCamera {
  const [isLoading, setIsLoading] = useState(false);

  // Check if running on a native mobile platform
  const isNative = Capacitor.isNativePlatform();

  /**
   * Request camera permissions if needed (Android 13+)
   */
  const requestPermissions = async (): Promise<boolean> => {
    if (!isNative) return true;

    try {
      // Capacitor handles permission requests automatically
      return true;
    } catch (error) {
      console.error('Failed to request camera permissions:', error);
      return false;
    }
  };

  /**
   * Take a photo with the front camera
   */
  const takePhoto = async (direction: 'front' | 'rear' = 'rear'): Promise<CameraResult> => {
    // If not native, return false (use browser camera)
    if (!isNative) {
      return {
        success: false,
        error: 'Native camera not available, using browser camera'
      };
    }

    try {
      setIsLoading(true);

      // Request permissions first
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        return {
          success: false,
          error: 'Camera permission denied'
        };
      }

      const photo: Photo = await Camera.getPhoto({
        quality: 90,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        direction: direction === 'front' ? CameraDirection.Front : CameraDirection.Rear,
        width: 2048,     // High resolution optimized for OCR
        height: 2048,
        presentationStyle: 'fullscreen',
        allowEditing: false,
        webUseInput: false // Use native camera interface
      });

      console.log(`✅ Native camera photo taken (${direction}):`, {
        format: photo.format
      });

      return {
        success: true,
        imageData: photo.dataUrl
      };

    } catch (error) {
      console.error('❌ Native camera failed:', error);

      // Try fallback to gallery selection
      console.log('🔄 Falling back to gallery selection...');
      return await pickFromGallery();

    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Take a front-facing photo
   */
  const takeFrontPhoto = useCallback(async (): Promise<CameraResult> => {
    return await takePhoto('front');
  }, []);

  /**
   * Take a rear/back-facing photo
   */
  const takeBackPhoto = useCallback(async (): Promise<CameraResult> => {
    return await takePhoto('rear');
  }, []);

  /**
   * Pick an image from the photo gallery
   */
  const pickFromGallery = useCallback(async (): Promise<CameraResult> => {
    if (!isNative) {
      return {
        success: false,
        error: 'Native gallery not available'
      };
    }

    try {
      setIsLoading(true);

      const photo: Photo = await Camera.getPhoto({
        quality: 90,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
        width: 2048,
        height: 2048,
        allowEditing: false
      });

      console.log('✅ Photo selected from gallery:', {
        format: photo.format
      });

      return {
        success: true,
        imageData: photo.dataUrl
      };

    } catch (error) {
      console.error('❌ Gallery selection failed:', error);
      return {
        success: false,
        error: 'Failed to select photo from gallery'
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    takeFrontPhoto,
    takeBackPhoto,
    pickFromGallery,
    isNative,
    isLoading
  };
}
